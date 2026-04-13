import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import type { BackendStatus } from "../../types/backend";
import { hyprctlGetOption, hyprctlSetKeyword } from "../../tauri/api";
import { ps } from "../../theme/playstationDark";
import { psCard } from "../../theme/componentStyles";
import { OptionRow, optionInputStyle, optionRangeStyle } from "./OptionRow";
import type { FlatSchemaOption, HyprlandOptionsSchema } from "../../hyprland/schemaLoader";
import {
  defaultDraftString,
  formatKeywordValueFromSchema,
  isDependencySatisfied,
  mappedIntegrationSchemaKeys,
  parseHyprctlGetOption,
} from "../../hyprland/schemaGenericIpc";

interface Props {
  schema: HyprlandOptionsSchema;
  flat: FlatSchemaOption[];
  backendStatus: BackendStatus;
  onToast: (msg: string, isError?: boolean) => void;
  onPersistOverride?: (key: string, value: string) => void;
}

const SchemaCatalogPanel: FC<Props> = ({ schema, flat, backendStatus, onToast, onPersistOverride }) => {
  const mapped = useMemo(() => mappedIntegrationSchemaKeys(), []);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  /** Resultado de comprobación por lotes al expandir una sección (`hyprctl getoption`). */
  const [availability, setAvailability] = useState<Record<string, "ok" | "err" | "pending">>({});
  const probedSectionsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!flat.length) return;
    setDraftValues((prev) => {
      const next = { ...prev };
      for (const o of flat) {
        if (next[o.key] === undefined) {
          next[o.key] = defaultDraftString(o);
        }
      }
      return next;
    });
  }, [flat]);

  const setDraft = useCallback((key: string, v: string) => {
    setDraftValues((m) => ({ ...m, [key]: v }));
  }, []);

  const readOption = async (opt: FlatSchemaOption) => {
    if (backendStatus !== "ready") return;
    setBusyKey(opt.key);
    try {
      const raw = await hyprctlGetOption(opt.key);
      const parsed = parseHyprctlGetOption(raw);
      if (parsed === null) {
        onToast(`getoption ${opt.key}: respuesta no reconocida`, true);
      } else {
        setDraft(opt.key, parsed);
        onToast(`Leído: ${opt.key}`);
      }
    } catch (e) {
      onToast(String(e), true);
    } finally {
      setBusyKey(null);
    }
  };

  const applyOption = async (opt: FlatSchemaOption) => {
    if (backendStatus !== "ready") return;
    const raw = draftValues[opt.key] ?? "";
    const value = formatKeywordValueFromSchema(opt, raw);
    setBusyKey(opt.key);
    try {
      await hyprctlSetKeyword(opt.key, value);
      onPersistOverride?.(opt.key, value);
      onToast(`keyword ${opt.key} aplicado.`);
    } catch (e) {
      onToast(String(e), true);
    } finally {
      setBusyKey(null);
    }
  };

  const flatByKey = useMemo(() => {
    const m = new Map<string, FlatSchemaOption>();
    for (const o of flat) m.set(o.key, o);
    return m;
  }, [flat]);

  const probeKeysBatch = useCallback(
    async (keys: string[]) => {
      if (backendStatus !== "ready") return;
      const uniq = [...new Set(keys)].filter((k) => !mapped.has(k));
      const chunkSize = 4;
      for (let i = 0; i < uniq.length; i += chunkSize) {
        const chunk = uniq.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (key) => {
            setAvailability((a) => ({ ...a, [key]: "pending" }));
            try {
              const raw = await hyprctlGetOption(key);
              const parsed = parseHyprctlGetOption(raw);
              setAvailability((a) => ({ ...a, [key]: parsed === null ? "err" : "ok" }));
            } catch {
              setAvailability((a) => ({ ...a, [key]: "err" }));
            }
          })
        );
      }
    },
    [backendStatus, mapped]
  );

  const renderControl = (opt: FlatSchemaOption, depOk: boolean, avail: "ok" | "err" | "pending" | undefined) => {
    const v = draftValues[opt.key] ?? "";
    const t = (opt.type ?? "").toLowerCase();
    const dis = !depOk || avail === "err";
    if (t === "choice" && opt.values && opt.values.length > 0) {
      return (
        <select
          style={{ ...optionInputStyle, minWidth: 160 }}
          value={v}
          disabled={dis}
          onChange={(e) => setDraft(opt.key, e.target.value)}
        >
          {opt.values.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      );
    }
    if (t === "int" && opt.min !== undefined && opt.max !== undefined) {
      const n = parseInt(v, 10);
      const num = Number.isNaN(n) ? opt.min : n;
      return (
        <>
          <input
            type="range"
            style={optionRangeStyle}
            min={opt.min}
            max={opt.max}
            value={num}
            disabled={dis}
            onChange={(e) => setDraft(opt.key, e.target.value)}
          />
          <input
            type="number"
            style={{ ...optionInputStyle, width: 64 }}
            min={opt.min}
            max={opt.max}
            value={num}
            disabled={dis}
            onChange={(e) => setDraft(opt.key, e.target.value)}
          />
        </>
      );
    }
    if (t === "float" && opt.min !== undefined && opt.max !== undefined) {
      const n = parseFloat(v);
      const num = Number.isNaN(n) ? opt.min : n;
      return (
        <input
          type="range"
          style={optionRangeStyle}
          min={opt.min}
          max={opt.max}
          step={0.05}
          value={num}
          onChange={(e) => setDraft(opt.key, e.target.value)}
        />
      );
    }
    if (t === "bool") {
      const on = ["true", "1", "yes", "on"].includes(v.trim().toLowerCase());
      return (
        <input
          type="checkbox"
          checked={on}
          disabled={dis}
          onChange={(e) => setDraft(opt.key, e.target.checked ? "true" : "false")}
        />
      );
    }
    if (t === "color") {
      if (v.startsWith("#") && /^#[0-9a-fA-F]{6}$/.test(v.trim())) {
        return (
          <input
            type="color"
            style={{ width: 44, height: 28, border: "none", cursor: "pointer" }}
            value={v.trim()}
            disabled={dis}
            onChange={(e) => setDraft(opt.key, e.target.value)}
          />
        );
      }
      return (
        <input
          style={{ ...optionInputStyle, minWidth: 220, flex: 1 }}
          value={v}
          placeholder="rgba(…) o #RRGGBB"
          onChange={(e) => setDraft(opt.key, e.target.value)}
        />
      );
    }
    return (
      <input
        style={{ ...optionInputStyle, minWidth: 200, flex: 1 }}
        value={v}
        disabled={dis}
        onChange={(e) => setDraft(opt.key, e.target.value)}
      />
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 12, color: ps.textSecondary, margin: 0, lineHeight: 1.5 }}>
        Opciones del JSON de schema <strong>no</strong> enlazadas al modelo LCC. Los valores por
        defecto vienen del schema; usa <strong>Leer IPC</strong> para traer el valor del compositor
        (<code>hyprctl getoption</code>) y <strong>Aplicar IPC</strong> para{" "}
        <code>hyprctl keyword</code>. Las filas con dependencia se atenúan si el padre parece
        desactivado (valor en este catálogo). Al <strong>expandir una sección</strong> se comprueba
        por lotes si Hyprland expone cada opción vía <code>getoption</code> (marca “no disponible” si
        falla).
      </p>
      {schema.groups
        .filter((g) => g.hidden !== true)
        .map((group) => {
          const sections = group.sections
            .map((sec) => ({
              ...sec,
              options: sec.options.filter((o) => !mapped.has(o.key)),
            }))
            .filter((sec) => sec.options.length > 0);
          if (sections.length === 0) return null;
          return (
            <details key={group.id} style={styles.details} open>
              <summary style={styles.summary}>{group.label}</summary>
              {sections.map((sec) => (
                <details
                  key={sec.id}
                  style={{ marginTop: 12, marginLeft: 8 }}
                  onToggle={(e) => {
                    const el = e.currentTarget;
                    if (!el.open || backendStatus !== "ready") return;
                    const sid = `${group.id}:${sec.id}`;
                    if (probedSectionsRef.current.has(sid)) return;
                    probedSectionsRef.current.add(sid);
                    const keys = sec.options.map((o) => o.key);
                    void probeKeysBatch(keys);
                  }}
                >
                  <summary style={{ ...styles.secTitle, cursor: "pointer", userSelect: "none" }}>
                    {sec.label}
                  </summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                    {sec.options.map((rawOpt) => {
                      const opt = flatByKey.get(rawOpt.key);
                      if (!opt) return null;
                      const depOk = isDependencySatisfied(opt, draftValues);
                      const busy = busyKey === opt.key;
                      const av = availability[opt.key];
                      const availTag =
                        av === "err" ? (
                          <span style={{ color: ps.dangerText, fontSize: 11, marginLeft: 6 }}>
                            no disponible
                          </span>
                        ) : av === "pending" ? (
                          <span style={{ color: ps.textMuted, fontSize: 11, marginLeft: 6 }}>
                            comprobando…
                          </span>
                        ) : av === "ok" ? (
                          <span style={{ color: ps.successText, fontSize: 11, marginLeft: 6 }}>
                            getoption OK
                          </span>
                        ) : null;
                      return (
                        <div
                          id={`schema-row-${opt.key}`}
                          key={opt.key}
                          style={{
                            ...psCard,
                            padding: 12,
                            opacity: depOk ? 1 : 0.45,
                          }}
                        >
                          <OptionRow
                            title={
                              <>
                                {opt.label} ({opt.key}){availTag}
                              </>
                            }
                            description={opt.description}
                            actions={
                              <>
                                <button
                                  type="button"
                                  className="ps-btn-secondary"
                                  style={{ fontSize: 11 }}
                                  disabled={backendStatus !== "ready" || busy}
                                  onClick={() => void readOption(opt)}
                                >
                                  Leer IPC
                                </button>
                                <button
                                  type="button"
                                  className="ps-btn-primary"
                                  style={{ fontSize: 11 }}
                                  disabled={
                                    backendStatus !== "ready" || busy || !depOk || av === "err"
                                  }
                                  onClick={() => void applyOption(opt)}
                                >
                                  Aplicar IPC
                                </button>
                              </>
                            }
                          >
                            {renderControl(opt, depOk, av)}
                          </OptionRow>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </details>
          );
        })}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  details: {
    border: `1px solid ${ps.borderStrong}`,
    borderRadius: 6,
    padding: "8px 12px",
    background: ps.surfacePanel,
  },
  summary: {
    cursor: "pointer",
    fontSize: 14,
    color: ps.textAccent,
    fontWeight: 300,
  },
  secTitle: {
    fontSize: 12,
    color: ps.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
};

export default SchemaCatalogPanel;
