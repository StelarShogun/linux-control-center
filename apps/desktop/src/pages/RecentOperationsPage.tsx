import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import type { JournalOperationAction } from "../types/generated/JournalOperationAction";
import type { OperationJournalEntry } from "../types/generated/OperationJournalEntry";
import type { BackupAuditReport } from "../tauri/types";
import { auditConfigBackups, deleteOrphanBackup, listRecentOperations } from "../tauri/api";
import { PAGE_BASE } from "../layout/pageLayout";

/** Todas las acciones del journal (mantener alineado con `JournalOperationAction` generado). */
const ALL_JOURNAL_ACTIONS: JournalOperationAction[] = [
  "apply_sandbox",
  "apply_real",
  "apply_live",
  "apply_live_waybar",
  "apply_theme",
  "apply_wallpaper",
  "rollback",
];

interface Props {
  backendStatus: BackendStatus;
}

function actionLabel(action: JournalOperationAction): string {
  switch (action) {
    case "apply_sandbox":
      return "Sandbox";
    case "apply_real":
      return "Aplicar real";
    case "apply_live":
      return "Aplicar en vivo";
    case "apply_live_waybar":
      return "Waybar en vivo";
    case "apply_theme":
      return "Tema";
    case "apply_wallpaper":
      return "Fondo de pantalla";
    case "rollback":
      return "Rollback";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function entryMatchesSearch(row: OperationJournalEntry, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  const hay = [
    row.operation_id,
    row.target,
    row.action,
    actionLabel(row.action),
    row.snapshot_id ?? "",
    row.backup_file_name ?? "",
    row.written_path ?? "",
    row.error_summary ?? "",
    row.finished_at,
    row.started_at,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(n);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const RecentOperationsPage: FC<Props> = ({ backendStatus }) => {
  const [entries, setEntries] = useState<OperationJournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<JournalOperationAction | "">("");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "ok" | "fail">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [audit, setAudit] = useState<BackupAuditReport | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (backendStatus !== "ready") return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listRecentOperations(100);
      setEntries(rows);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [backendStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return entries.filter((row) => {
      if (actionFilter && row.action !== actionFilter) return false;
      if (outcomeFilter === "ok" && !row.success) return false;
      if (outcomeFilter === "fail" && row.success) return false;
      if (!entryMatchesSearch(row, search)) return false;
      return true;
    });
  }, [entries, search, actionFilter, outcomeFilter]);

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Últimas operaciones</h1>
      <p style={styles.note}>
        Registro local de apply sandbox, apply real, apply live (Hyprland / Waybar), apply tema, apply wallpaper y rollback. Los datos viven en{" "}
        <code>journal/</code> dentro del directorio de datos de la app.
      </p>

      {backendStatus !== "ready" && (
        <p style={styles.note}>Backend no disponible: no se puede cargar el journal.</p>
      )}

      {backendStatus === "ready" && (
        <div style={styles.toolbar}>
          <button type="button" style={styles.btn} onClick={() => void load()} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
          <input
            type="search"
            placeholder="Buscar en entradas cargadas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
            aria-label="Buscar en operaciones"
          />
          <label style={styles.filterLabel}>
            Acción
            <select
              style={styles.select}
              value={actionFilter}
              onChange={(e) => setActionFilter((e.target.value || "") as JournalOperationAction | "")}
            >
              <option value="">Todas</option>
              {ALL_JOURNAL_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(a)}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.filterLabel}>
            Resultado
            <select
              style={styles.select}
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as "all" | "ok" | "fail")}
            >
              <option value="all">Todos</option>
              <option value="ok">Solo OK</option>
              <option value="fail">Solo fallidos</option>
            </select>
          </label>
          {entries.length > 0 && (
            <span style={styles.count}>
              {filtered.length === entries.length
                ? `${entries.length} entradas`
                : `${filtered.length} de ${entries.length}`}
            </span>
          )}
          <button
            type="button"
            style={styles.btnSecondary}
            disabled={loading || auditLoading}
            onClick={() => {
              setAuditError(null);
              setAuditLoading(true);
              void auditConfigBackups()
                .then(setAudit)
                .catch((e) => setAuditError(String(e)))
                .finally(() => setAuditLoading(false));
            }}
          >
            {auditLoading ? "Auditando…" : "Auditar backups (~/.config)"}
          </button>
        </div>
      )}

      {error && <p style={{ ...styles.note, color: "#f87171" }}>{error}</p>}

      {auditError && <p style={{ ...styles.note, color: "#f87171" }}>{auditError}</p>}

      {audit && (
        <div style={styles.auditBox}>
          <div style={styles.auditTitle}>Auditoría de backups (solo lectura)</div>
          <p style={styles.auditSummary}>
            En disco (allowlist): {audit.disk_file_count} · Ref. journal/snapshots: {audit.referenced_name_count} ·
            Seguimiento total (incl. registro): {audit.tracked_union_count} · Posibles huérfanos:{" "}
            <span style={{ color: audit.orphan_count > 0 ? "#fbbf24" : "#d1d5db" }}>{audit.orphan_count}</span> ·
            Referenciados pero ausentes: {audit.referenced_missing_count}
          </p>
          <p style={styles.auditHint}>
            “Huérfano” = <code>*.bak.*</code> en ruta gestionada que no está en journal, snapshots ni{" "}
            <code>backup_registry.jsonl</code>. Puedes borrar solo filas con destino conocido: primero dry-run, luego
            confirmación.
          </p>
          {audit.rows.length === 0 ? (
            <p style={styles.note}>Sin filas (no hay backups en disco ni referencias huérfanas en metadatos).</p>
          ) : (
            <div style={{ overflowX: "auto" as const }}>
              <table style={{ ...styles.table, fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={styles.th}>Target</th>
                    <th style={styles.th}>Backup</th>
                    <th style={styles.th}>Disco</th>
                    <th style={styles.th}>Tamaño</th>
                    <th style={styles.th}>Journal/snap</th>
                    <th style={styles.th}>Registro</th>
                    <th style={styles.th}>Huérfano</th>
                    <th style={styles.th}>Ref. ausente</th>
                    <th style={styles.th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.rows.map((r) => (
                    <tr key={`${r.target ?? "?"}-${r.backup_file_name}`}>
                      <td style={styles.tdMono}>{r.target ?? "—"}</td>
                      <td style={styles.tdMonoSmall}>{r.backup_file_name}</td>
                      <td style={styles.td}>{r.exists_on_disk ? "sí" : "no"}</td>
                      <td style={styles.tdMono}>
                        {r.size_bytes != null ? `${r.size_bytes} B` : "—"}
                      </td>
                      <td style={styles.td}>{r.referenced_in_journal_or_snapshot ? "sí" : "no"}</td>
                      <td style={styles.td}>{r.tracked_in_registry ? "sí" : "no"}</td>
                      <td style={styles.td}>{r.orphan_suspect ? "sí" : "—"}</td>
                      <td style={styles.td}>{r.referenced_but_missing ? "sí" : "—"}</td>
                      <td style={styles.td}>
                        {r.orphan_suspect && r.target != null ? (
                          <button
                            type="button"
                            style={styles.btnDanger}
                            disabled={deletingName === r.backup_file_name || auditLoading}
                            onClick={() => {
                              const t = r.target;
                              if (t == null) return;
                              void (async () => {
                                setAuditError(null);
                                setDeletingName(r.backup_file_name);
                                try {
                                  const preview = await deleteOrphanBackup({
                                    target: t,
                                    backup_file_name: r.backup_file_name,
                                    dry_run: true,
                                  });
                                  const ok = window.confirm(
                                    `¿Borrar el backup huérfano?\n${preview.path}`,
                                  );
                                  if (!ok) return;
                                  await deleteOrphanBackup({
                                    target: t,
                                    backup_file_name: r.backup_file_name,
                                    dry_run: false,
                                  });
                                  const next = await auditConfigBackups();
                                  setAudit(next);
                                } catch (e) {
                                  setAuditError(String(e));
                                } finally {
                                  setDeletingName(null);
                                }
                              })();
                            }}
                          >
                            {deletingName === r.backup_file_name ? "…" : "Borrar"}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {backendStatus === "ready" && !loading && entries.length === 0 && !error && (
        <p style={styles.note}>Aún no hay operaciones registradas.</p>
      )}

      {backendStatus === "ready" && !loading && entries.length > 0 && filtered.length === 0 && (
        <p style={styles.note}>Ninguna entrada coincide con los filtros. Ajusta búsqueda o filtros.</p>
      )}

      {filtered.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>operation_id</th>
                <th style={styles.th}>Tiempo (UTC)</th>
                <th style={styles.th}>Target</th>
                <th style={styles.th}>Acción</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Snapshot</th>
                <th style={styles.th}>Backup</th>
                <th style={styles.th}>Ruta escrita</th>
                <th style={styles.th}>Reload</th>
                <th style={styles.th}>Error</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.operation_id}>
                  <td style={styles.tdId}>
                    <code style={styles.idShort} title={row.operation_id}>
                      {row.operation_id.slice(0, 8)}…
                    </code>
                    <button
                      type="button"
                      style={styles.copyBtn}
                      onClick={() => {
                        void copyText(row.operation_id).then((ok) => {
                          if (ok) {
                            setCopiedId(row.operation_id);
                            window.setTimeout(() => setCopiedId((id) => (id === row.operation_id ? null : id)), 2000);
                          }
                        });
                      }}
                    >
                      {copiedId === row.operation_id ? "Copiado" : "Copiar"}
                    </button>
                  </td>
                  <td style={styles.tdMono}>
                    <div>{row.finished_at}</div>
                    <div style={styles.tdStarted}>inicio {row.started_at}</div>
                  </td>
                  <td style={styles.td}>{row.target}</td>
                  <td style={styles.td}>{actionLabel(row.action)}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        ...(row.success ? styles.badgeOk : styles.badgeFail),
                      }}
                    >
                      {row.success ? "OK" : "FAIL"}
                    </span>
                  </td>
                  <td style={styles.tdMono}>
                    {row.snapshot_id ? (
                      <span title={row.snapshot_id}>
                        {row.snapshot_id.slice(0, 8)}…
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={styles.tdMono}>{row.backup_file_name ?? "—"}</td>
                  <td style={styles.tdMonoSmall}>{row.written_path ?? "—"}</td>
                  <td style={styles.td}>
                    {row.reload_status === null
                      ? "—"
                      : row.reload_status
                        ? "OK"
                        : "FAIL"}
                  </td>
                  <td style={styles.tdError}>{row.error_summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 },
  toolbar: {
    marginBottom: 12,
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 10,
    alignItems: "center" as const,
  },
  searchInput: {
    minWidth: 200,
    flex: "1 1 200px",
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #3d4466",
    background: "#151722",
    color: "#e2e8f0",
    fontSize: 13,
    fontFamily: "inherit",
  },
  filterLabel: {
    display: "flex",
    alignItems: "center" as const,
    gap: 6,
    fontSize: 12,
    color: "#9ca3af",
  },
  select: {
    padding: "5px 8px",
    borderRadius: 6,
    border: "1px solid #3d4466",
    background: "#1e2030",
    color: "#e2e8f0",
    fontSize: 12,
    fontFamily: "inherit",
  },
  count: { fontSize: 12, color: "#6b7280", marginLeft: "auto" },
  btn: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #3d4466",
    background: "#252840",
    color: "#a0aec0",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  },
  btnSecondary: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #3d5a50",
    background: "#15201c",
    color: "#86efac",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  },
  btnDanger: {
    padding: "4px 8px",
    borderRadius: 4,
    border: "1px solid #5a3030",
    background: "#221010",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 10,
    fontFamily: "inherit",
  },
  auditBox: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 8,
    border: "1px solid #2e3250",
    background: "#12141c",
  },
  auditTitle: { fontSize: 13, fontWeight: 600, color: "#88c0d0", marginBottom: 8 },
  auditSummary: { fontSize: 12, color: "#9ca3af", lineHeight: 1.5, marginBottom: 8 },
  auditHint: { fontSize: 11, color: "#6b7280", lineHeight: 1.5, marginBottom: 10 },
  tableWrap: { overflowX: "auto" as const, border: "1px solid #2e3250", borderRadius: 8 },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 11 },
  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    background: "#1e2030",
    color: "#88c0d0",
    borderBottom: "1px solid #2e3250",
    whiteSpace: "nowrap" as const,
  },
  td: { padding: "8px 10px", borderBottom: "1px solid #252840", color: "#d1d5db", verticalAlign: "top" as const },
  tdStarted: { fontSize: 9, color: "#6b7280", marginTop: 4 },
  tdMono: {
    padding: "8px 10px",
    borderBottom: "1px solid #252840",
    fontFamily: "monospace",
    fontSize: 10,
    color: "#9ca3af",
    verticalAlign: "top" as const,
    whiteSpace: "nowrap" as const,
  },
  tdMonoSmall: {
    padding: "8px 10px",
    borderBottom: "1px solid #252840",
    fontFamily: "monospace",
    fontSize: 9,
    color: "#9ca3af",
    verticalAlign: "top" as const,
    maxWidth: 420,
    wordBreak: "break-all" as const,
  },
  tdError: {
    padding: "8px 10px",
    borderBottom: "1px solid #252840",
    color: "#fca5a5",
    fontSize: 10,
    maxWidth: 360,
    wordBreak: "break-word" as const,
    verticalAlign: "top" as const,
  },
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  badgeOk: { background: "#0b1f1a", color: "#6ee7b7", border: "1px solid #1a3a2a" },
  badgeFail: { background: "#1f0b0b", color: "#fca5a5", border: "1px solid #3a1f1f" },
  tdId: {
    padding: "8px 10px",
    borderBottom: "1px solid #252840",
    verticalAlign: "top" as const,
    whiteSpace: "nowrap" as const,
  },
  idShort: { fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 },
  copyBtn: {
    padding: "2px 8px",
    fontSize: 10,
    borderRadius: 4,
    border: "1px solid #3d4466",
    background: "#252840",
    color: "#a0aec0",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};

export default RecentOperationsPage;
