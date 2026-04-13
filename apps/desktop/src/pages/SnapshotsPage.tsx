import { useEffect, useMemo, useState, type FC } from "react";
import type { AppSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { createSnapshot, listSnapshots, restoreSnapshot } from "../tauri/api";
import type { SnapshotInfo } from "../tauri/types";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";

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
      <h1 style={PAGE_HEADING}>Snapshots</h1>
      <p style={{ ...PAGE_NOTE, marginBottom: 24 }}>
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
              type="button"
              className="ps-btn-secondary"
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
              type="button"
              className="ps-btn-primary"
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
              type="button"
              className="ps-btn-danger"
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
  page: { ...PAGE_BASE },
  callout: {
    ...psCard,
    padding: 16,
    fontSize: 13,
    color: ps.textMuted,
    marginBottom: 12,
  },
  banner: {
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 16,
    border: "1px solid",
  },
  bannerInfo: { background: ps.infoBg, color: ps.infoText, borderColor: ps.infoBorder },
  bannerSuccess: {
    background: ps.successBg,
    color: ps.successText,
    borderColor: ps.successBorder,
  },
  bannerError: {
    background: ps.dangerBg,
    color: ps.dangerText,
    borderColor: ps.dangerBorder,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1.1fr) minmax(280px, 1.4fr)",
    gap: 20,
    alignItems: "start",
    width: "100%",
  },
  panel: {
    ...psCard,
    padding: 16,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  panelTitle: { fontSize: 14, fontWeight: 600, color: ps.textPrimary },
  empty: { fontSize: 13, color: ps.textMuted, padding: "10px 2px" },
  list: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 },
  listItem: {
    width: "100%",
    textAlign: "left",
    background: "none",
    border: `1px solid ${ps.borderDefault}`,
    borderRadius: 12,
    padding: 12,
    cursor: "pointer",
    color: ps.textPrimary,
    transition: "border-color 180ms ease, background 180ms ease",
  },
  listItemActive: {
    borderColor: ps.blue,
    background: "rgba(0, 112, 204, 0.12)",
  },
  listMain: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  listLabel: { fontSize: 13, fontWeight: 600, color: ps.textPrimary },
  listTimestamp: { fontSize: 12, color: ps.textMuted, fontFamily: "monospace" },
  listId: { marginTop: 6, fontSize: 11, color: ps.textMuted, fontFamily: "monospace" },
  formRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  formLabel: { width: 70, fontSize: 12, color: ps.textMuted },
  input: {
    flex: 1,
    background: ps.surfaceInput,
    border: `1px solid ${ps.borderStrong}`,
    borderRadius: 3,
    color: ps.textPrimary,
    padding: "8px 10px",
    fontSize: 13,
  },
  actions: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" },
  detailBox: {
    borderTop: `1px solid ${ps.borderDefault}`,
    marginTop: 12,
    paddingTop: 14,
  },
  detailTitle: { fontSize: 12, color: ps.textMuted, marginBottom: 10, fontWeight: 600 },
  detailRow: { display: "flex", gap: 10, marginBottom: 8 },
  detailKey: { width: 80, fontSize: 12, color: ps.textMuted },
  detailVal: { fontSize: 12, color: ps.textPrimary },
  detailValMono: { fontSize: 12, color: ps.textPrimary, fontFamily: "monospace" },
};

export default SnapshotsPage;

