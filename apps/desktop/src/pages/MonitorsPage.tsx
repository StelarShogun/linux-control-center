import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import { hyprctlMonitorsJson, hyprctlSetKeyword } from "../tauri/api";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";
import { MonitorLayoutPreviewInteractive } from "../components/hyprland/MonitorLayoutPreviewInteractive";
import {
  MONITOR_TRANSFORM_OPTIONS,
  currentModeToken,
  normalizeAvailableModes,
  parseModeString,
} from "../hyprland/monitorModes";
import {
  adjustNeighbors,
  allMonitorsConnected,
  buildMonitorKeywordFull,
  computeValidScales,
  effectiveLogicalSize,
  nearestScaleIndex,
  previewClampExtent,
  previewResolveCollisions,
  validateMirror,
  type DragMon,
  type MonitorGeom,
} from "../hyprland/monitorHyprland";

interface Props {
  backendStatus: BackendStatus;
}

interface MonitorRow {
  id: number;
  name: string;
  make: string;
  model: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  refreshRate: number;
  focused?: boolean;
  transform: number;
  disabled: boolean;
  mirrorOf: string;
  availableModes: string[];
  description: string;
}

interface MonitorDraft {
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  refresh: string;
  transform: number;
  disabled: boolean;
  mirrorOf: string;
  bitDepth: string;
  vrr: string;
  cm: string;
}

const SCALE_PRESETS = [1, 1.25, 1.5, 1.75, 2] as const;

const BITDEPTH_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Auto" },
  { value: "8", label: "8-bit" },
  { value: "10", label: "10-bit" },
];

const VRR_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Desactivado" },
  { value: "1", label: "Activado" },
  { value: "2", label: "Solo pantalla completa" },
  { value: "3", label: "Pantalla completa + juego" },
];

const CM_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Desactivado" },
  { value: "srgb", label: "sRGB" },
  { value: "hdr", label: "HDR" },
];

function parseVrrField(m: Record<string, unknown>): string {
  if (typeof m.vrr === "boolean") return m.vrr ? "1" : "";
  if (typeof m.vrr === "number") return String(Math.max(0, Math.min(3, Math.round(m.vrr))));
  return "";
}

function parseBitDepthField(m: Record<string, unknown>): string {
  const b = m.bitDepth ?? m.bitdepth;
  if (b === 10 || b === "10") return "10";
  if (b === 8 || b === "8") return "8";
  return "";
}

function parseCmField(m: Record<string, unknown>): string {
  const c = m.cm ?? m.colorManagement;
  if (typeof c === "string") {
    const t = c.trim().toLowerCase();
    if (t === "srgb" || t === "hdr") return t;
  }
  return "";
}

function mergedGeom(rows: MonitorRow[], drafts: Record<number, MonitorDraft>): MonitorGeom[] {
  return rows.map((r) => {
    const d = drafts[r.id]!;
    return {
      id: r.id,
      name: r.name,
      x: d.x,
      y: d.y,
      width: d.width,
      height: d.height,
      transform: d.transform,
      disabled: d.disabled,
      mirrorOf: d.mirrorOf,
    };
  });
}

function buildDragMons(rows: MonitorRow[], drafts: Record<number, MonitorDraft>): DragMon[] {
  return rows.map((r) => {
    const d = drafts[r.id]!;
    const { ew, eh } = effectiveLogicalSize(d.width, d.height, d.transform);
    return {
      id: r.id,
      name: r.name,
      x: d.x,
      y: d.y,
      ew,
      eh,
      disabled: d.disabled,
      mirrorOf: d.mirrorOf,
    };
  });
}

function cloneDrafts(d: Record<number, MonitorDraft>): Record<number, MonitorDraft> {
  return JSON.parse(JSON.stringify(d)) as Record<number, MonitorDraft>;
}

function draftsEqual(a: MonitorDraft, b: MonitorDraft): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.x === b.x &&
    a.y === b.y &&
    a.scale === b.scale &&
    a.refresh === b.refresh &&
    a.transform === b.transform &&
    a.disabled === b.disabled &&
    a.mirrorOf === b.mirrorOf &&
    a.bitDepth === b.bitDepth &&
    a.vrr === b.vrr &&
    a.cm === b.cm
  );
}

const MonitorsPage: FC<Props> = ({ backendStatus }) => {
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, MonitorDraft>>({});
  const [baseline, setBaseline] = useState<Record<number, MonitorDraft>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [applyAllBusy, setApplyAllBusy] = useState(false);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  /** Deshacer cambios de borrador (formulario + arrastre), sin escribir en AppSettings. */
  const draftUndoStack = useRef<Record<number, MonitorDraft>[]>([]);
  const [draftUndoCount, setDraftUndoCount] = useState(0);

  const pushDraftUndo = useCallback((snapshot: Record<number, MonitorDraft>) => {
    draftUndoStack.current = [...draftUndoStack.current.slice(-39), cloneDrafts(snapshot)];
    setDraftUndoCount(draftUndoStack.current.length);
  }, []);

  const undoDraft = useCallback(() => {
    if (draftUndoStack.current.length === 0) {
      setMsg("No hay más pasos para deshacer en el borrador.");
      return;
    }
    const prev = draftUndoStack.current.pop()!;
    setDraftUndoCount(draftUndoStack.current.length);
    setDrafts(prev);
    setMsg("Borrador: paso deshecho.");
  }, []);

  const load = useCallback(async () => {
    if (backendStatus !== "ready") return;
    setErr(null);
    setMsg(null);
    try {
      const raw = await hyprctlMonitorsJson();
      const data = JSON.parse(raw) as unknown;
      const arr = Array.isArray(data) ? data : [];
      const rawList = arr as Record<string, unknown>[];
      const byId = new Map<number, Record<string, unknown>>();
      for (const x of rawList) {
        byId.set(Number(x.id ?? 0), x);
      }
      const next: MonitorRow[] = rawList.map((m: Record<string, unknown>) => {
        const mirrorRaw = m.mirrorOf ?? m.mirror;
        const mirrorStr =
          typeof mirrorRaw === "string" ? mirrorRaw : mirrorRaw != null ? String(mirrorRaw) : "";
        const desc = typeof m.description === "string" ? m.description : "";
        const make = typeof m.make === "string" ? m.make : "";
        const model = typeof m.model === "string" ? m.model : "";
        return {
          id: Number(m.id ?? 0),
          name: String(m.name ?? ""),
          make,
          model,
          width: Number(m.width ?? 0),
          height: Number(m.height ?? 0),
          x: Number(m.x ?? 0),
          y: Number(m.y ?? 0),
          scale: Number(m.scale ?? 1),
          refreshRate: Number(m.refreshRate ?? 60),
          focused: Boolean(m.focused),
          transform: Math.round(Math.min(7, Math.max(0, Number(m.transform ?? 0)))),
          disabled: Boolean(m.disabled),
          mirrorOf: mirrorStr,
          availableModes: normalizeAvailableModes(m.availableModes),
          description: desc,
        };
      });
      setRows(next);
      const dr: Record<number, MonitorDraft> = {};
      for (const r of next) {
        const m = byId.get(r.id);
        dr[r.id] = {
          width: r.width,
          height: r.height,
          x: r.x,
          y: r.y,
          scale: r.scale,
          refresh: r.refreshRate.toFixed(3),
          transform: r.transform,
          disabled: r.disabled,
          mirrorOf: r.mirrorOf,
          bitDepth: m ? parseBitDepthField(m) : "",
          vrr: m ? parseVrrField(m) : "",
          cm: m ? parseCmField(m) : "",
        };
      }
      draftUndoStack.current = [];
      setDraftUndoCount(0);
      setDrafts(dr);
      setBaseline(cloneDrafts(dr));
    } catch (e) {
      setRows([]);
      setDrafts({});
      setBaseline({});
      draftUndoStack.current = [];
      setDraftUndoCount(0);
      setErr(String(e));
    }
  }, [backendStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const gapOpen = useMemo(() => {
    if (rows.length === 0) return false;
    return !allMonitorsConnected(mergedGeom(rows, drafts));
  }, [rows, drafts]);

  const patchDraft = useCallback(
    (mid: number, patch: Partial<MonitorDraft>) => {
      setDrafts((prev) => {
        const cur = prev[mid];
        if (!cur) return prev;
        const row = rows.find((r) => r.id === mid);
        if (!row) return prev;

        const tentative: MonitorDraft = { ...cur, ...patch };

        if (patch.mirrorOf !== undefined && tentative.mirrorOf.trim()) {
          const ge = mergedGeom(rows, { ...prev, [mid]: tentative });
          const self = ge.find((g) => g.id === mid)!;
          const verr = validateMirror(ge, self, tentative.mirrorOf);
          if (verr) {
            queueMicrotask(() => setMsg(verr));
            return prev;
          }
        }

        let next: Record<number, MonitorDraft> = { ...prev, [mid]: tentative };

        if (patch.disabled === true) {
          for (const r of rows) {
            if (r.id === mid) continue;
            const o = next[r.id];
            if (o && o.mirrorOf.trim() === row.name) {
              next[r.id] = { ...o, mirrorOf: "" };
            }
          }
        }

        const affects =
          patch.width !== undefined ||
          patch.height !== undefined ||
          patch.scale !== undefined ||
          patch.transform !== undefined;

        if (affects) {
          const oldEw = effectiveLogicalSize(cur.width, cur.height, cur.transform).ew;
          const oldEh = effectiveLogicalSize(cur.width, cur.height, cur.transform).eh;
          const geoms = adjustNeighbors(mergedGeom(rows, next), mid, oldEw, oldEh);
          for (const g of geoms) {
            const o = next[g.id];
            if (o) next[g.id] = { ...o, x: g.x, y: g.y };
          }
        }

        if (JSON.stringify(next) !== JSON.stringify(prev)) {
          pushDraftUndo(prev);
        }
        return next;
      });
    },
    [rows, pushDraftUndo]
  );

  const onDragLive = useCallback(
    (id: number, nx: number, ny: number, sx: number, sy: number) => {
      setDrafts((prev) => {
        const tentative = { ...prev[id]!, x: nx, y: ny };
        const merged = { ...prev, [id]: tentative };
        const dragMons = buildDragMons(rows, merged);
        let { x, y } = previewResolveCollisions(dragMons, id, nx, ny, sx, sy);
        ({ x, y } = previewClampExtent(dragMons, id, x, y));
        const out = { ...prev, [id]: { ...prev[id]!, x, y } };
        return out;
      });
    },
    [rows]
  );

  const onPreviewDragStart = useCallback(() => {
    pushDraftUndo(draftsRef.current);
  }, [pushDraftUndo]);

  const onDragEnd = useCallback(() => {
    setMsg("Posición actualizada (borrador). Pulsa «Aplicar monitor» para IPC.");
  }, []);

  const applyMonitor = async (m: MonitorRow) => {
    const d = drafts[m.id];
    if (!d || backendStatus !== "ready") return;
    const mir = d.mirrorOf.trim();
    if (mir && mir === m.name) {
      setMsg("Error: mirror inválido.");
      return;
    }
    const ge = mergedGeom(rows, drafts);
    const self = ge.find((g) => g.id === m.id)!;
    const verr = validateMirror(ge, self, mir);
    if (verr) {
      setMsg(`Error: ${verr}`);
      return;
    }
    setMsg(null);
    try {
      const val = buildMonitorKeywordFull({
        name: m.name,
        width: d.width,
        height: d.height,
        refresh: d.refresh,
        x: d.x,
        y: d.y,
        scale: d.scale,
        transform: d.transform,
        disabled: d.disabled,
        mirrorOf: d.mirrorOf,
        bitDepth: d.bitDepth,
        vrr: d.vrr,
        cm: d.cm,
      });
      await hyprctlSetKeyword("monitor", val);
      setMsg(`monitor ${m.name} aplicado.`);
      await load();
    } catch (e) {
      setMsg(`Error: ${String(e)}`);
    }
  };

  const applyAllMonitors = async () => {
    if (backendStatus !== "ready" || rows.length === 0) return;
    setApplyAllBusy(true);
    setMsg(null);
    try {
      for (let i = 0; i < rows.length; i++) {
        const m = rows[i]!;
        const d = drafts[m.id];
        if (!d) continue;
        const ge = mergedGeom(rows, drafts);
        const self = ge.find((g) => g.id === m.id)!;
        const verr = validateMirror(ge, self, d.mirrorOf.trim());
        if (verr) {
          setMsg(`Error en ${m.name}: ${verr}`);
          return;
        }
        const val = buildMonitorKeywordFull({
          name: m.name,
          width: d.width,
          height: d.height,
          refresh: d.refresh,
          x: d.x,
          y: d.y,
          scale: d.scale,
          transform: d.transform,
          disabled: d.disabled,
          mirrorOf: d.mirrorOf,
          bitDepth: d.bitDepth,
          vrr: d.vrr,
          cm: d.cm,
        });
        await hyprctlSetKeyword("monitor", val);
        if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 120));
      }
      setMsg("Todos los monitores aplicados (IPC).");
      await load();
    } catch (e) {
      setMsg(`Error: ${String(e)}`);
    } finally {
      setApplyAllBusy(false);
    }
  };

  const discardOne = (id: number) => {
    const b = baseline[id];
    if (!b) return;
    pushDraftUndo(draftsRef.current);
    setDrafts((prev) => ({ ...prev, [id]: { ...b } }));
    setMsg("Borrador restaurado a la última lectura de Hyprland.");
  };

  const discardAllToBaseline = () => {
    if (Object.keys(baseline).length === 0) return;
    pushDraftUndo(draftsRef.current);
    setDrafts(cloneDrafts(baseline));
    setMsg("Todo el borrador restaurado a Hyprland.");
  };

  const focusedName = rows.find((r) => r.focused)?.name ?? null;

  return (
    <div style={styles.page}>
      <h1 style={PAGE_HEADING}>Monitores</h1>
      <p style={PAGE_NOTE}>
        Paridad orientada a HyprMod: modos EDID, escalas válidas Hyprland (1/120), transform,
        mirror, VRR / bit depth / color management en la línea <code>monitor</code>, ajuste de
        vecinos al cambiar resolución o escala, aviso de huecos, arrastre en la vista previa y
        descarte por salida.{" "}
        <a href="https://wiki.hypr.land/0.54.0/Configuring/Monitors/" target="_blank" rel="noreferrer">
          Wiki Monitors
        </a>
        .
      </p>
      <div style={styles.topRow}>
        <div style={styles.toolbarCol}>
          <button
            type="button"
            className="ps-btn-secondary"
            disabled={backendStatus !== "ready"}
            onClick={() => void load()}
          >
            Actualizar desde Hyprland
          </button>
          <button
            type="button"
            className="ps-btn-secondary"
            disabled={draftUndoCount === 0}
            onClick={() => undoDraft()}
          >
            Deshacer borrador
          </button>
          <button
            type="button"
            className="ps-btn-secondary"
            disabled={Object.keys(baseline).length === 0}
            onClick={discardAllToBaseline}
          >
            Descartar todo → Hyprland
          </button>
          <button
            type="button"
            className="ps-btn-primary"
            disabled={backendStatus !== "ready" || applyAllBusy || rows.length === 0}
            onClick={() => void applyAllMonitors()}
          >
            {applyAllBusy ? "Aplicando…" : "Aplicar todos (IPC)"}
          </button>
        </div>
        <div style={styles.previewBox}>
          <div style={styles.previewLabel}>Vista previa — arrastra para mover (borrador)</div>
          <MonitorLayoutPreviewInteractive
            items={buildDragMons(rows, drafts)}
            focusedName={focusedName}
            onDragStart={onPreviewDragStart}
            onDragLive={onDragLive}
            onDragEnd={onDragEnd}
          />
        </div>
      </div>

      {gapOpen && (
        <div style={styles.gapBanner}>
          Hay huecos entre monitores: el cursor puede no cruzar entre salidas hasta que estén
          alineadas.
        </div>
      )}

      {err && <p style={{ color: ps.dangerText }}>{err}</p>}
      {msg && (
        <p style={{ color: msg.startsWith("Error") ? ps.dangerText : ps.successText }}>{msg}</p>
      )}

      <div style={styles.grid}>
        {rows.map((m) => {
          const d = drafts[m.id];
          const base = baseline[m.id];
          if (!d) return null;
          const modes = m.availableModes;
          const modeValue = currentModeToken(modes, d.width, d.height, d.refresh);
          const scales = computeValidScales(Math.max(1, d.width), Math.max(1, d.height));
          const scaleList = scales.length ? scales : [{ value: d.scale, label: `${d.scale}×` }];
          const si = nearestScaleIndex(scaleList, d.scale);
          const displayTitle =
            `${m.make} ${m.model}`.trim() || m.name;
          const dirty = !base || !draftsEqual(d, base);
          const mirrorDup = d.mirrorOf.trim() === m.name && d.mirrorOf.trim() !== "";

          return (
            <div key={m.id} style={{ ...psCard, ...styles.card }}>
              <div style={styles.cardHead}>
                <div style={styles.nameBlock}>
                  <div style={styles.name}>{displayTitle}</div>
                  <code style={styles.connector}>{m.name}</code>
                  {m.focused && <span style={styles.badge}>foco</span>}
                  {dirty && <span style={styles.dirtyBadge}>borrador</span>}
                </div>
                <button
                  type="button"
                  className="ps-btn-secondary"
                  style={{ fontSize: 11 }}
                  disabled={!dirty || !base}
                  onClick={() => discardOne(m.id)}
                >
                  Descartar
                </button>
              </div>
              {m.description ? (
                <div style={styles.desc} title={m.description}>
                  {m.description.length > 120 ? `${m.description.slice(0, 118)}…` : m.description}
                </div>
              ) : null}
              <label style={styles.rowCb}>
                <input
                  type="checkbox"
                  checked={d.disabled}
                  onChange={(e) => patchDraft(m.id, { disabled: e.target.checked })}
                />
                <span style={{ fontSize: 12, color: ps.textSecondary }}>Desactivado</span>
              </label>
              <div style={{ ...styles.form, opacity: d.disabled ? 0.5 : 1 }}>
                {modes.length > 0 && (
                  <label style={styles.lab}>
                    Modo EDID
                    <select
                      style={styles.in}
                      disabled={d.disabled}
                      value={modeValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__custom__") return;
                        const p = parseModeString(v);
                        if (p) patchDraft(m.id, { width: p.width, height: p.height, refresh: p.refresh });
                      }}
                    >
                      <option value="__custom__">Personalizado</option>
                      {modes.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label style={styles.lab}>
                  Ancho
                  <input
                    type="number"
                    style={styles.in}
                    value={d.width}
                    disabled={d.disabled}
                    onChange={(e) =>
                      patchDraft(m.id, { width: parseInt(e.target.value, 10) || 1 })
                    }
                  />
                </label>
                <label style={styles.lab}>
                  Alto
                  <input
                    type="number"
                    style={styles.in}
                    value={d.height}
                    disabled={d.disabled}
                    onChange={(e) =>
                      patchDraft(m.id, { height: parseInt(e.target.value, 10) || 1 })
                    }
                  />
                </label>
                <label style={styles.lab}>
                  Refresh (@…)
                  <input
                    style={styles.in}
                    value={d.refresh}
                    disabled={d.disabled}
                    onChange={(e) => patchDraft(m.id, { refresh: e.target.value })}
                  />
                </label>
                <label style={styles.lab}>
                  Escala (válida Hyprland)
                  <select
                    style={styles.in}
                    disabled={d.disabled || scaleList.length === 0}
                    value={si}
                    onChange={(e) => {
                      const idx = parseInt(e.target.value, 10);
                      const s = scaleList[idx]?.value;
                      if (s !== undefined) patchDraft(m.id, { scale: s });
                    }}
                  >
                    {scaleList.map((s, i) => (
                      <option key={`${s.value}-${i}`} value={i}>
                        {s.label} ({s.value.toFixed(4).replace(/\.?0+$/, "")})
                      </option>
                    ))}
                  </select>
                </label>
                <div style={styles.presetRow}>
                  <span style={styles.presetLab}>Escala rápida</span>
                  {SCALE_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="ps-btn-secondary"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                      disabled={d.disabled}
                      onClick={() => patchDraft(m.id, { scale: s })}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
                <label style={styles.lab}>
                  X / Y
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="number"
                      style={{ ...styles.in, flex: 1 }}
                      value={d.x}
                      disabled={d.disabled || Boolean(d.mirrorOf.trim())}
                      onChange={(e) => patchDraft(m.id, { x: parseInt(e.target.value, 10) || 0 })}
                    />
                    <input
                      type="number"
                      style={{ ...styles.in, flex: 1 }}
                      value={d.y}
                      disabled={d.disabled || Boolean(d.mirrorOf.trim())}
                      onChange={(e) => patchDraft(m.id, { y: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>
                </label>
                <label style={styles.lab}>
                  Transform
                  <select
                    style={styles.in}
                    value={d.transform}
                    disabled={d.disabled}
                    onChange={(e) =>
                      patchDraft(m.id, { transform: parseInt(e.target.value, 10) || 0 })
                    }
                  >
                    {MONITOR_TRANSFORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={styles.lab}>
                  Mirror →
                  <input
                    style={styles.in}
                    list={`mirror-dl-${m.id}`}
                    value={d.mirrorOf}
                    disabled={d.disabled}
                    placeholder="Vacío = sin mirror"
                    onChange={(e) => patchDraft(m.id, { mirrorOf: e.target.value })}
                  />
                  <datalist id={`mirror-dl-${m.id}`}>
                    {rows
                      .filter((r) => r.id !== m.id)
                      .map((r) => (
                        <option key={r.id} value={r.name} />
                      ))}
                  </datalist>
                </label>

                <details style={styles.advanced}>
                  <summary style={styles.sum}>Avanzado (VRR, bit depth, CM)</summary>
                  <label style={styles.lab}>
                    Bit depth
                    <select
                      style={styles.in}
                      disabled={d.disabled}
                      value={d.bitDepth}
                      onChange={(e) => patchDraft(m.id, { bitDepth: e.target.value })}
                    >
                      {BITDEPTH_OPTIONS.map((o) => (
                        <option key={o.value || "auto"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={styles.lab}>
                    VRR
                    <select
                      style={styles.in}
                      disabled={d.disabled}
                      value={d.vrr}
                      onChange={(e) => patchDraft(m.id, { vrr: e.target.value })}
                    >
                      {VRR_OPTIONS.map((o) => (
                        <option key={o.value || "off"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={styles.lab}>
                    Color management
                    <select
                      style={styles.in}
                      disabled={d.disabled}
                      value={d.cm}
                      onChange={(e) => patchDraft(m.id, { cm: e.target.value })}
                    >
                      {CM_OPTIONS.map((o) => (
                        <option key={o.value || "off"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </details>
              </div>
              {mirrorDup && (
                <p style={{ color: ps.dangerText, fontSize: 11, margin: "8px 0 0 0" }}>
                  El mirror no puede apuntar al mismo conector.
                </p>
              )}
              <button
                type="button"
                className="ps-btn-primary"
                style={{ marginTop: 12, width: "100%" }}
                disabled={backendStatus !== "ready" || mirrorDup}
                onClick={() => void applyMonitor(m)}
              >
                Aplicar monitor (IPC)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  topRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 20,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  toolbarCol: { display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" },
  previewBox: {
    flex: 1,
    minWidth: 200,
    maxWidth: 400,
  },
  previewLabel: {
    fontSize: 11,
    color: ps.textMuted,
    marginBottom: 6,
  },
  gapBanner: {
    padding: "10px 12px",
    marginBottom: 14,
    borderRadius: 4,
    border: `1px solid ${ps.warningBorder}`,
    background: ps.warningBg,
    color: ps.warningText,
    fontSize: 12,
    lineHeight: 1.45,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 },
  card: { padding: 14 },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  nameBlock: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 15,
    color: ps.textAccent,
    fontWeight: 500,
  },
  connector: { fontSize: 11, color: ps.textMono },
  badge: {
    fontSize: 10,
    textTransform: "uppercase",
    padding: "2px 6px",
    borderRadius: 3,
    background: ps.successBg,
    color: ps.successText,
    border: `1px solid ${ps.successBorder}`,
    marginLeft: 8,
  },
  dirtyBadge: {
    fontSize: 10,
    marginLeft: 8,
    padding: "2px 6px",
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    color: ps.textMuted,
  },
  desc: {
    fontSize: 11,
    color: ps.textMuted,
    lineHeight: 1.4,
    marginBottom: 10,
    maxHeight: 44,
    overflow: "hidden",
  },
  rowCb: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  form: { display: "flex", flexDirection: "column", gap: 8 },
  presetRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  presetLab: { fontSize: 10, color: ps.textMuted, width: "100%" },
  lab: { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: ps.textMuted },
  in: {
    padding: 6,
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceInput,
    color: ps.textPrimary,
    fontFamily: "inherit",
    fontSize: 13,
  },
  advanced: { marginTop: 10, paddingTop: 8, borderTop: `1px solid ${ps.borderSubtle}` },
  sum: { cursor: "pointer", fontSize: 12, color: ps.textAccent, marginBottom: 8 },
};

export default MonitorsPage;
