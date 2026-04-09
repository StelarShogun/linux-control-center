import { useState, type FC } from "react";
import type { AppSettings, AppearanceSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { saveSettings } from "../tauri/api";

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
      <h1 style={styles.heading}>Appearance</h1>
      <p style={styles.note}>
        Fase 2: settings cargados desde backend (si está disponible). No se aplica al sistema real.
      </p>
      {backendStatus === "unavailable" && (
        <p style={{ ...styles.note, marginTop: -24 }}>
          Backend no disponible (modo web build). Usando defaults locales.
        </p>
      )}
      {backendStatus === "loading" && (
        <p style={{ ...styles.note, marginTop: -24 }}>Cargando settings…</p>
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
        style={styles.saveBtn}
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
  page: { padding: "32px 40px", maxWidth: 640 },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 32 },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#88c0d0",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: "1px solid #2e3250",
  },
  field: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
  },
  label: { width: 120, fontSize: 13, color: "#9ca3af", flexShrink: 0 },
  control: { display: "flex", alignItems: "center", gap: 8 },
  select: {
    background: "#1e2030",
    border: "1px solid #2e3250",
    borderRadius: 6,
    color: "#e2e8f0",
    padding: "4px 8px",
    fontSize: 13,
  },
  textInput: {
    background: "#1e2030",
    border: "1px solid #2e3250",
    borderRadius: 6,
    color: "#e2e8f0",
    padding: "4px 8px",
    fontSize: 13,
    width: 200,
  },
  colorInput: { width: 36, height: 28, border: "none", cursor: "pointer" },
  colorValue: { fontSize: 13, color: "#9ca3af", fontFamily: "monospace" },
  unit: { fontSize: 12, color: "#6b7280" },
  saveBtn: {
    background: "#2e3250",
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 13,
    marginTop: 8,
  },
  message: {
    marginTop: 12,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    border: "1px solid #2e3250",
  },
  messageInfo: { background: "#151722", color: "#9ca3af" },
  messageSuccess: { background: "#0b1f1a", color: "#a7f3d0", borderColor: "#1f3a3a" },
  messageError: { background: "#1f0b0b", color: "#fecaca", borderColor: "#3a1f1f" },
  preview: {
    marginTop: 32,
    background: "#151722",
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: 16,
    fontSize: 12,
    color: "#6b7280",
    overflow: "auto",
  },
};

export default AppearancePage;
