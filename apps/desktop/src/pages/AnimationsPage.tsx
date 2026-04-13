import { useEffect, useMemo, useState, type FC } from "react";
import type { AppSettings, HyprlandBezierCurve } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { hyprctlSetKeyword, hyprctlVersionJson, saveSettings } from "../tauri/api";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";
import { BUILTIN_BEZIER_PRESETS, bezierLine } from "../hyprland/bezierPresets";
import { BezierEditorCanvas } from "../hyprland/BezierEditorCanvas";
import {
  ANIMATION_ROW_DEFS,
  animationDefsByGroup,
  buildAnimationKeywordValue,
  HYPR_ANIMATIONS_DOC_URL,
} from "../hyprland/animationRows";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

const emptyCurve = (): HyprlandBezierCurve => ({
  name: "mi_curva",
  x1: 0.25,
  y1: 0.1,
  x2: 0.25,
  y2: 1.0,
});

type AnimRowState = { enabled: boolean; speed: number; curve: string; style: string };

const initialAnimRows = (): Record<string, AnimRowState> => {
  const o: Record<string, AnimRowState> = {};
  for (const d of ANIMATION_ROW_DEFS) {
    o[d.id] = { enabled: true, speed: 5, curve: "default", style: "default" };
  }
  return o;
};

const animationDefKey = ANIMATION_ROW_DEFS.map((d) => d.id).join("|");

const AnimationsPage: FC<Props> = ({ settings, onSettingsChange, backendStatus }) => {
  const curves = settings.hyprland.bezier_curves;
  const [draft, setDraft] = useState<HyprlandBezierCurve>(emptyCurve);
  const [animRows, setAnimRows] = useState<Record<string, AnimRowState>>(initialAnimRows);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ipcBusy, setIpcBusy] = useState<string | null>(null);
  const [hyprVersionLine, setHyprVersionLine] = useState<string | null>(null);

  const curveNameOptions = useMemo(() => {
    const builtin = Object.keys(BUILTIN_BEZIER_PRESETS);
    const custom = curves.map((c) => c.name).filter(Boolean);
    return ["default", ...builtin, ...custom];
  }, [curves]);

  const animGroups = useMemo(() => animationDefsByGroup(), []);

  useEffect(() => {
    setAnimRows((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const d of ANIMATION_ROW_DEFS) {
        if (!next[d.id]) {
          next[d.id] = { enabled: true, speed: 5, curve: "default", style: "default" };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [animationDefKey]);

  useEffect(() => {
    if (backendStatus !== "ready") {
      setHyprVersionLine(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const raw = await hyprctlVersionJson();
        if (cancelled) return;
        const j = JSON.parse(raw) as { version?: string; tag?: string };
        const tag = (j.tag ?? "").trim();
        const ver = (j.version ?? "").trim();
        const line =
          tag && ver && tag !== ver
            ? `${tag} (core ${ver})`
            : tag || (ver ? `Hyprland ${ver}` : raw.slice(0, 120).trim());
        setHyprVersionLine(line || null);
      } catch {
        if (!cancelled) setHyprVersionLine(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backendStatus]);

  const setCurves = (next: HyprlandBezierCurve[]) => {
    onSettingsChange({
      ...settings,
      hyprland: { ...settings.hyprland, bezier_curves: next },
    });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const s = await saveSettings({ settings });
      onSettingsChange(s);
      setMsg("Guardado.");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = (t: string) => {
    void navigator.clipboard.writeText(t);
    setMsg("Copiado al portapapeles.");
  };

  const applyBezierIpc = async () => {
    if (backendStatus !== "ready") {
      setMsg("El backend no está listo.");
      return;
    }
    const nm = draft.name.trim();
    if (!nm) {
      setMsg("Indica un nombre de curva.");
      return;
    }
    setIpcBusy("bezier");
    setMsg(null);
    try {
      const value = `${nm},${draft.x1},${draft.y1},${draft.x2},${draft.y2}`;
      const out = await hyprctlSetKeyword("bezier", value);
      setMsg(out.trim() || "Curva aplicada en Hyprland (IPC).");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setIpcBusy(null);
    }
  };

  const applyAnimationIpc = async (rowId: string) => {
    if (backendStatus !== "ready") {
      setMsg("El backend no está listo.");
      return;
    }
    const row = animRows[rowId];
    if (!row) return;
    setIpcBusy(`anim:${rowId}`);
    setMsg(null);
    try {
      const value = buildAnimationKeywordValue(
        rowId,
        row.enabled,
        row.speed,
        row.curve,
        row.style
      );
      const out = await hyprctlSetKeyword("animation", value);
      setMsg(out.trim() || `animation ${rowId} aplicado (IPC).`);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setIpcBusy(null);
    }
  };

  const patchAnimRow = (rowId: string, patch: Partial<AnimRowState>) => {
    setAnimRows((prev) => {
      const cur = prev[rowId];
      if (!cur) return prev;
      return { ...prev, [rowId]: { ...cur, ...patch } };
    });
  };

  return (
    <div style={styles.page}>
      <h1 style={PAGE_HEADING}>Animaciones y Bézier</h1>
      <p style={PAGE_NOTE}>
        Presets inspirados en HyprMod; las curvas propias se guardan en la app (
        <code>settings.toml</code>). Copia la línea <code>bezier = …</code> a tu config Hyprland si
        no usas solo el include gestionado.
      </p>
      <label style={styles.row}>
        <input
          type="checkbox"
          checked={settings.hyprland.animations_enabled}
          onChange={(e) =>
            onSettingsChange({
              ...settings,
              hyprland: { ...settings.hyprland, animations_enabled: e.target.checked },
            })
          }
        />
        <span style={{ fontSize: 13, color: ps.textSecondary }}>Animaciones habilitadas (modelo)</span>
      </label>
      {msg && (
        <p style={{ color: msg.startsWith("Error") ? ps.dangerText : ps.successText }}>{msg}</p>
      )}
      <div style={styles.toolbar}>
        <button type="button" className="ps-btn-primary" disabled={busy || backendStatus !== "ready"} onClick={() => void save()}>
          {busy ? "Guardando…" : "Guardar en la app"}
        </button>
      </div>

      <h2 style={styles.h2}>Animaciones por categoría (IPC)</h2>
      <p style={PAGE_NOTE}>
        Formato según{" "}
        <a href={HYPR_ANIMATIONS_DOC_URL} target="_blank" rel="noreferrer">
          Animations (Hyprland 0.54)
        </a>
        : <code>NAME,ONOFF</code> y, si está activada, <code>NAME,1,SPEED,CURVE</code> o con estilo{" "}
        <code>NAME,1,SPEED,CURVE,STYLE</code>. Si la animación está desactivada solo se envía{" "}
        <code>NAME,0</code> (el resto de argumentos se omite, como indica la wiki).
        {hyprVersionLine ? (
          <>
            {" "}
            Compositor detectado: <code>{hyprVersionLine}</code>.
          </>
        ) : backendStatus === "ready" ? (
          <> No se pudo leer la versión con hyprctl (¿Hyprland en ejecución?).</>
        ) : null}{" "}
        Velocidad en décimas de segundo (1 ds = 100 ms). Curva: nombre de una línea{" "}
        <code>bezier</code> definida o preset.
      </p>
      <div style={styles.animOuter}>
        {animGroups.map((group) => (
          <div key={group.groupTitle}>
            <h3 style={styles.animGroupTitle}>{group.groupTitle}</h3>
            <div style={styles.animGrid}>
              {group.defs.map((def) => {
                const row = animRows[def.id];
                if (!row) return null;
                const rowBusy = ipcBusy === `anim:${def.id}`;
                return (
                  <div key={def.id} style={{ ...psCard, ...styles.animCard }}>
                    <div style={styles.animHead}>
                      <span style={styles.animLabel}>{def.label}</span>
                      <code style={styles.animId}>{def.id}</code>
                    </div>
                    <label style={styles.row}>
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => patchAnimRow(def.id, { enabled: e.target.checked })}
                      />
                      <span style={{ fontSize: 12, color: ps.textSecondary }}>Activada</span>
                    </label>
                    <div style={styles.fieldRow}>
                      <label style={styles.labWide}>Velocidad</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        style={styles.inNum}
                        value={row.speed}
                        onChange={(e) =>
                          patchAnimRow(def.id, { speed: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div style={styles.fieldRow}>
                      <label style={styles.labWide}>Curva</label>
                      <select
                        style={styles.in}
                        value={row.curve}
                        onChange={(e) => patchAnimRow(def.id, { curve: e.target.value })}
                      >
                        {curveNameOptions.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                        {!curveNameOptions.includes(row.curve) && row.curve ? (
                          <option value={row.curve}>{row.curve}</option>
                        ) : null}
                      </select>
                    </div>
                    <div style={styles.fieldRow}>
                      <label style={styles.labWide}>Estilo</label>
                      <input
                        style={styles.in}
                        value={row.style}
                        onChange={(e) => patchAnimRow(def.id, { style: e.target.value })}
                        placeholder="default"
                      />
                    </div>
                    <button
                      type="button"
                      className="ps-btn-secondary"
                      style={styles.btnSm}
                      disabled={rowBusy || backendStatus !== "ready"}
                      onClick={() => void applyAnimationIpc(def.id)}
                    >
                      {rowBusy ? "…" : "Aplicar (IPC)"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <h2 style={styles.h2}>Presets</h2>
      <div style={styles.presetGrid}>
        {Object.entries(BUILTIN_BEZIER_PRESETS).map(([name, pts]) => {
          const line = bezierLine(name, pts[0], pts[1], pts[2], pts[3]);
          return (
            <div key={name} style={{ ...psCard, ...styles.presetCard }}>
              <code style={styles.presetName}>{name}</code>
              <BezierPreview x1={pts[0]} y1={pts[1]} x2={pts[2]} y2={pts[3]} />
              <button type="button" className="ps-btn-secondary" style={styles.btnSm} onClick={() => copy(line)}>
                Copiar línea
              </button>
            </div>
          );
        })}
      </div>

      <h2 style={styles.h2}>Tus curvas</h2>
      <div style={{ ...psCard, ...styles.editor }}>
        <div style={styles.editorTop}>
          <BezierEditorCanvas
            value={{ x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2 }}
            onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
            size={200}
          />
          <div style={styles.editorFields}>
            <div style={styles.fieldRow}>
              <label style={styles.lab}>Nombre</label>
              <input
                style={styles.in}
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            {(["x1", "y1", "x2", "y2"] as const).map((k) => (
              <div key={k} style={styles.fieldRow}>
                <label style={styles.lab}>{k}</label>
                <input
                  type="range"
                  min={-1}
                  max={2}
                  step={0.01}
                  value={draft[k]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [k]: parseFloat(e.target.value) || 0 }))
                  }
                  style={{ flex: 1 }}
                />
                <span style={styles.num}>{draft[k].toFixed(2)}</span>
              </div>
            ))}
            <BezierPreview x1={draft.x1} y1={draft.y1} x2={draft.x2} y2={draft.y2} />
          </div>
        </div>
        <div style={styles.editorActions}>
          <button
            type="button"
            className="ps-btn-primary"
            onClick={() => {
              setCurves([...curves, { ...draft }]);
              setDraft(emptyCurve());
            }}
          >
            Añadir curva
          </button>
          <button
            type="button"
            className="ps-btn-secondary"
            disabled={ipcBusy === "bezier" || backendStatus !== "ready"}
            onClick={() => void applyBezierIpc()}
          >
            {ipcBusy === "bezier" ? "Aplicando…" : "Aplicar Bézier (IPC)"}
          </button>
        </div>
      </div>
      <ul style={styles.ul}>
        {curves.map((c, i) => (
          <li key={`${c.name}-${i}`} style={styles.li}>
            <code>{bezierLine(c.name, c.x1, c.y1, c.x2, c.y2)}</code>
            <button
              type="button"
              className="ps-btn-secondary"
              style={styles.btnSm}
              onClick={() => copy(bezierLine(c.name, c.x1, c.y1, c.x2, c.y2))}
            >
              Copiar
            </button>
            <button
              type="button"
              style={styles.btnDel}
              onClick={() => setCurves(curves.filter((_, j) => j !== i))}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const BezierPreview: FC<{ x1: number; y1: number; x2: number; y2: number }> = ({
  x1,
  y1,
  x2,
  y2,
}) => {
  const w = 120;
  const h = 120;
  const pad = 8;
  const pts: string[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const ox = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3;
    const oy = 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
    const px = pad + ox * (w - 2 * pad);
    const py = h - pad - oy * (h - 2 * pad);
    pts.push(`${px},${py}`);
  }
  const d = `M ${pts.join(" L ")}`;
  return (
    <svg width={w} height={h} style={{ display: "block", marginTop: 8 }}>
      <rect width={w} height={h} fill={ps.surfaceCode} stroke={ps.borderStrong} />
      <path d={d} fill="none" stroke={ps.blue} strokeWidth={2} />
    </svg>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  toolbar: { marginBottom: 16 },
  h2: {
    fontSize: 14,
    fontWeight: 300,
    color: ps.textAccent,
    marginTop: 24,
    marginBottom: 12,
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 10,
  },
  presetCard: { padding: 10 },
  presetName: { fontSize: 12, color: ps.textMono },
  editor: { padding: 16, marginBottom: 16 },
  editorTop: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  editorFields: { flex: 1, minWidth: 220 },
  editorActions: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" },
  animOuter: { display: "flex", flexDirection: "column", gap: 20, marginBottom: 8 },
  animGroupTitle: {
    fontSize: 13,
    fontWeight: 300,
    color: ps.textAccent,
    margin: "0 0 10px 0",
    borderBottom: `1px solid ${ps.borderSubtle}`,
    paddingBottom: 6,
  },
  animGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 10,
  },
  animCard: { padding: 12 },
  animHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 8,
  },
  animLabel: { fontSize: 13, color: ps.textPrimary },
  animId: { fontSize: 10, color: ps.textMono },
  labWide: { width: 72, fontSize: 12, color: ps.textMuted, flexShrink: 0 },
  inNum: {
    width: 80,
    padding: 6,
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceInput,
    color: ps.textPrimary,
  },
  fieldRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  lab: { width: 32, fontSize: 12, color: ps.textMuted },
  in: {
    flex: 1,
    padding: 6,
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceInput,
    color: ps.textPrimary,
  },
  num: { width: 40, fontSize: 11, fontFamily: "monospace", color: ps.textSecondary },
  row: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  btnSm: { fontSize: 11, padding: "4px 8px" },
  btnDel: {
    fontSize: 11,
    marginLeft: 8,
    padding: "4px 8px",
    borderRadius: 3,
    border: `1px solid ${ps.dangerBorder}`,
    background: ps.dangerBg,
    color: ps.dangerText,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  ul: { listStyle: "none", padding: 0, margin: 0 },
  li: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderBottom: `1px solid ${ps.borderSubtle}`,
    fontSize: 11,
    fontFamily: "monospace",
  },
};

export default AnimationsPage;
