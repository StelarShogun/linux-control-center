import { useCallback, useEffect, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import type { NetworkInterface } from "../types/generated";
import { listNetworkInterfaces } from "../tauri/api";
import { PAGE_BASE } from "../layout/pageLayout";

interface Props {
  backendStatus: BackendStatus;
}

const NetworkPage: FC<Props> = ({ backendStatus }) => {
  const [ifaces, setIfaces] = useState<NetworkInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (backendStatus !== "ready") return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listNetworkInterfaces();
      setIfaces(rows);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [backendStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Red</h1>
      <p style={styles.note}>
        Vista de solo lectura de interfaces (sin modificar configuración de red). Datos de{" "}
        <code>/proc/net/dev</code> y <code>ip addr show</code>.
      </p>
      {backendStatus !== "ready" && (
        <p style={styles.note}>Backend no disponible.</p>
      )}
      {backendStatus === "ready" && (
        <div style={styles.toolbar}>
          <button type="button" style={styles.btn} onClick={() => void load()} disabled={loading}>
            {loading ? "Actualizando…" : "Refrescar"}
          </button>
        </div>
      )}
      {error && <p style={{ ...styles.note, color: "#f87171" }}>{error}</p>}
      {backendStatus === "ready" && !loading && ifaces.length === 0 && !error && (
        <p style={styles.note}>No se detectaron interfaces (o <code>ip</code> no está disponible).</p>
      )}
      {ifaces.length > 0 && (
        <div style={styles.grid}>
          {ifaces.map((i) => (
            <div key={i.name} style={styles.card}>
              <div style={styles.cardTitle}>
                <strong>{i.name}</strong>
                <span style={styles.badge}>{i.kind}</span>
              </div>
              <div style={styles.row}>
                <span style={styles.k}>Estado</span>
                <span>{i.is_up ? "activa" : "inactiva"}</span>
              </div>
              {i.mac_address && (
                <div style={styles.row}>
                  <span style={styles.k}>MAC</span>
                  <code style={styles.mono}>{i.mac_address}</code>
                </div>
              )}
              <div style={styles.row}>
                <span style={styles.k}>IPv4</span>
                <span>
                  {i.ipv4_addresses.length > 0
                    ? i.ipv4_addresses.join(", ")
                    : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
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
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 },
  card: {
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: 14,
    background: "#12141c",
  },
  cardTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  badge: { fontSize: 10, color: "#88c0d0", textTransform: "uppercase" },
  row: { display: "flex", gap: 8, fontSize: 12, color: "#d1d5db", marginBottom: 6 },
  k: { color: "#6b7280", minWidth: 56 },
  mono: { fontSize: 11, color: "#9ca3af" },
};

export default NetworkPage;
