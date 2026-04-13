import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import type { JournalOperationAction } from "../types/generated/JournalOperationAction";
import type { OperationJournalEntry } from "../types/generated/OperationJournalEntry";
import type { BackupAuditReport } from "../tauri/types";
import { auditConfigBackups, deleteOrphanBackup, listRecentOperations } from "../tauri/api";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";

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
      <h1 style={PAGE_HEADING}>Últimas operaciones</h1>
      <p style={PAGE_NOTE}>
        Registro local de apply sandbox, apply real, apply live (Hyprland / Waybar), apply tema, apply wallpaper y rollback. Los datos viven en{" "}
        <code>journal/</code> dentro del directorio de datos de la app.
      </p>

      {backendStatus !== "ready" && (
        <p style={PAGE_NOTE}>Backend no disponible: no se puede cargar el journal.</p>
      )}

      {backendStatus === "ready" && (
        <div style={styles.toolbar}>
          <button type="button" className="ps-btn-secondary" onClick={() => void load()} disabled={loading}>
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
            className="ps-btn-primary"
            style={{ fontSize: 13 }}
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

      {error && <p style={{ ...PAGE_NOTE, color: ps.dangerText }}>{error}</p>}

      {auditError && <p style={{ ...PAGE_NOTE, color: ps.dangerText }}>{auditError}</p>}

      {audit && (
        <div style={styles.auditBox}>
          <div style={styles.auditTitle}>Auditoría de backups (solo lectura)</div>
          <p style={styles.auditSummary}>
            En disco (allowlist): {audit.disk_file_count} · Ref. journal/snapshots: {audit.referenced_name_count} ·
            Seguimiento total (incl. registro): {audit.tracked_union_count} · Posibles huérfanos:{" "}
            <span
              style={{
                color: audit.orphan_count > 0 ? ps.warningText : ps.textSecondary,
              }}
            >
              {audit.orphan_count}
            </span>{" "}
            ·
            Referenciados pero ausentes: {audit.referenced_missing_count}
          </p>
          <p style={styles.auditHint}>
            “Huérfano” = <code>*.bak.*</code> en ruta gestionada que no está en journal, snapshots ni{" "}
            <code>backup_registry.jsonl</code>. Puedes borrar solo filas con destino conocido: primero dry-run, luego
            confirmación.
          </p>
          {audit.rows.length === 0 ? (
            <p style={PAGE_NOTE}>Sin filas (no hay backups en disco ni referencias huérfanas en metadatos).</p>
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
        <p style={PAGE_NOTE}>Aún no hay operaciones registradas.</p>
      )}

      {backendStatus === "ready" && !loading && entries.length > 0 && filtered.length === 0 && (
        <p style={PAGE_NOTE}>Ninguna entrada coincide con los filtros. Ajusta búsqueda o filtros.</p>
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
  toolbar: {
    marginBottom: 14,
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 10,
    alignItems: "center" as const,
  },
  searchInput: {
    minWidth: 200,
    flex: "1 1 200px",
    padding: "8px 12px",
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceInput,
    color: ps.textPrimary,
    fontSize: 13,
    fontFamily: "inherit",
  },
  filterLabel: {
    display: "flex",
    alignItems: "center" as const,
    gap: 6,
    fontSize: 12,
    color: ps.textMuted,
  },
  select: {
    padding: "6px 10px",
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceInput,
    color: ps.textPrimary,
    fontSize: 12,
    fontFamily: "inherit",
  },
  count: { fontSize: 12, color: ps.textMuted, marginLeft: "auto" },
  btnDanger: {
    padding: "4px 8px",
    borderRadius: 3,
    border: `1px solid ${ps.dangerBorder}`,
    background: ps.dangerBg,
    color: ps.dangerText,
    cursor: "pointer",
    fontSize: 10,
    fontFamily: "inherit",
  },
  auditBox: {
    marginBottom: 24,
    padding: 16,
    ...psCard,
  },
  auditTitle: { fontSize: 14, fontWeight: 600, color: ps.textAccent, marginBottom: 8 },
  auditSummary: { fontSize: 12, color: ps.textMuted, lineHeight: 1.5, marginBottom: 8 },
  auditHint: { fontSize: 11, color: ps.textMuted, lineHeight: 1.5, marginBottom: 10 },
  tableWrap: { overflowX: "auto" as const, ...psCard, padding: 0 },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 11 },
  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    background: ps.surfaceInput,
    color: ps.textAccent,
    borderBottom: `1px solid ${ps.borderDefault}`,
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "8px 10px",
    borderBottom: `1px solid ${ps.borderSubtle}`,
    color: ps.textSecondary,
    verticalAlign: "top" as const,
  },
  tdStarted: { fontSize: 9, color: ps.textMuted, marginTop: 4 },
  tdMono: {
    padding: "8px 10px",
    borderBottom: `1px solid ${ps.borderSubtle}`,
    fontFamily: "monospace",
    fontSize: 10,
    color: ps.textMuted,
    verticalAlign: "top" as const,
    whiteSpace: "nowrap" as const,
  },
  tdMonoSmall: {
    padding: "8px 10px",
    borderBottom: `1px solid ${ps.borderSubtle}`,
    fontFamily: "monospace",
    fontSize: 9,
    color: ps.textMuted,
    verticalAlign: "top" as const,
    maxWidth: 420,
    wordBreak: "break-all" as const,
  },
  tdError: {
    padding: "8px 10px",
    borderBottom: `1px solid ${ps.borderSubtle}`,
    color: ps.dangerText,
    fontSize: 10,
    maxWidth: 360,
    wordBreak: "break-word" as const,
    verticalAlign: "top" as const,
  },
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 600,
  },
  badgeOk: {
    background: ps.successBg,
    color: ps.successText,
    border: `1px solid ${ps.successBorder}`,
  },
  badgeFail: {
    background: ps.dangerBg,
    color: ps.dangerText,
    border: `1px solid ${ps.dangerBorder}`,
  },
  tdId: {
    padding: "8px 10px",
    borderBottom: `1px solid ${ps.borderSubtle}`,
    verticalAlign: "top" as const,
    whiteSpace: "nowrap" as const,
  },
  idShort: { fontSize: 10, color: ps.textMuted, display: "block", marginBottom: 4 },
  copyBtn: {
    padding: "2px 8px",
    fontSize: 10,
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceRaised,
    color: ps.textSecondary,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};

export default RecentOperationsPage;
