import { useEffect, useMemo, useState, type FC } from "react";
import type { AppSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { createSnapshot, listSnapshots, restoreSnapshot } from "../tauri/api";
import type { SnapshotInfo } from "../tauri/types";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

type Banner =
  | { kind: "info"; text: string }
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

const SnapshotsPage: FC<Props> = ({ onSettingsChange, backendStatus }) => {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const selected = useMemo(
    () => snapshots.find((s) => s.id === selectedId) ?? null,
    [snapshots, selectedId]
  );

  async function refresh() {
    const list = await listSnapshots();
    setSnapshots(list);
    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0]!.id);
    }
  }

  useEffect(() => {
    if (backendStatus !== "ready") return;
    setBanner({ kind: "info", text: "Cargando snapshots…" });
    refresh()
      .then(() => setBanner(null))
      .catch((e) => setBanner({ kind: "error", text: `Error: ${String(e)}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendStatus]);

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Snapshots</h1>
      <p style={styles.note}>
        Snapshots persistidos localmente vía backend. Restaurar actualiza los settings de la app (no aplica cambios al sistema real).
      </p>

      {backendStatus === "unavailable" && (
        <div style={styles.callout}>
          <strong>Backend no disponible.</strong> La gestión de snapshots requiere ejecutar la app vía Tauri.
        </div>
      )}
      {backendStatus === "loading" && (
        <div style={styles.callout}>Cargando backend…</div>
      )}

      {banner && (
        <div
          style={{
            ...styles.banner,
            ...(banner.kind === "success"
              ? styles.bannerSuccess
              : banner.kind === "error"
                ? styles.bannerError
                : styles.bannerInfo),
          }}
        >
          {banner.text}
        </div>
      )}

      <div style={styles.grid}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitle}>Lista</div>
            <button
              style={styles.secondaryBtn}
              disabled={backendStatus !== "ready" || busy}
              onClick={async () => {
                setBusy(true);
                setBanner({ kind: "info", text: "Actualizando…" });
                try {
                  await refresh();
                  setBanner({ kind: "success", text: "Lista actualizada." });
                } catch (e) {
                  setBanner({ kind: "error", text: `Error: ${String(e)}` });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Refresh
            </button>
          </div>

          {snapshots.length === 0 ? (
            <div style={styles.empty}>
              No hay snapshots todavía.
            </div>
          ) : (
            <ul style={styles.list}>
              {snapshots.map((s) => {
                const active = s.id === selectedId;
                return (
                  <li key={s.id}>
                    <button
                      style={{
                        ...styles.listItem,
                        ...(active ? styles.listItemActive : {}),
                      }}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <div style={styles.listMain}>
                        <div style={styles.listLabel}>
                          {s.label ?? "—"}
                        </div>
                        <div style={styles.listTimestamp}>{s.timestamp}</div>
                      </div>
                      <div style={styles.listId}>{s.id}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitle}>Acciones</div>
          </div>

          <div style={styles.formRow}>
            <label style={styles.formLabel}>Label</label>
            <input
              style={styles.input}
              value={label}
              placeholder="p.ej. antes de cambiar tema"
              onChange={(e) => setLabel(e.target.value)}
              disabled={backendStatus !== "ready" || busy}
            />
          </div>

          <div style={styles.actions}>
            <button
              style={styles.primaryBtn}
              disabled={backendStatus !== "ready" || busy}
              onClick={async () => {
                setBusy(true);
                setBanner({ kind: "info", text: "Creando snapshot…" });
                try {
                  const trimmed = label.trim();
                  await createSnapshot({ label: trimmed.length > 0 ? trimmed : null });
                  setLabel("");
                  await refresh();
                  setBanner({ kind: "success", text: "Snapshot creado." });
                } catch (e) {
                  setBanner({ kind: "error", text: `Error: ${String(e)}` });
                } finally {
                  setBusy(false);
                }
              }}
            >
              + Create snapshot
            </button>

            <button
              style={styles.dangerBtn}
              disabled={backendStatus !== "ready" || busy || !selected}
              onClick={async () => {
                if (!selected) return;
                const ok = window.confirm(
                  `¿Restaurar este snapshot?\n\n${selected.label ?? "—"}\n${selected.timestamp}\n\nEsto reemplaza los settings actuales en la app.`
                );
                if (!ok) return;

                setBusy(true);
                setBanner({ kind: "info", text: "Restaurando snapshot…" });
                try {
                  const restored = await restoreSnapshot({ snapshot_id: selected.id });
                  onSettingsChange(restored);
                  await refresh();
                  setBanner({ kind: "success", text: "Snapshot restaurado." });
                } catch (e) {
                  setBanner({ kind: "error", text: `Error: ${String(e)}` });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Restore selected
            </button>
          </div>

          <div style={styles.detailBox}>
            <div style={styles.detailTitle}>Seleccionado</div>
            <div style={styles.detailRow}>
              <div style={styles.detailKey}>Label</div>
              <div style={styles.detailVal}>{selected?.label ?? "—"}</div>
            </div>
            <div style={styles.detailRow}>
              <div style={styles.detailKey}>Timestamp</div>
              <div style={styles.detailValMono}>{selected?.timestamp ?? "—"}</div>
            </div>
            <div style={styles.detailRow}>
              <div style={styles.detailKey}>ID</div>
              <div style={styles.detailValMono}>{selected?.id ?? "—"}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "32px 40px", maxWidth: 1100 },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 20, lineHeight: 1.5 },
  callout: {
    background: "#1a1d2e",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: 16,
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
  },
  banner: {
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    marginBottom: 16,
    border: "1px solid #2e3250",
  },
  bannerInfo: { background: "#151722", color: "#9ca3af" },
  bannerSuccess: { background: "#0b1f1a", color: "#a7f3d0", borderColor: "#1f3a3a" },
  bannerError: { background: "#1f0b0b", color: "#fecaca", borderColor: "#3a1f1f" },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: 16,
    alignItems: "start",
  },
  panel: {
    background: "#151722",
    border: "1px solid #2e3250",
    borderRadius: 10,
    padding: 14,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  panelTitle: { fontSize: 13, fontWeight: 700, color: "#e2e8f0" },
  empty: { fontSize: 13, color: "#6b7280", padding: "10px 2px" },
  list: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 },
  listItem: {
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: 10,
    cursor: "pointer",
    color: "#e2e8f0",
  },
  listItemActive: { borderColor: "#88c0d0", background: "#1a1d2e" },
  listMain: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  listLabel: { fontSize: 13, fontWeight: 600, color: "#e2e8f0" },
  listTimestamp: { fontSize: 12, color: "#9ca3af", fontFamily: "monospace" },
  listId: { marginTop: 6, fontSize: 11, color: "#6b7280", fontFamily: "monospace" },
  formRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  formLabel: { width: 70, fontSize: 12, color: "#9ca3af" },
  input: {
    flex: 1,
    background: "#1e2030",
    border: "1px solid #2e3250",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "8px 10px",
    fontSize: 13,
  },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 },
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
    padding: "8px 12px",
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 13,
  },
  dangerBtn: {
    background: "#1f0b0b",
    border: "1px solid #3a1f1f",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#fecaca",
    cursor: "pointer",
    fontSize: 13,
  },
  detailBox: {
    borderTop: "1px solid #2e3250",
    marginTop: 10,
    paddingTop: 12,
  },
  detailTitle: { fontSize: 12, color: "#9ca3af", marginBottom: 10, fontWeight: 600 },
  detailRow: { display: "flex", gap: 10, marginBottom: 8 },
  detailKey: { width: 80, fontSize: 12, color: "#6b7280" },
  detailVal: { fontSize: 12, color: "#e2e8f0" },
  detailValMono: { fontSize: 12, color: "#e2e8f0", fontFamily: "monospace" },
};

export default SnapshotsPage;

