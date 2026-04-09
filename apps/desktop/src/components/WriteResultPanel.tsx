import { useState, type FC } from "react";
import type { WriteTarget } from "../types/generated/WriteTarget";
import { rollbackFullState } from "../tauri/api";
import type { OpMsg } from "./OpMessage";

interface WriteResultPanelProps {
  label: string;
  targetPath: string;
  backupFileName: string | null | undefined;
  snapshotId: string | null | undefined;
  /** Only for apply-live results */
  reloadOk?: boolean;
  reloadOutput?: string;
  /** Only for sandbox results (no rollback, no backup) */
  isSandbox?: boolean;
  /** Required for rollback. If omitted, rollback button is hidden. */
  rollbackTarget?: WriteTarget;
  onRollbackSuccess?: (restoredSettings: object) => void;
  onMessage?: (msg: OpMsg) => void;
}

const WriteResultPanel: FC<WriteResultPanelProps> = ({
  label,
  targetPath,
  backupFileName,
  snapshotId,
  reloadOk,
  reloadOutput,
  isSandbox,
  rollbackTarget,
  onRollbackSuccess,
  onMessage,
}) => {
  const [rolling, setRolling] = useState(false);

  const canRollback = !isSandbox && !!backupFileName && !!rollbackTarget;

  const handleRollback = async () => {
    if (!canRollback || !rollbackTarget || !backupFileName) return;
    const ok = window.confirm(
      "Rollback completo\n\nEsto restaura el archivo de config desde el backup Y los settings del snapshot asociado en un solo paso.\n\n¿Continuar?"
    );
    if (!ok) return;

    setRolling(true);
    onMessage?.({ kind: "info", text: "Rollback completo en curso…" });
    try {
      const result = await rollbackFullState({
        target: rollbackTarget,
        backup_file_name: backupFileName,
      });
      onRollbackSuccess?.(result.restored_settings);
      onMessage?.({
        kind: "success",
        text: `Rollback completado. Snapshot restaurado: ${result.snapshot_id.slice(0, 8)}…`,
      });
    } catch (e) {
      onMessage?.({ kind: "error", text: `Error en rollback: ${String(e)}` });
    } finally {
      setRolling(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.label}>{label}</div>
      <div style={styles.card}>
        <Row icon=">" label="escrito en" value={targetPath} mono />
        {!isSandbox && (
          <>
            {backupFileName ? (
              <Row icon="B" label="backup" value={backupFileName} mono />
            ) : (
              <Row icon="B" label="backup" value="(archivo nuevo, sin backup previo)" />
            )}
            {snapshotId && (
              <Row icon="S" label="snapshot" value={snapshotId.slice(0, 8) + "…"} mono />
            )}
          </>
        )}
        {isSandbox && snapshotId && (
          <Row icon="S" label="snapshot" value={snapshotId.slice(0, 8) + "…"} mono />
        )}
        {reloadOk !== undefined && (
          <Row
            icon="R"
            label="reload"
            value={reloadOk ? "Hyprland recargado correctamente" : "Reload falló — config activa al reiniciar"}
            valueColor={reloadOk ? "#a7f3d0" : "#fde68a"}
          />
        )}
        {reloadOutput && !reloadOk && (
          <Row icon="!" label="output" value={reloadOutput} mono />
        )}
      </div>

      {canRollback && (
        <button
          style={styles.rollbackBtn}
          disabled={rolling}
          onClick={handleRollback}
        >
          {rolling ? "Restaurando…" : "Rollback completo"}
        </button>
      )}
    </div>
  );
};

const Row: FC<{
  icon: string;
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}> = ({ icon, label, value, mono, valueColor }) => (
  <div style={styles.row}>
    <span style={styles.rowIcon}>{icon}</span>
    <span style={styles.rowLabel}>{label}</span>
    <span
      style={{
        ...styles.rowValue,
        ...(mono ? styles.rowMono : {}),
        ...(valueColor ? { color: valueColor } : {}),
      }}
    >
      {value}
    </span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: { marginTop: 20 },
  label: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  card: {
    background: "#151722",
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 12,
  },
  rowIcon: {
    color: "#4b5563",
    width: 14,
    flexShrink: 0,
    fontFamily: "monospace",
  },
  rowLabel: {
    color: "#6b7280",
    width: 70,
    flexShrink: 0,
  },
  rowValue: {
    color: "#9ca3af",
    wordBreak: "break-all" as const,
    flex: 1,
  },
  rowMono: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#88c0d0",
  },
  rollbackBtn: {
    marginTop: 10,
    background: "#1f0b0b",
    border: "1px solid #3a1f1f",
    borderRadius: 8,
    padding: "8px 14px",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
};

export default WriteResultPanel;
