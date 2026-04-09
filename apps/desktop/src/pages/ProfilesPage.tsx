import { useState, type FC } from "react";
import type { AppSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { saveProfile } from "../tauri/api";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

const ProfilesPage: FC<Props> = ({ settings, backendStatus }) => {
  const [name, setName] = useState("Saved profile");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<{ kind: "info" | "success" | "error"; text: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Profiles</h1>
      <p style={styles.note}>
        Fase 2: snapshots y perfiles persistidos localmente vía backend. No se aplica al sistema real.
      </p>

      {backendStatus === "unavailable" && (
        <div style={styles.limitationBox}>
          <strong>Backend no disponible.</strong> Snapshots/perfiles requieren ejecutar la app vía Tauri.
        </div>
      )}
      {backendStatus === "loading" && (
        <div style={styles.limitationBox}>Cargando backend…</div>
      )}

      <section>
        <h2 style={styles.detailTitle}>Save profile</h2>
        <p style={{ ...styles.note, marginBottom: 12 }}>
          Guarda los settings actuales como perfil en disco (local app data).
        </p>
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

        <div style={styles.formRow}>
          <label style={styles.formLabel}>Name</label>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={backendStatus !== "ready" || busy}
          />
        </div>
        <div style={styles.formRow}>
          <label style={styles.formLabel}>Description</label>
          <input
            style={styles.input}
            value={description}
            placeholder="opcional"
            onChange={(e) => setDescription(e.target.value)}
            disabled={backendStatus !== "ready" || busy}
          />
        </div>
        <button
          style={styles.primaryBtn}
          disabled={backendStatus !== "ready" || busy}
          onClick={async () => {
            setBusy(true);
            setMessage({ kind: "info", text: "Guardando perfil…" });
            try {
              const trimmed = name.trim();
              const ok = window.confirm(
                `¿Guardar un perfil nuevo?\n\nNombre: ${trimmed.length > 0 ? trimmed : "(vacío)"}`
              );
              if (!ok) {
                setMessage(null);
                return;
              }
              const finalName = trimmed.length > 0 ? trimmed : "Saved profile";
              const finalDesc = description.trim().length > 0 ? description.trim() : null;
              await saveProfile({ name: finalName, description: finalDesc, settings });
              setMessage({ kind: "success", text: "Perfil guardado." });
            } catch (e) {
              setMessage({ kind: "error", text: `Error: ${String(e)}` });
            } finally {
              setBusy(false);
            }
          }}
        >
          Save profile from current settings
        </button>
      </section>

      <pre style={styles.preview}>{JSON.stringify(settings, null, 2)}</pre>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "32px 40px", maxWidth: 900 },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 32 },
  detailTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#e2e8f0",
    marginBottom: 16,
  },
  limitationBox: {
    background: "#1a1d2e",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: 16,
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 20,
  },
  message: {
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    marginBottom: 12,
    border: "1px solid #2e3250",
  },
  messageInfo: { background: "#151722", color: "#9ca3af" },
  messageSuccess: { background: "#0b1f1a", color: "#a7f3d0", borderColor: "#1f3a3a" },
  messageError: { background: "#1f0b0b", color: "#fecaca", borderColor: "#3a1f1f" },
  formRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  formLabel: { width: 90, fontSize: 12, color: "#9ca3af" },
  input: {
    flex: 1,
    background: "#1e2030",
    border: "1px solid #2e3250",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "8px 10px",
    fontSize: 13,
  },
  preview: {
    background: "#151722",
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: 16,
    fontSize: 11,
    color: "#6b7280",
    overflow: "auto",
    maxHeight: 320,
  },
  primaryBtn: {
    background: "#2e3250",
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 13,
  },
  secondaryBtn: {
    background: "none",
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 13,
  },
};

export default ProfilesPage;
