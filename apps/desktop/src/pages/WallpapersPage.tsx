import { useCallback, useEffect, useRef, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import type { WallpaperBackendStatus } from "../types/generated/WallpaperBackendStatus";
import type { WallpaperCatalogEntry } from "../types/generated/WallpaperCatalogEntry";
import type { WallpaperCollection } from "../types/generated/WallpaperCollection";
import type { WallpaperPreview } from "../types/generated/WallpaperPreview";
import {
  applyWallpaper,
  getCurrentWallpaper,
  getWallpaperBackendStatus,
  getWallpaperPreview,
  listWallpapers,
  refreshWallpaperCatalog,
} from "../tauri/api";
import type { CurrentWallpaperState } from "../types/generated/CurrentWallpaperState";
import { PAGE_BASE } from "../layout/pageLayout";

interface Props {
  backendStatus: BackendStatus;
}

const WALLPAPER_ENGINE_FILTER = {
  kind: "wallpaperengineproject",
  source: "wallpaperenginelibrary",
} as const;

function backendStatusLabel(s: WallpaperBackendStatus): string {
  switch (s.type) {
    case "ready":
      return s.detail;
    case "not_installed":
      return "Backend no instalado — define LCC_WALLPAPER_APPLY_BIN o instala lcc-wallpaper-helper (ver README del adapter).";
    case "misconfigured":
      return `Misconfigurado: ${s.reason}`;
    case "error":
      return `Error: ${s.message}`;
    default: {
      const _e: never = s;
      return _e;
    }
  }
}

const WallpapersPage: FC<Props> = ({ backendStatus }) => {
  const [collection, setCollection] = useState<WallpaperCollection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<WallpaperPreview | null>(null);
  const [backend, setBackend] = useState<WallpaperBackendStatus | null>(null);
  const [current, setCurrent] = useState<CurrentWallpaperState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const catalogBootstrapped = useRef(false);

  const loadList = useCallback(async () => {
    if (backendStatus !== "ready") return;
    const col = await listWallpapers({ filter: WALLPAPER_ENGINE_FILTER, limit: null });
    setCollection(col);
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== "ready") return;
    void getWallpaperBackendStatus().then(setBackend);
    void getCurrentWallpaper().then(setCurrent);
  }, [backendStatus]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  /** Si el catálogo en caché está vacío, un primer escaneo a disco suele poblarlo (nuevas carpetas / XDG). */
  useEffect(() => {
    if (backendStatus !== "ready" || catalogBootstrapped.current || !collection) return;
    if (collection.entries.length > 0) {
      catalogBootstrapped.current = true;
      return;
    }
    catalogBootstrapped.current = true;
    void (async () => {
      setBusy(true);
      setMessage(null);
      try {
        const col = await refreshWallpaperCatalog();
        setCollection(col);
        setMessage({
          kind: "ok",
          text: `Catálogo inicial: ${col.scan_stats.entry_count} entradas.`,
        });
      } catch (e) {
        setMessage({ kind: "err", text: String(e) });
      } finally {
        setBusy(false);
      }
    })();
  }, [backendStatus, collection]);

  useEffect(() => {
    if (!selectedId || backendStatus !== "ready") {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void getWallpaperPreview({ id: selectedId }).then((p) => {
      if (!cancelled) setPreview(p);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, backendStatus]);

  const handleRefresh = async () => {
    if (backendStatus !== "ready") return;
    setBusy(true);
    setMessage(null);
    try {
      const col = await refreshWallpaperCatalog();
      setCollection(col);
      setMessage({ kind: "ok", text: `Catálogo actualizado (${col.scan_stats.entry_count} entradas).` });
    } catch (e) {
      setMessage({ kind: "err", text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    if (!selectedId || backendStatus !== "ready") return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await applyWallpaper({ id: selectedId });
      if (res.ok) {
        setMessage({
          kind: "ok",
          text: res.already_active
            ? "Ya era el wallpaper actual en LCC."
            : `Aplicado.${res.backend_message ? ` ${res.backend_message}` : ""}`,
        });
        setCurrent(await getCurrentWallpaper());
      } else {
        setMessage({
          kind: "err",
          text: res.warnings.join("; ") || res.backend_message || "Fallo al aplicar",
        });
      }
    } catch (e) {
      setMessage({ kind: "err", text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const previewSrc =
    preview?.type === "static_image"
      ? `data:${preview.mime};base64,${preview.data_base64}`
      : null;

  const entries: WallpaperCatalogEntry[] = collection?.entries ?? [];

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Wallpapers</h1>
      <p style={styles.note}>
        Catálogo limitado a proyectos de Wallpaper Engine. Los IDs son opacos; el apply usa el
        binario configurado (<code>LCC_WALLPAPER_APPLY_BIN</code> o <code>lcc-wallpaper-helper</code>
        ).
      </p>

      {backendStatus !== "ready" && (
        <p style={styles.warn}>Backend no disponible — ejecuta la app con Tauri.</p>
      )}

      {backendStatus === "ready" && (
        <>
          <section style={styles.bar}>
            <div style={styles.statusBox}>
              <div style={styles.statusTitle}>Estado del backend</div>
              <div style={styles.statusText}>{backend ? backendStatusLabel(backend) : "…"}</div>
            </div>
            <div style={styles.statusBox}>
              <div style={styles.statusTitle}>Actual (LCC / backend)</div>
              <div style={styles.statusText}>
                {current
                  ? `${current.last_applied_by_app ?? "—"} | confianza: ${current.confidence}`
                  : "…"}
              </div>
            </div>
            <button type="button" style={styles.btn} disabled={busy} onClick={() => void handleRefresh()}>
              {busy ? "…" : "Actualizar catálogo"}
            </button>
            <button type="button" style={styles.btn} onClick={() => void getCurrentWallpaper().then(setCurrent)}>
              Refrescar estado
            </button>
          </section>

          <div style={styles.split}>
            <div style={styles.listPane}>
              {entries.length === 0 && (
                <p style={styles.note}>
                  Sin proyectos de Wallpaper Engine. Pulsa «Actualizar catálogo» o revisa la
                  librería de Wallpaper Engine bajo tu HOME.
                </p>
              )}
              <ul style={styles.list}>
                {entries.map((e) => {
                  const id = e.id;
                  const active = selectedId === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        style={{
                          ...styles.listItem,
                          ...(active ? styles.listItemActive : {}),
                        }}
                        onClick={() => setSelectedId(id)}
                      >
                        <span style={styles.listTitle}>{e.metadata.title}</span>
                        <span style={styles.listMeta}>
                          Proyecto Wallpaper Engine {e.flags.missing_file ? "· ausente" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div style={styles.previewPane}>
              <div style={styles.previewTitle}>Vista previa</div>
              {preview?.type === "unavailable" && (
                <p style={styles.note}>{preview.reason}</p>
              )}
              {previewSrc && (
                <img src={previewSrc} alt="" style={styles.previewImg} />
              )}
              <button
                type="button"
                style={styles.applyBtn}
                disabled={!selectedId || busy}
                onClick={() => void handleApply()}
              >
                Aplicar seleccionado
              </button>
            </div>
          </div>
        </>
      )}

      {message && (
        <p style={{ ...styles.banner, color: message.kind === "ok" ? "#4ade80" : "#f87171" }}>{message.text}</p>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  heading: { fontSize: 22, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" },
  note: { fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 12 },
  warn: { color: "#fbbf24", fontSize: 13 },
  bar: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start", marginBottom: 16 },
  statusBox: {
    flex: 1,
    minWidth: 200,
    padding: 10,
    background: "#151722",
    border: "1px solid #2e3250",
    borderRadius: 8,
  },
  statusTitle: { fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 },
  statusText: { fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 },
  btn: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "1px solid #3d4466",
    background: "#252840",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 13,
    alignSelf: "flex-end",
  },
  split: {
    display: "flex",
    gap: 20,
    alignItems: "stretch",
    flexWrap: "wrap",
    width: "100%",
  },
  listPane: {
    flex: "1 1 320px",
    minWidth: 260,
    maxHeight: "calc(100vh - 260px)",
    overflow: "auto",
  },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 },
  listItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #2e3250",
    background: "#1a1d2e",
    color: "#e2e8f0",
    cursor: "pointer",
  },
  listItemActive: { borderColor: "#88c0d0", background: "#252840" },
  listTitle: { display: "block", fontSize: 14, fontWeight: 500 },
  listMeta: { display: "block", fontSize: 11, color: "#6b7280", marginTop: 2 },
  previewPane: {
    flex: "1 1 340px",
    minWidth: 280,
    minHeight: 280,
    padding: 16,
    background: "#151722",
    border: "1px solid #2e3250",
    borderRadius: 8,
  },
  previewTitle: { fontSize: 12, color: "#88c0d0", marginBottom: 10 },
  previewImg: { maxWidth: "100%", maxHeight: 220, borderRadius: 6, marginBottom: 12 },
  applyBtn: {
    width: "100%",
    padding: "10px",
    borderRadius: 8,
    border: "none",
    background: "#0f766e",
    color: "#ecfdf5",
    fontWeight: 600,
    cursor: "pointer",
  },
  banner: { marginTop: 16, fontSize: 13 },
};

export default WallpapersPage;
