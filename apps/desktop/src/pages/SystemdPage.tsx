import { useEffect, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import { type ListUnitsResponse, type UnitStatusDto, listSystemdUnits } from "../tauri/api";

interface Props {
  backendStatus: BackendStatus;
}

const ALL_KINDS = ["service", "socket", "target", "timer", "mount", "path", "slice", "scope"];

const SystemdPage: FC<Props> = ({ backendStatus }) => {
  const [response, setResponse] = useState<ListUnitsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterKinds, setFilterKinds] = useState<string[]>(["service"]);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitStatusDto | null>(null);

  const fetchUnits = async () => {
    if (backendStatus !== "ready") return;
    setLoading(true);
    setError(null);
    try {
      const res = await listSystemdUnits(filterKinds, filterActiveOnly, 200);
      setResponse(res);
      setSelectedUnit(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendStatus]);

  const toggleKind = (kind: string) => {
    setFilterKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    );
  };

  const units = response?.units ?? [];

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Systemd</h1>
      <p style={styles.note}>
        Solo lectura. No se realizan cambios en el sistema. Los datos provienen de D-Bus o del
        fixture embebido si D-Bus no está disponible.
      </p>

      {backendStatus === "loading" && <p style={styles.note}>Cargando…</p>}
      {backendStatus === "unavailable" && (
        <p style={{ ...styles.note, color: "#fecaca" }}>
          Backend no disponible (modo web build). Sin datos de systemd.
        </p>
      )}

      {backendStatus === "ready" && (
        <>
          <div style={styles.toolbar}>
            <div style={styles.kindFilters}>
              {ALL_KINDS.map((k) => (
                <button
                  key={k}
                  style={{
                    ...styles.kindBtn,
                    ...(filterKinds.includes(k) ? styles.kindBtnActive : {}),
                  }}
                  onClick={() => toggleKind(k)}
                >
                  {k}
                </button>
              ))}
            </div>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={filterActiveOnly}
                onChange={(e) => setFilterActiveOnly(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Active only
            </label>
            <button style={styles.refreshBtn} onClick={fetchUnits} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {response && (
            <div style={styles.sourceRow}>
              <span
                style={{
                  ...styles.sourceBadge,
                  ...(response.source === "dbus" ? styles.sourceDbus : styles.sourceFixture),
                }}
              >
                {response.source === "dbus" ? "D-Bus" : "Fixture (D-Bus unavailable)"}
              </span>
              <span style={styles.unitCount}>{units.length} units</span>
            </div>
          )}

          {error && <div style={styles.errorBanner}>{error}</div>}

          <div style={styles.layout}>
            <div style={styles.listPane}>
              {units.length === 0 && !loading && (
                <div style={styles.empty}>No units match the current filters.</div>
              )}
              {units.map((u) => (
                <button
                  key={u.name}
                  style={{
                    ...styles.unitRow,
                    ...(selectedUnit?.name === u.name ? styles.unitRowSelected : {}),
                  }}
                  onClick={() => setSelectedUnit(u)}
                >
                  <span style={styles.unitName}>{u.name}</span>
                  <ActiveBadge state={u.active_state} />
                </button>
              ))}
            </div>

            {selectedUnit && (
              <div style={styles.detailPane}>
                <div style={styles.detailHeader}>{selectedUnit.name}</div>
                <p style={styles.detailDesc}>{selectedUnit.description}</p>
                <table style={styles.detailTable}>
                  <tbody>
                    <DetailRow label="Kind" value={selectedUnit.kind} />
                    <DetailRow label="Load state" value={selectedUnit.load_state} />
                    <DetailRow label="Active state" value={selectedUnit.active_state} />
                    <DetailRow label="Sub state" value={selectedUnit.sub_state} />
                    <DetailRow label="Unit file" value={selectedUnit.unit_file_state} />
                    {selectedUnit.fragment_path && (
                      <DetailRow label="Fragment path" value={selectedUnit.fragment_path} />
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ActiveBadge: FC<{ state: string }> = ({ state }) => {
  const isActive = state === "active";
  const isFailed = state === "failed";
  return (
    <span
      style={{
        ...styles.badge,
        ...(isActive ? styles.badgeActive : isFailed ? styles.badgeFailed : styles.badgeOther),
      }}
    >
      {state}
    </span>
  );
};

const DetailRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <tr>
    <td style={styles.detailLabel}>{label}</td>
    <td style={styles.detailValue}>{value}</td>
  </tr>
);

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "32px 40px", maxWidth: 900 },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 24 },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  kindFilters: { display: "flex", gap: 4, flexWrap: "wrap" },
  kindBtn: {
    background: "#1a1d2e",
    border: "1px solid #2e3250",
    borderRadius: 4,
    color: "#6b7280",
    fontSize: 11,
    padding: "3px 8px",
    cursor: "pointer",
    fontFamily: "monospace",
  },
  kindBtnActive: {
    background: "#2e3250",
    borderColor: "#88c0d0",
    color: "#88c0d0",
  },
  checkLabel: { fontSize: 13, color: "#9ca3af", display: "flex", alignItems: "center" },
  refreshBtn: {
    background: "#2e3250",
    border: "1px solid #2e3250",
    borderRadius: 6,
    color: "#e2e8f0",
    fontSize: 13,
    padding: "6px 12px",
    cursor: "pointer",
    marginLeft: "auto",
  },
  sourceRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sourceBadge: {
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 999,
    padding: "3px 10px",
    border: "1px solid",
    letterSpacing: "0.02em",
  },
  sourceDbus: {
    borderColor: "#1f3a3a",
    color: "#a7f3d0",
    background: "#0b1f1a",
  },
  sourceFixture: {
    borderColor: "#3a2e1f",
    color: "#fcd34d",
    background: "#1f1a0b",
  },
  unitCount: { fontSize: 12, color: "#6b7280" },
  errorBanner: {
    background: "#1f0b0b",
    border: "1px solid #3a1f1f",
    borderRadius: 8,
    color: "#fecaca",
    fontSize: 13,
    padding: "10px 12px",
    marginBottom: 12,
  },
  layout: { display: "flex", gap: 16, alignItems: "flex-start" },
  listPane: {
    flex: "0 0 320px",
    maxHeight: 520,
    overflowY: "auto",
    border: "1px solid #2e3250",
    borderRadius: 8,
    background: "#151722",
  },
  empty: { padding: 20, fontSize: 13, color: "#6b7280", textAlign: "center" },
  unitRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "8px 12px",
    background: "none",
    border: "none",
    borderBottom: "1px solid #1e2030",
    color: "#9ca3af",
    fontSize: 12,
    fontFamily: "monospace",
    cursor: "pointer",
    textAlign: "left",
  },
  unitRowSelected: {
    background: "#2e3250",
    color: "#e2e8f0",
  },
  unitName: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 999,
    padding: "2px 7px",
    border: "1px solid",
    flexShrink: 0,
    marginLeft: 8,
  },
  badgeActive: { borderColor: "#1f3a3a", color: "#a7f3d0", background: "#0b1f1a" },
  badgeFailed: { borderColor: "#3a1f1f", color: "#fecaca", background: "#1f0b0b" },
  badgeOther: { borderColor: "#2e3250", color: "#6b7280", background: "#151722" },
  detailPane: {
    flex: 1,
    border: "1px solid #2e3250",
    borderRadius: 8,
    background: "#151722",
    padding: 20,
    minWidth: 0,
  },
  detailHeader: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e2e8f0",
    fontFamily: "monospace",
    marginBottom: 6,
    wordBreak: "break-all",
  },
  detailDesc: { fontSize: 13, color: "#9ca3af", marginBottom: 16 },
  detailTable: { borderCollapse: "collapse", width: "100%" },
  detailLabel: {
    fontSize: 12,
    color: "#6b7280",
    paddingRight: 16,
    paddingBottom: 6,
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  detailValue: {
    fontSize: 12,
    color: "#e2e8f0",
    fontFamily: "monospace",
    paddingBottom: 6,
    wordBreak: "break-all",
  },
};

export default SystemdPage;
