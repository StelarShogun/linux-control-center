import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import type { AppSettings, HyprlandBind } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { hyprctlBindsJson, hyprctlSetKeyword } from "../tauri/api";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { BindEditDialog } from "../hyprland/BindEditDialog";
import {
  CATEGORY_BY_ID,
  DIALOG_CATEGORIES,
  categorizeDispatcher,
  formatAction,
} from "../hyprland/dispatchers";
import { buildBindKeywordRest, buildUnbindKeywordRest } from "../hyprland/bindKeyword";
import {
  bindRuntimeStatus,
  findRuntimeOverride,
  parseHyprctlBindsJson,
  type HyprctlBindEntry,
} from "../hyprland/bindRuntime";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

const emptyBind = (): HyprlandBind => ({
  modifiers: ["SUPER"],
  key: "",
  dispatcher: "exec",
  args: "",
  description: "",
  enabled: true,
  bind_type: "bind",
});

type ModalState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; index: number };

const KeybindingsPage: FC<Props> = ({ settings, onSettingsChange, backendStatus }) => {
  const binds = settings.hyprland.keyboard.binds;
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [runtime, setRuntime] = useState<HyprctlBindEntry[]>([]);
  const [runtimeErr, setRuntimeErr] = useState<string | null>(null);
  const undoBinds = useRef<string[]>([]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const loadRuntime = useCallback(async () => {
    if (backendStatus !== "ready") return;
    setRuntimeErr(null);
    try {
      const raw = await hyprctlBindsJson();
      setRuntime(parseHyprctlBindsJson(raw));
    } catch (e) {
      setRuntime([]);
      setRuntimeErr(String(e));
    }
  }, [backendStatus]);

  useEffect(() => {
    void loadRuntime();
  }, [loadRuntime]);

  const commitBinds = (next: HyprlandBind[]) => {
    const cur = settingsRef.current;
    undoBinds.current = [
      ...undoBinds.current.slice(-29),
      JSON.stringify(cur.hyprland.keyboard.binds),
    ];
    onSettingsChange({
      ...cur,
      hyprland: {
        ...cur.hyprland,
        keyboard: { binds: next },
      },
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      e.preventDefault();
      const prev = undoBinds.current.pop();
      if (prev === undefined) return;
      try {
        const parsed = JSON.parse(prev) as HyprlandBind[];
        const cur = settingsRef.current;
        onSettingsChange({
          ...cur,
          hyprland: {
            ...cur.hyprland,
            keyboard: { binds: parsed },
          },
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSettingsChange]);

  const indexedFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return binds
      .map((b, idx) => ({ b, idx }))
      .filter(({ b }) => {
        if (!q) return true;
        const hay = [
          b.modifiers.join(" "),
          b.key,
          b.dispatcher,
          b.args,
          b.description,
          b.bind_type,
          formatAction(b.dispatcher, b.args),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [binds, search]);

  const byCategory = useMemo(() => {
    const m = new Map<string, { b: HyprlandBind; idx: number }[]>();
    const catOrder = [...DIALOG_CATEGORIES.map((c) => c.id), "advanced"];
    for (const id of catOrder) {
      m.set(id, []);
    }
    for (const row of indexedFiltered) {
      const cid = categorizeDispatcher(row.b.dispatcher);
      const bucket = m.get(cid) ?? m.get("advanced")!;
      bucket.push(row);
    }
    return m;
  }, [indexedFiltered]);

  const applyLiveOne = async (b: HyprlandBind) => {
    if (backendStatus !== "ready" || !b.enabled) return;
    setMsg(null);
    try {
      const kw = (b.bind_type || "bind").trim() || "bind";
      await hyprctlSetKeyword(kw, buildBindKeywordRest(b));
      setMsg(`IPC: ${kw} aplicado.`);
      await loadRuntime();
    } catch (e) {
      setMsg(`Error IPC: ${String(e)}`);
    }
  };

  const adoptRuntimeForIndex = (idx: number, rt: HyprctlBindEntry) => {
    const next = [...binds];
    const cur = next[idx];
    if (!cur) return;
    next[idx] = {
      ...cur,
      dispatcher: rt.dispatcher,
      args: String(rt.arg ?? ""),
    };
    commitBinds(next);
    setMsg("Acción del compositor copiada al modelo guardado en la app.");
  };

  const unbindLiveOne = async (b: HyprlandBind) => {
    if (backendStatus !== "ready") return;
    setMsg(null);
    try {
      await hyprctlSetKeyword("unbind", buildUnbindKeywordRest(b));
      setMsg("IPC: unbind aplicado.");
      await loadRuntime();
    } catch (e) {
      setMsg(`Error unbind: ${String(e)}`);
    }
  };

  const modalInitial = useMemo(() => {
    if (modal.mode === "edit") return binds[modal.index] ?? emptyBind();
    return emptyBind();
  }, [modal, binds]);

  return (
    <div style={styles.page} data-no-global-undo>
      <h1 style={PAGE_HEADING}>Atajos (Hyprland)</h1>
      <p style={PAGE_NOTE}>
        Editor al estilo HyprMod: categorías por dispatcher, comparación con{" "}
        <code>hyprctl binds -j</code>, e IPC en vivo con <code>hyprctl keyword</code>. Los atajos se
        exportan en el include gestionado al aplicar config. <strong>Guardar en disco</strong> usa el
        banner superior o <kbd>Ctrl+S</kbd> cuando haya cambios pendientes.
      </p>
      {msg && (
        <p
          style={{
            ...PAGE_NOTE,
            color: msg.startsWith("Error") ? ps.dangerText : ps.successText,
          }}
        >
          {msg}
        </p>
      )}
      {runtimeErr && (
        <p style={{ ...PAGE_NOTE, color: ps.warningText }}>
          No se pudo leer binds en vivo: {runtimeErr}
        </p>
      )}
      <div style={styles.toolbar}>
        <input
          type="search"
          placeholder="Buscar atajos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchIn}
        />
        <button type="button" className="ps-btn-secondary" onClick={() => void loadRuntime()}>
          Refrescar binds en vivo
        </button>
        <button
          type="button"
          className="ps-btn-secondary"
          onClick={() => {
            setModal({ mode: "add" });
          }}
        >
          Añadir atajo
        </button>
      </div>

      {binds.length === 0 ? (
        <div style={styles.emptyPanel}>
          <p style={PAGE_NOTE}>No hay atajos en la app todavía.</p>
          <p style={styles.noteMuted}>
            Pulsa «Añadir atajo» o sincroniza desde la barra superior si tu config ya tiene binds.
          </p>
        </div>
      ) : (
        <div style={styles.scroll}>
          {[...DIALOG_CATEGORIES.map((c) => c.id), "advanced"].map((catId) => {
            const rows = byCategory.get(catId) ?? [];
            if (rows.length === 0) return null;
            const label = CATEGORY_BY_ID[catId]?.label ?? catId;
            return (
              <section key={catId} style={styles.catSection}>
                <h2 style={styles.catTitle}>{label}</h2>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Act.</th>
                        <th style={styles.th}>Tipo</th>
                        <th style={styles.th}>Mods</th>
                        <th style={styles.th}>Tecla</th>
                        <th style={styles.th}>Acción</th>
                        <th style={styles.th}>Runtime</th>
                        <th style={styles.th}>IPC</th>
                        <th style={styles.th} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ b, idx }) => {
                        const rt = findRuntimeOverride(b, runtime);
                        const rtState = bindRuntimeStatus(b, runtime);
                        return (
                          <tr key={idx}>
                            <td style={styles.td}>
                              <input
                                type="checkbox"
                                checked={b.enabled}
                                onChange={(e) => {
                                  const next = [...binds];
                                  next[idx] = { ...b, enabled: e.target.checked };
                                  commitBinds(next);
                                }}
                              />
                            </td>
                            <td style={styles.tdMono}>
                              <select
                                style={styles.inSm}
                                value={b.bind_type || "bind"}
                                onChange={(e) => {
                                  const next = [...binds];
                                  next[idx] = { ...b, bind_type: e.target.value };
                                  commitBinds(next);
                                }}
                              >
                                {[
                                  "bind",
                                  "bindl",
                                  "binde",
                                  "bindm",
                                  "bindr",
                                  "bindn",
                                  "bindd",
                                  "binddr",
                                ].map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={styles.tdMono}>{b.modifiers.join(" ")}</td>
                            <td style={styles.tdMono}>{b.key}</td>
                            <td style={styles.tdMono}>{formatAction(b.dispatcher, b.args)}</td>
                            <td style={styles.td}>
                              {rtState === "no_runtime" && (
                                <span style={{ fontSize: 11, color: ps.textMuted }} title="No hay bind en vivo para este combo">
                                  Sin runtime
                                </span>
                              )}
                              {rtState === "sync" && rt && (
                                <span style={{ fontSize: 11, color: ps.successText }} title={`${rt.dispatcher} ${rt.arg ?? ""}`}>
                                  En sync
                                </span>
                              )}
                              {rtState === "override" && rt && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 220 }}>
                                  <span style={styles.overrideBadge} title={`Runtime: ${rt.dispatcher} ${rt.arg ?? ""}`}>
                                    Override en compositor
                                  </span>
                                  <button
                                    type="button"
                                    style={styles.btnMini}
                                    disabled={backendStatus !== "ready" || !b.enabled || !b.key.trim()}
                                    onClick={() => void adoptRuntimeForIndex(idx, rt)}
                                  >
                                    Adoptar runtime
                                  </button>
                                  <button
                                    type="button"
                                    style={styles.btnMiniMuted}
                                    disabled={backendStatus !== "ready" || !b.enabled || !b.key.trim()}
                                    onClick={() => void applyLiveOne(b)}
                                    title="Vuelve a aplicar la acción guardada en la app"
                                  >
                                    Reaplicar guardado
                                  </button>
                                </div>
                              )}
                            </td>
                            <td style={styles.td}>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  style={styles.btnMini}
                                  disabled={backendStatus !== "ready" || !b.enabled || !b.key.trim()}
                                  onClick={() => void applyLiveOne(b)}
                                >
                                  Live
                                </button>
                                <button
                                  type="button"
                                  style={styles.btnMiniMuted}
                                  disabled={backendStatus !== "ready" || !b.key.trim()}
                                  onClick={() => void unbindLiveOne(b)}
                                >
                                  Unbind
                                </button>
                              </div>
                            </td>
                            <td style={styles.td}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  type="button"
                                  className="ps-btn-secondary"
                                  style={{ fontSize: 11, padding: "4px 8px" }}
                                  onClick={() => setModal({ mode: "edit", index: idx })}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  style={styles.btnDanger}
                                  onClick={() => commitBinds(binds.filter((_, i) => i !== idx))}
                                >
                                  Quitar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <BindEditDialog
        title={modal.mode === "edit" ? "Editar atajo" : "Nuevo atajo"}
        open={modal.mode === "add" || modal.mode === "edit"}
        initial={modalInitial}
        onClose={() => setModal({ mode: "closed" })}
        onSave={(b) => {
          if (modal.mode === "add") {
            commitBinds([...binds, b]);
          } else if (modal.mode === "edit") {
            const next = [...binds];
            next[modal.index] = b;
            commitBinds(next);
          }
          setModal({ mode: "closed" });
        }}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    ...PAGE_BASE,
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  noteMuted: { fontSize: 12, color: ps.textDisabled, marginTop: 8, lineHeight: 1.5 },
  emptyPanel: {
    flex: 1,
    minHeight: 200,
    padding: 28,
    borderRadius: 12,
    border: `1px dashed ${ps.borderStrong}`,
    background: ps.surfacePanel,
  },
  scroll: { overflow: "auto", flex: 1, minHeight: 0, width: "100%" },
  catSection: { marginBottom: 28 },
  catTitle: {
    fontSize: 14,
    fontWeight: 300,
    color: ps.textAccent,
    marginBottom: 10,
    letterSpacing: "0.02em",
  },
  tableWrap: { overflow: "auto", width: "100%" },
  toolbar: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" },
  searchIn: {
    flex: 1,
    minWidth: 160,
    maxWidth: 320,
    padding: "8px 12px",
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceInput,
    color: ps.textPrimary,
    fontSize: 13,
    fontFamily: "inherit",
  },
  btnDanger: {
    padding: "4px 10px",
    fontSize: 11,
    borderRadius: 3,
    border: `1px solid ${ps.dangerBorder}`,
    background: ps.dangerBg,
    color: ps.dangerText,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnMini: {
    padding: "3px 8px",
    fontSize: 10,
    borderRadius: 3,
    border: `1px solid ${ps.successBorder}`,
    background: ps.successBg,
    color: ps.successText,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnMiniMuted: {
    padding: "3px 8px",
    fontSize: 10,
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceRaised,
    color: ps.textSecondary,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: {
    textAlign: "left",
    padding: 8,
    background: ps.surfaceInput,
    color: ps.textAccent,
    borderBottom: `1px solid ${ps.borderDefault}`,
  },
  td: { padding: 8, borderBottom: `1px solid ${ps.borderSubtle}`, verticalAlign: "middle" },
  tdMono: { padding: 8, borderBottom: `1px solid ${ps.borderSubtle}`, fontFamily: "monospace", fontSize: 11 },
  inSm: {
    padding: 2,
    background: ps.surfaceCode,
    border: `1px solid ${ps.borderStrong}`,
    borderRadius: 3,
    color: ps.textPrimary,
    fontFamily: "monospace",
    fontSize: 10,
    maxWidth: 88,
  },
  overrideBadge: {
    fontSize: 10,
    color: ps.warningText,
    background: ps.warningBg,
    border: `1px solid ${ps.warningBorder}`,
    borderRadius: 3,
    padding: "2px 6px",
  },
};

export default KeybindingsPage;
