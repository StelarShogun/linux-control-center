import { useState, type FC } from "react";
import type { AppSettings, AppearanceSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { saveSettings } from "../tauri/api";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

const AppearancePage: FC<Props> = ({ settings, onSettingsChange, backendStatus }) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<
    { kind: "info" | "success" | "error"; text: string } | null
  >(null);
  const local = settings.appearance;
  const update = <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K]
  ) =>
    onSettingsChange({
      ...settings,
      appearance: { ...settings.appearance, [key]: value },
    });

  return (
    <div style={styles.page}>
      <h1 style={PAGE_HEADING}>Apariencia</h1>
      <p style={PAGE_NOTE}>
        Ajustes de tema, fuente y cursor guardados en la app. Usa «Sync desde sistema» en la barra superior
        para importar valores actuales de Hyprland/Waybar/Rofi cuando el backend esté activo.
      </p>
      {backendStatus === "unavailable" && (
        <p style={{ ...PAGE_NOTE, marginTop: -24 }}>
          Backend no disponible (modo web build). Usando defaults locales.
        </p>
      )}
      {backendStatus === "loading" && (
        <p style={{ ...PAGE_NOTE, marginTop: -24 }}>Cargando settings…</p>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Theme</h2>
        <Field label="Theme">
          <select
            style={styles.select}
            value={local.theme}
            onChange={(e) => update("theme", e.target.value)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </Field>
        <Field label="Accent color">
          <input
            type="color"
            style={styles.colorInput}
            value={local.accent_color}
            onChange={(e) => update("accent_color", e.target.value)}
          />
          <span style={styles.colorValue}>{local.accent_color}</span>
        </Field>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Font</h2>
        <Field label="Font family">
          <input
            type="text"
            style={styles.textInput}
            value={local.font_family}
            onChange={(e) => update("font_family", e.target.value)}
          />
        </Field>
        <Field label="Font size">
          <input
            type="number"
            style={{ ...styles.textInput, width: 80 }}
            min={6}
            max={24}
            value={local.font_size}
            onChange={(e) => update("font_size", Number(e.target.value))}
          />
          <span style={styles.unit}>pt</span>
        </Field>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Icons & Cursor</h2>
        <Field label="Icon theme">
          <input
            type="text"
            style={styles.textInput}
            value={local.icon_theme}
            onChange={(e) => update("icon_theme", e.target.value)}
          />
        </Field>
        <Field label="Cursor theme">
          <input
            type="text"
            style={styles.textInput}
            value={local.cursor_theme}
            onChange={(e) => update("cursor_theme", e.target.value)}
          />
        </Field>
        <Field label="Cursor size">
          <input
            type="number"
            style={{ ...styles.textInput, width: 80 }}
            min={8}
            max={64}
            value={local.cursor_size}
            onChange={(e) => update("cursor_size", Number(e.target.value))}
          />
          <span style={styles.unit}>px</span>
        </Field>
      </section>

      <button
        type="button"
        className="ps-btn-primary"
        style={{ marginTop: 12 }}
        disabled={backendStatus !== "ready" || busy}
        onClick={async () => {
          const ok = window.confirm(
            "¿Guardar los cambios de Appearance?\n\nEsto guarda settings en la app (no aplica cambios al sistema real)."
          );
          if (!ok) return;

          setBusy(true);
          setMessage({ kind: "info", text: "Guardando…" });
          try {
            const saved = await saveSettings({ settings });
            onSettingsChange(saved);
            setMessage({ kind: "success", text: "Guardado." });
          } catch (e) {
            setMessage({ kind: "error", text: `Error: ${String(e)}` });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Save"}
      </button>

      {message && (
        <div
          style={{
            ...styles.message,
            ...(message.kind === "success"
              ? styles.messageSuccess
              : message.kind === "error"
                ? styles.messageError
                : styles.messageInfo),
          }}
        >
          {message.text}
        </div>
      )}

      <pre style={styles.preview}>{JSON.stringify(local, null, 2)}</pre>
    </div>
  );
};

const Field: FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={styles.field}>
    <label style={styles.label}>{label}</label>
    <div style={styles.control}>{children}</div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  section: { marginBottom: 36 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 300,
    color: ps.textAccent,
    letterSpacing: "0.02em",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: `1px solid ${ps.borderDefault}`,
  },
  field: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
  },
  label: { width: 120, fontSize: 13, color: ps.textMuted, flexShrink: 0 },
  control: { display: "flex", alignItems: "center", gap: 8 },
  select: {
    background: ps.surfaceInput,
    border: `1px solid ${ps.borderStrong}`,
    borderRadius: 3,
    color: ps.textPrimary,
    padding: "6px 10px",
    fontSize: 13,
  },
  textInput: {
    background: ps.surfaceInput,
    border: `1px solid ${ps.borderStrong}`,
    borderRadius: 3,
    color: ps.textPrimary,
    padding: "6px 10px",
    fontSize: 13,
    width: 200,
  },
  colorInput: { width: 36, height: 28, border: "none", cursor: "pointer" },
  colorValue: { fontSize: 13, color: ps.textMuted, fontFamily: "monospace" },
  unit: { fontSize: 12, color: ps.textMuted },
  message: {
    marginTop: 12,
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    border: "1px solid",
  },
  messageInfo: { background: ps.infoBg, color: ps.infoText, borderColor: ps.infoBorder },
  messageSuccess: {
    background: ps.successBg,
    color: ps.successText,
    borderColor: ps.successBorder,
  },
  messageError: {
    background: ps.dangerBg,
    color: ps.dangerText,
    borderColor: ps.dangerBorder,
  },
  preview: {
    marginTop: 36,
    ...psCard,
    padding: 16,
    fontSize: 12,
    color: ps.textMuted,
    overflow: "auto",
    maxHeight: "min(45vh, 420px)",
  },
};

export default AppearancePage;
