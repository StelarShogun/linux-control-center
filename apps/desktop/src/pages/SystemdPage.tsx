import { useCallback, useEffect, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import { type ListUnitsResponse, type UnitStatusDto, listSystemdUnits } from "../tauri/api";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";

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

  const fetchUnits = useCallback(async () => {
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
  }, [backendStatus, filterKinds, filterActiveOnly]);

  useEffect(() => {
    void fetchUnits();
  }, [fetchUnits]);

  const toggleKind = (kind: string) => {
    setFilterKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    );
  };

  const units = response?.units ?? [];

  return (
    <div style={styles.page}>
      <h1 style={PAGE_HEADING}>Systemd</h1>
      <p style={{ ...PAGE_NOTE, marginBottom: 24 }}>
        Solo lectura. No se realizan cambios en el sistema. Los datos provienen de D-Bus o del
        fixture embebido si D-Bus no está disponible.
      </p>

      {backendStatus === "loading" && <p style={PAGE_NOTE}>Cargando…</p>}
      {backendStatus === "unavailable" && (
        <p style={{ ...PAGE_NOTE, color: ps.dangerText }}>
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
              Solo activas
            </label>
            <button style={styles.refreshBtn} onClick={() => void fetchUnits()} disabled={loading}>
              {loading ? "Cargando…" : "Actualizar"}
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
                <div style={styles.empty}>Ninguna unidad coincide con los filtros.</div>
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

            <div style={styles.detailPane}>
              {selectedUnit ? (
                <>
                  <div style={styles.detailHeader}>{selectedUnit.name}</div>
                  <p style={styles.detailDesc}>{selectedUnit.description}</p>
                  <table style={styles.detailTable}>
                    <tbody>
                      <DetailRow label="Tipo" value={selectedUnit.kind} />
                      <DetailRow label="Load state" value={selectedUnit.load_state} />
                      <DetailRow label="Active state" value={selectedUnit.active_state} />
                      <DetailRow label="Sub state" value={selectedUnit.sub_state} />
                      <DetailRow label="Unit file" value={selectedUnit.unit_file_state} />
                      {selectedUnit.fragment_path && (
                        <DetailRow label="Fragment path" value={selectedUnit.fragment_path} />
                      )}
                    </tbody>
                  </table>
                </>
              ) : (
                <div style={styles.detailPlaceholder}>
                  {units.length === 0
                    ? "Sin unidades en la lista."
                    : "Selecciona una unidad de la lista para ver detalles."}
                </div>
              )}
            </div>
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
  page: { ...PAGE_BASE },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  kindFilters: { display: "flex", gap: 6, flexWrap: "wrap" },
  kindBtn: {
    background: ps.surfacePanel,
    border: `1px solid ${ps.borderDefault}`,
    borderRadius: 999,
    color: ps.textMuted,
    fontSize: 11,
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: "monospace",
  },
  kindBtnActive: {
    background: "rgba(0, 112, 204, 0.2)",
    borderColor: ps.blue,
    color: ps.textAccent,
  },
  checkLabel: { fontSize: 13, color: ps.textMuted, display: "flex", alignItems: "center" },
  refreshBtn: {
    background: ps.blue,
    border: `1px solid ${ps.blue}`,
    borderRadius: 999,
    color: "#ffffff",
    fontSize: 13,
    padding: "8px 16px",
    cursor: "pointer",
    marginLeft: "auto",
    fontWeight: 500,
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
    borderColor: ps.successBorder,
    color: ps.successText,
    background: ps.successBg,
  },
  sourceFixture: {
    borderColor: ps.warningBorder,
    color: ps.warningText,
    background: ps.warningBg,
  },
  unitCount: { fontSize: 12, color: ps.textMuted },
  errorBanner: {
    background: ps.dangerBg,
    border: `1px solid ${ps.dangerBorder}`,
    borderRadius: 12,
    color: ps.dangerText,
    fontSize: 13,
    padding: "10px 14px",
    marginBottom: 12,
  },
  layout: {
    display: "flex",
    gap: 20,
    alignItems: "stretch",
    width: "100%",
    minHeight: "min(72vh, 720px)",
  },
  listPane: {
    flex: "1 1 32%",
    minWidth: "min(100%, 260px)",
    maxWidth: "min(100%, 480px)",
    maxHeight: "calc(100vh - 220px)",
    overflowY: "auto",
    ...psCard,
    padding: 0,
  },
  empty: { padding: 20, fontSize: 13, color: ps.textMuted, textAlign: "center" },
  unitRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "8px 12px",
    background: "none",
    border: "none",
    borderBottom: `1px solid ${ps.borderSubtle}`,
    color: ps.textMuted,
    fontSize: 12,
    fontFamily: "monospace",
    cursor: "pointer",
    textAlign: "left",
  },
  unitRowSelected: {
    background: "rgba(0, 112, 204, 0.15)",
    color: ps.textPrimary,
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
  badgeActive: {
    borderColor: ps.successBorder,
    color: ps.successText,
    background: ps.successBg,
  },
  badgeFailed: {
    borderColor: ps.dangerBorder,
    color: ps.dangerText,
    background: ps.dangerBg,
  },
  badgeOther: {
    borderColor: ps.borderDefault,
    color: ps.textMuted,
    background: ps.surfacePanel,
  },
  detailPane: {
    flex: "1 1 58%",
    ...psCard,
    padding: 22,
    minWidth: 0,
    minHeight: 200,
  },
  detailPlaceholder: {
    fontSize: 13,
    color: ps.textMuted,
    lineHeight: 1.6,
    padding: "24px 8px",
  },
  detailHeader: {
    fontSize: 14,
    fontWeight: 600,
    color: ps.textPrimary,
    fontFamily: "monospace",
    marginBottom: 6,
    wordBreak: "break-all",
  },
  detailDesc: { fontSize: 13, color: ps.textMuted, marginBottom: 16 },
  detailTable: { borderCollapse: "collapse", width: "100%" },
  detailLabel: {
    fontSize: 12,
    color: ps.textMuted,
    paddingRight: 16,
    paddingBottom: 6,
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  detailValue: {
    fontSize: 12,
    color: ps.textPrimary,
    fontFamily: "monospace",
    paddingBottom: 6,
    wordBreak: "break-all",
  },
};

export default SystemdPage;
