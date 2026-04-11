import { useCallback, useEffect, useState, type FC } from "react";
import type { AppSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import type { ThemePresetSummary } from "../types/generated/ThemePresetSummary";
import type { ThemeVariant } from "../types/generated/ThemeVariant";
import {
  applyTheme,
  getCurrentSettings,
  getThemePreview,
  listThemePresets,
} from "../tauri/api";
import type { ThemePreviewDto } from "../tauri/types";
import OpMessage, { type OpMsg } from "../components/OpMessage";
import { PAGE_BASE } from "../layout/pageLayout";

type PreviewTab = "hyprland" | "waybar_jsonc" | "waybar_css" | "rofi";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

const ThemeManagerPage: FC<Props> = ({ onSettingsChange, backendStatus }) => {
  const [presets, setPresets] = useState<ThemePresetSummary[]>([]);
  const [presetId, setPresetId] = useState<string>("");
  const [variant, setVariant] = useState<ThemeVariant>("dark");
  const [applyHyprland, setApplyHyprland] = useState(true);
  const [applyWaybarConfig, setApplyWaybarConfig] = useState(true);
  const [applyWaybarStyle, setApplyWaybarStyle] = useState(true);
  const [applyRofi, setApplyRofi] = useState(true);
  const [reloadHyprland, setReloadHyprland] = useState(true);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("hyprland");
  const [preview, setPreview] = useState<ThemePreviewDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<OpMsg | null>(null);

  useEffect(() => {
    if (backendStatus !== "ready") return;
    void listThemePresets()
      .then((list) => {
        setPresets(list);
        setPresetId((cur) => cur || list[0]?.id || "");
      })
      .catch((e) => setMessage({ kind: "error", text: String(e) }));
  }, [backendStatus]);

  const refreshPreview = useCallback(async () => {
    if (backendStatus !== "ready" || !presetId) return;
    try {
      const p = await getThemePreview({ preset_id: presetId, variant });
      setPreview(p);
    } catch (e) {
      setPreview(null);
      setMessage({ kind: "error", text: `Vista previa: ${String(e)}` });
    }
  }, [backendStatus, presetId, variant]);

  useEffect(() => {
    void refreshPreview();
  }, [refreshPreview]);

  const previewText = (): string => {
    if (!preview) return "";
    switch (previewTab) {
      case "hyprland":
        return preview.hyprland;
      case "waybar_jsonc":
        return preview.waybar_jsonc;
      case "waybar_css":
        return preview.waybar_css;
      case "rofi":
        return preview.rofi;
      default: {
        const _x: never = previewTab;
        return _x;
      }
    }
  };

  const handleApply = async () => {
    if (backendStatus !== "ready" || !presetId) return;
    setBusy(true);
    setMessage({ kind: "info", text: "Aplicando tema…" });
    try {
      const res = await applyTheme({
        preset_id: presetId,
        variant,
        apply_hyprland: applyHyprland,
        apply_waybar_config: applyWaybarConfig,
        apply_waybar_style: applyWaybarStyle,
        apply_rofi: applyRofi,
        reload_hyprland: reloadHyprland,
      });
      const failed = [
        applyRofi && res.rofi && !res.rofi.ok,
        applyWaybarStyle && res.waybar_style && !res.waybar_style.ok,
        applyWaybarConfig && res.waybar_config && !res.waybar_config.ok,
        applyHyprland && res.hyprland && !res.hyprland.ok,
      ].some(Boolean);
      const next = await getCurrentSettings();
      onSettingsChange(next);
      if (failed) {
        setMessage({
          kind: "error",
          text:
            "Tema aplicado con errores parciales. Revisa destinos fallidos y el journal. Los settings en memoria ya reflejan el preset.",
        });
      } else {
        setMessage({
          kind: "success",
          text: `Tema aplicado. Snapshot previo: ${res.pre_snapshot_id.slice(0, 8)}…`,
        });
      }
    } catch (e) {
      setMessage({ kind: "error", text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Theme Manager</h1>
      <p style={styles.note}>
        Presets builtin con tokens compartidos: Hyprland (include gestionado),{" "}
        <code>config.jsonc</code> + <code>style.css</code> de Waybar, y Rofi (
        <code>config.rasi</code>). Se crea un snapshot global antes de escribir y uno por destino
        con backup.
      </p>

      {backendStatus !== "ready" && (
        <p style={styles.note}>Backend no disponible: ejecuta la app con Tauri.</p>
      )}

      {backendStatus === "ready" && (
        <>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Preset</h2>
            <div style={styles.row}>
              <label style={styles.label}>Preset</label>
              <select
                style={styles.select}
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.builtin ? "" : " (custom)"}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.row}>
              <label style={styles.label}>Variante</label>
              <select
                style={styles.select}
                value={variant}
                onChange={(e) => setVariant(e.target.value as ThemeVariant)}
              >
                <option value="dark">Oscuro</option>
                <option value="light">Claro</option>
              </select>
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Destinos</h2>
            <div style={styles.checkGrid}>
              <label style={styles.check}>
                <input
                  type="checkbox"
                  checked={applyHyprland}
                  onChange={(e) => setApplyHyprland(e.target.checked)}
                />
                Hyprland (generated conf)
              </label>
              <label style={styles.check}>
                <input
                  type="checkbox"
                  checked={reloadHyprland}
                  onChange={(e) => setReloadHyprland(e.target.checked)}
                  disabled={!applyHyprland}
                />
                hyprctl reload tras Hyprland
              </label>
              <label style={styles.check}>
                <input
                  type="checkbox"
                  checked={applyWaybarConfig}
                  onChange={(e) => setApplyWaybarConfig(e.target.checked)}
                />
                Waybar <code>config.jsonc</code>
              </label>
              <label style={styles.check}>
                <input
                  type="checkbox"
                  checked={applyWaybarStyle}
                  onChange={(e) => setApplyWaybarStyle(e.target.checked)}
                />
                Waybar <code>style.css</code>
              </label>
              <label style={styles.check}>
                <input
                  type="checkbox"
                  checked={applyRofi}
                  onChange={(e) => setApplyRofi(e.target.checked)}
                />
                Rofi <code>config.rasi</code>
              </label>
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Vista previa</h2>
            <div style={styles.tabs}>
              {(
                [
                  ["hyprland", "Hyprland"],
                  ["waybar_jsonc", "Waybar JSONC"],
                  ["waybar_css", "Waybar CSS"],
                  ["rofi", "Rofi"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  style={{
                    ...styles.tab,
                    ...(previewTab === id ? styles.tabActive : {}),
                  }}
                  onClick={() => setPreviewTab(id)}
                >
                  {label}
                </button>
              ))}
              <button type="button" style={styles.tabGhost} onClick={() => void refreshPreview()}>
                Actualizar
              </button>
            </div>
            <pre style={styles.pre}>{previewText() || "…"}</pre>
          </section>

          <div style={styles.actions}>
            <button
              type="button"
              style={styles.applyBtn}
              disabled={busy || !presetId}
              onClick={() => void handleApply()}
            >
              {busy ? "Aplicando…" : "Aplicar tema"}
            </button>
          </div>
        </>
      )}

      <OpMessage message={message} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  heading: { fontSize: 22, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" },
  note: { fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: "#88c0d0", marginBottom: 12 },
  row: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 },
  label: { width: 100, fontSize: 13, color: "#9ca3af" },
  select: {
    flex: 1,
    maxWidth: 360,
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #3d4466",
    background: "#151722",
    color: "#e2e8f0",
    fontSize: 13,
  },
  checkGrid: { display: "flex", flexDirection: "column", gap: 8 },
  check: { fontSize: 13, color: "#cbd5e1", display: "flex", alignItems: "center", gap: 8 },
  tabs: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tab: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #3d4466",
    background: "#1a1d2e",
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 12,
  },
  tabActive: { borderColor: "#88c0d0", color: "#e2e8f0", background: "#252840" },
  tabGhost: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px dashed #4b5563",
    background: "transparent",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: 12,
    marginLeft: "auto",
  },
  pre: {
    margin: 0,
    padding: 14,
    borderRadius: 8,
    background: "#0f1118",
    border: "1px solid #2e3250",
    fontSize: 11,
    lineHeight: 1.45,
    overflow: "auto",
    maxHeight: "min(58vh, 560px)",
    color: "#a5b4fc",
    fontFamily: "ui-monospace, monospace",
  },
  actions: { marginTop: 8 },
  applyBtn: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: "#0f766e",
    color: "#ecfdf5",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
};

export default ThemeManagerPage;
