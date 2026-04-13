import { useCallback, useEffect, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import type { NetworkInterface } from "../types/generated";
import { listNetworkInterfaces } from "../tauri/api";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";

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
      <h1 style={PAGE_HEADING}>Red</h1>
      <p style={PAGE_NOTE}>
        Vista de solo lectura de interfaces (sin modificar configuración de red). Datos de{" "}
        <code>/proc/net/dev</code> y <code>ip addr show</code>.
      </p>
      {backendStatus !== "ready" && (
        <p style={PAGE_NOTE}>Backend no disponible.</p>
      )}
      {backendStatus === "ready" && (
        <div style={styles.toolbar}>
          <button
            type="button"
            className="ps-btn-secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Actualizando…" : "Refrescar"}
          </button>
        </div>
      )}
      {error && <p style={{ ...PAGE_NOTE, color: ps.dangerText }}>{error}</p>}
      {backendStatus === "ready" && !loading && ifaces.length === 0 && !error && (
        <p style={PAGE_NOTE}>No se detectaron interfaces (o <code>ip</code> no está disponible).</p>
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
  toolbar: { marginBottom: 20 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 },
  card: {
    ...psCard,
    padding: 16,
  },
  cardTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  badge: { fontSize: 11, fontWeight: 600, color: ps.textAccent, letterSpacing: "0.03em" },
  row: { display: "flex", gap: 8, fontSize: 13, color: ps.textSecondary, marginBottom: 6 },
  k: { color: ps.textMuted, minWidth: 56 },
  mono: { fontSize: 11, color: ps.textMono },
};

export default NetworkPage;
