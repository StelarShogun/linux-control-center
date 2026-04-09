import { useCallback, useEffect, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import type { PowerProfileKind, PowerStatus } from "../types/generated";
import { getPowerStatus, setPowerProfile } from "../tauri/api";

interface Props {
  backendStatus: BackendStatus;
}

const PROFILE_OPTIONS: { kind: PowerProfileKind; label: string }[] = [
  { kind: "performance", label: "Rendimiento" },
  { kind: "balanced", label: "Equilibrado" },
  { kind: "power_saver", label: "Ahorro" },
];

const PowerPage: FC<Props> = ({ backendStatus }) => {
  const [status, setStatus] = useState<PowerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (backendStatus !== "ready") return;
    try {
      const s = await getPowerStatus();
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [backendStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (backendStatus !== "ready") return;
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [backendStatus, load]);

  const apply = async (kind: PowerProfileKind) => {
    if (kind === "unknown" || backendStatus !== "ready") return;
    setBusy(true);
    setError(null);
    try {
      await setPowerProfile(kind);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Energía</h1>
      <p style={styles.note}>
        Perfil vía <code>powerprofilesctl</code> y lectura de batería desde sysfs cuando exista. Sin shell
        arbitrario.
      </p>
      {backendStatus !== "ready" && (
        <p style={styles.note}>Backend no disponible.</p>
      )}
      {backendStatus === "ready" && (
        <div style={styles.toolbar}>
          <button type="button" style={styles.btn} onClick={() => void load()} disabled={busy}>
            Refrescar ahora
          </button>
        </div>
      )}
      {error && <p style={{ ...styles.note, color: "#f87171" }}>{error}</p>}
      {status && (
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.k}>Fuente</span>
            <span>{status.source}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.k}>Perfil activo</span>
            <code style={styles.mono}>{status.profile_label || status.profile}</code>
          </div>
          {status.battery_percent != null && (
            <div style={styles.row}>
              <span style={styles.k}>Batería</span>
              <span>{status.battery_percent}%</span>
            </div>
          )}
          {status.on_ac != null && (
            <div style={styles.row}>
              <span style={styles.k}>AC</span>
              <span>{status.on_ac ? "conectado" : "no"}</span>
            </div>
          )}
        </div>
      )}
      {backendStatus === "ready" && (
        <div style={styles.section}>
          <h2 style={styles.h2}>Cambiar perfil</h2>
          <div style={styles.btns}>
            {PROFILE_OPTIONS.map((o) => (
              <button
                key={o.kind}
                type="button"
                style={styles.profileBtn}
                disabled={busy}
                onClick={() => void apply(o.kind)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p style={styles.hint}>Requiere <code>powerprofilesctl</code> en el PATH.</p>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "32px 40px", maxWidth: 640 },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 },
  toolbar: { marginBottom: 16 },
  btn: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid #3d4466",
    background: "#252840",
    color: "#a0aec0",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  },
  card: {
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: 16,
    background: "#12141c",
    marginBottom: 24,
  },
  row: { display: "flex", gap: 12, fontSize: 13, color: "#d1d5db", marginBottom: 8 },
  k: { color: "#6b7280", minWidth: 120 },
  mono: { color: "#88c0d0" },
  section: { marginTop: 8 },
  h2: { fontSize: 14, color: "#88c0d0", marginBottom: 12 },
  btns: { display: "flex", flexWrap: "wrap", gap: 10 },
  profileBtn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #3d5a50",
    background: "#15201c",
    color: "#86efac",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  },
  hint: { fontSize: 11, color: "#6b7280", marginTop: 12 },
};

export default PowerPage;
