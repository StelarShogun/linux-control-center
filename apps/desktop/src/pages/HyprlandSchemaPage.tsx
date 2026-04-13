import { useEffect, useMemo, useState, type FC } from "react";
import type { AppSettings, HyprlandSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { hyprctlDevicesJson, hyprctlSetKeyword } from "../tauri/api";
import SchemaCatalogPanel from "../components/hyprland/SchemaCatalogPanel";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";
import { OptionRow, optionInputStyle, optionRangeStyle } from "../components/hyprland/OptionRow";
import {
  flattenSchemaOptions,
  loadHyprlandOptionsSchema,
  MIN_SCHEMA_QUERY_LENGTH,
  searchSchemaOptions,
  type HyprlandOptionsSchema,
} from "../hyprland/schemaLoader";
import {
  SCHEMA_TO_SETTINGS,
  applyBridgeToSettings,
  getBridgeForSchemaKey,
  isMappedSchemaKey,
} from "../hyprland/schemaSettingsBridge";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
  focusSchemaKey?: string | null;
  onConsumedFocusSchemaKey?: () => void;
}

type Tab = "integrated" | "explorer" | "catalog";

const HyprlandSchemaPage: FC<Props> = ({
  settings,
  onSettingsChange,
  backendStatus,
  focusSchemaKey,
  onConsumedFocusSchemaKey,
}) => {
  const hypr = settings.hyprland;
  const [schema, setSchema] = useState<HyprlandOptionsSchema | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("integrated");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [hasTouchpad, setHasTouchpad] = useState(true);

  const patchHyprland = (next: HyprlandSettings) => {
    onSettingsChange({ ...settings, hyprland: next });
  };

  const mergeSchemaOverride = (key: string, value: string) => {
    const ov = { ...(settings.hyprland.schema_overrides ?? {}), [key]: value };
    onSettingsChange({
      ...settings,
      hyprland: { ...settings.hyprland, schema_overrides: ov },
    });
  };

  useEffect(() => {
    if (backendStatus !== "ready") return;
    let cancelled = false;
    void hyprctlDevicesJson()
      .then((raw) => {
        if (cancelled) return;
        try {
          const s = JSON.stringify(JSON.parse(raw) as unknown).toLowerCase();
          setHasTouchpad(s.includes("touchpad"));
        } catch {
          setHasTouchpad(true);
        }
      })
      .catch(() => {
        if (!cancelled) setHasTouchpad(true);
      });
    return () => {
      cancelled = true;
    };
  }, [backendStatus]);

  useEffect(() => {
    let cancelled = false;
    loadHyprlandOptionsSchema()
      .then((s) => {
        if (!cancelled) setSchema(s);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const flat = useMemo(() => (schema ? flattenSchemaOptions(schema) : []), [schema]);

  useEffect(() => {
    if (!focusSchemaKey || !flat.length) return;
    setTab("catalog");
    const id = `schema-row-${focusSchemaKey}`;
    queueMicrotask(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      onConsumedFocusSchemaKey?.();
    });
  }, [focusSchemaKey, flat, onConsumedFocusSchemaKey]);

  const explorerResults = useMemo(() => searchSchemaOptions(flat, q).slice(0, 80), [flat, q]);

  const applyKeyword = async (key: string, raw: string) => {
    if (backendStatus !== "ready") return;
    setMsg(null);
    try {
      await hyprctlSetKeyword(key, raw);
      mergeSchemaOverride(key, raw);
      setMsg(`keyword ${key} aplicado.`);
    } catch (e) {
      setMsg(`Error: ${String(e)}`);
    }
  };

  const applyMappedLive = async (schemaKey: string) => {
    const b = getBridgeForSchemaKey(schemaKey);
    if (!b) return;
    const v = b.get(hypr);
    await applyKeyword(schemaKey, b.toKeywordValue(v));
  };

  return (
    <div style={styles.page}>
      <h1 style={PAGE_HEADING}>Opciones Hyprland (schema)</h1>
      <p style={PAGE_NOTE}>
        <strong>Integrado</strong>: opciones mapeadas a <code>HyprlandSettings</code>.{" "}
        <strong>Catálogo IPC</strong>: el resto de claves del schema con controles según{" "}
        <code>type</code>, lectura con <code>getoption</code> y escritura con <code>keyword</code>.{" "}
        <strong>Explorador</strong>: búsqueda y valor crudo manual.
      </p>
      {loadErr && <p style={{ color: ps.dangerText }}>{loadErr}</p>}
      {msg && (
        <p style={{ color: msg.startsWith("Error") ? ps.dangerText : ps.successText }}>{msg}</p>
      )}

      <div style={styles.tabs}>
        <button
          type="button"
          className={tab === "integrated" ? "ps-btn-primary" : "ps-btn-secondary"}
          onClick={() => setTab("integrated")}
        >
          Integrado (LCC)
        </button>
        <button
          type="button"
          className={tab === "catalog" ? "ps-btn-primary" : "ps-btn-secondary"}
          onClick={() => setTab("catalog")}
        >
          Catálogo IPC (schema)
        </button>
        <button
          type="button"
          className={tab === "explorer" ? "ps-btn-primary" : "ps-btn-secondary"}
          onClick={() => setTab("explorer")}
        >
          Explorador schema
        </button>
      </div>

      {tab === "integrated" && (
        <div style={{ ...psCard, ...styles.panel }}>
          <h2 style={styles.h2}>Opciones enlazadas al modelo</h2>
          {!hasTouchpad && (
            <p style={{ fontSize: 12, color: ps.textMuted }}>
              No se detectó touchpad en <code>hyprctl devices</code>; la fila de touchpad está
              oculta.
            </p>
          )}
          {SCHEMA_TO_SETTINGS.filter(
            (m) => hasTouchpad || !m.schemaKey.toLowerCase().includes("touchpad")
          ).map((m) => {
            const v = m.get(hypr);
            const desc = flat.find((o) => o.key === m.schemaKey)?.description;
            return (
              <OptionRow
                key={m.schemaKey}
                title={`${m.label} (${m.schemaKey})`}
                description={desc}
                actions={
                  <>
                    <button
                      type="button"
                      className="ps-btn-secondary"
                      style={{ fontSize: 12 }}
                      disabled={backendStatus !== "ready"}
                      onClick={() => void applyMappedLive(m.schemaKey)}
                    >
                      IPC vivo
                    </button>
                  </>
                }
              >
                {m.kind === "int" && (
                  <>
                    <input
                      type="range"
                      style={optionRangeStyle}
                      min={m.min ?? 0}
                      max={m.max ?? 100}
                      value={Number(v)}
                      onChange={(e) =>
                        patchHyprland(
                          applyBridgeToSettings(hypr, m.schemaKey, Number(e.target.value))
                        )
                      }
                    />
                    <input
                      type="number"
                      style={{ ...optionInputStyle, width: 56 }}
                      min={m.min}
                      max={m.max}
                      value={Number(v)}
                      onChange={(e) =>
                        patchHyprland(
                          applyBridgeToSettings(hypr, m.schemaKey, e.target.value)
                        )
                      }
                    />
                  </>
                )}
                {m.kind === "float" && (
                  <input
                    type="range"
                    style={optionRangeStyle}
                    min={m.min ?? -1}
                    max={m.max ?? 1}
                    step={m.step ?? 0.05}
                    value={Number(v)}
                    onChange={(e) =>
                      patchHyprland(
                        applyBridgeToSettings(hypr, m.schemaKey, parseFloat(e.target.value) || 0)
                      )
                    }
                  />
                )}
                {m.kind === "bool" && (
                  <input
                    type="checkbox"
                    checked={Boolean(v)}
                    onChange={(e) =>
                      patchHyprland(applyBridgeToSettings(hypr, m.schemaKey, e.target.checked))
                    }
                  />
                )}
                {m.kind === "color" && (
                  <input
                    type="color"
                    style={{ width: 40, height: 28, border: "none", cursor: "pointer" }}
                    value={String(v).startsWith("#") ? String(v) : "#88c0d0"}
                    onChange={(e) =>
                      patchHyprland(applyBridgeToSettings(hypr, m.schemaKey, e.target.value))
                    }
                  />
                )}
                {m.kind === "string" && (
                  <input
                    style={{ ...optionInputStyle, minWidth: 160 }}
                    value={String(v)}
                    onChange={(e) =>
                      patchHyprland(applyBridgeToSettings(hypr, m.schemaKey, e.target.value))
                    }
                  />
                )}
              </OptionRow>
            );
          })}
        </div>
      )}

      {tab === "catalog" && schema && (
        <div style={{ ...psCard, ...styles.panel }}>
          <SchemaCatalogPanel
            schema={schema}
            flat={flat}
            backendStatus={backendStatus}
            onToast={(m, err) => setMsg(err ? `Error: ${m}` : m)}
            onPersistOverride={mergeSchemaOverride}
          />
        </div>
      )}

      {tab === "explorer" && (
        <>
          <input
            type="search"
            placeholder={`Buscar en schema (≥${MIN_SCHEMA_QUERY_LENGTH} caracteres)…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={styles.search}
            disabled={!schema}
          />
          <div style={styles.list}>
            {explorerResults.map((opt) => (
              <div key={opt.key} style={{ ...psCard, ...styles.card }}>
                <div style={styles.cardHead}>
                  <code style={styles.code}>{opt.key}</code>
                  {isMappedSchemaKey(opt.key) && (
                    <span style={styles.badge}>también en Integrado</span>
                  )}
                </div>
                <div style={styles.meta}>
                  {opt.groupLabel} › {opt.sectionLabel}
                </div>
                <div style={styles.label}>{opt.label}</div>
                {opt.description && <div style={styles.desc}>{opt.description}</div>}
                <div style={styles.row}>
                  <input
                    style={styles.valIn}
                    placeholder="Valor para keyword"
                    value={values[opt.key] ?? ""}
                    onChange={(e) =>
                      setValues((m) => ({
                        ...m,
                        [opt.key]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="ps-btn-primary"
                    disabled={backendStatus !== "ready"}
                    onClick={() => void applyKeyword(opt.key, values[opt.key] ?? "")}
                  >
                    keyword
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  tabs: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  panel: { padding: 16, marginBottom: 24 },
  h2: { fontSize: 14, color: ps.textAccent, fontWeight: 300, marginTop: 0, marginBottom: 8 },
  search: {
    width: "100%",
    maxWidth: 400,
    marginBottom: 16,
    padding: "8px 12px",
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceInput,
    color: ps.textPrimary,
    fontSize: 13,
    fontFamily: "inherit",
  },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: { padding: 14 },
  cardHead: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  code: { fontSize: 12, color: ps.textMono },
  badge: {
    fontSize: 10,
    color: ps.textMuted,
    border: `1px solid ${ps.borderStrong}`,
    borderRadius: 3,
    padding: "2px 6px",
  },
  meta: { fontSize: 11, color: ps.textMuted, marginTop: 4 },
  label: { fontSize: 14, color: ps.textPrimary, marginTop: 6 },
  desc: { fontSize: 12, color: ps.textSecondary, marginTop: 4, lineHeight: 1.45 },
  row: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  valIn: {
    flex: 1,
    minWidth: 120,
    padding: 6,
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceCode,
    color: ps.textPrimary,
    fontFamily: "monospace",
    fontSize: 12,
  },
};

export default HyprlandSchemaPage;
