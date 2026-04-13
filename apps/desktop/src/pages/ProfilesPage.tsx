import { useCallback, useEffect, useState, type FC } from "react";
import type { AppSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import {
  deleteProfile,
  listProfiles,
  loadProfileSettings,
  saveProfile,
  setActiveProfile,
  type ProfileListItemDto,
} from "../tauri/api";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";
import DnaStrip from "../components/DnaStrip";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
  onActiveProfileChange: (id: string | null, name: string | null) => void;
}

const ProfilesPage: FC<Props> = ({
  settings,
  onSettingsChange,
  backendStatus,
  onActiveProfileChange,
}) => {
  const [profiles, setProfiles] = useState<ProfileListItemDto[]>([]);
  const [message, setMessage] = useState<{ kind: "info" | "success" | "error"; text: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (backendStatus !== "ready") return;
    void listProfiles()
      .then(setProfiles)
      .catch((e) => setMessage({ kind: "error", text: String(e) }));
  }, [backendStatus]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activate = async (id: string, name: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const loaded = await loadProfileSettings(id);
      onSettingsChange(loaded);
      await setActiveProfile(id, name);
      onActiveProfileChange(id, name);
      setMessage({ kind: "success", text: `Perfil «${name}» activado (en memoria; guarda en disco si quieres persistir).` });
    } catch (e) {
      setMessage({ kind: "error", text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("¿Eliminar este perfil del disco?")) return;
    setBusy(true);
    try {
      await deleteProfile(id);
      refresh();
      setMessage({ kind: "success", text: "Perfil eliminado." });
    } catch (e) {
      setMessage({ kind: "error", text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (p: ProfileListItemDto) => {
    const name = window.prompt("Nombre del duplicado", `${p.name} (copia)`);
    if (name === null) return;
    setBusy(true);
    try {
      const loaded = await loadProfileSettings(p.id);
      await saveProfile({
        name: name.trim() || `${p.name} (copia)`,
        description: p.description || null,
        settings: loaded,
      });
      refresh();
      setMessage({ kind: "success", text: "Perfil duplicado." });
    } catch (e) {
      setMessage({ kind: "error", text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const saveCurrentAsNew = async () => {
    const name = window.prompt("Nombre del perfil", "Mi perfil");
    if (name === null) return;
    setBusy(true);
    try {
      await saveProfile({
        name: name.trim() || "Mi perfil",
        description: null,
        settings,
      });
      refresh();
      setMessage({ kind: "success", text: "Perfil guardado." });
    } catch (e) {
      setMessage({ kind: "error", text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={PAGE_HEADING}>Perfiles</h1>
      <p style={PAGE_NOTE}>
        Biblioteca en el directorio de datos de la app. <strong>Activar</strong> carga el perfil en
        la sesión (marca dirty hasta guardar). Usa el banner inferior para guardar en disco o
        actualizar el perfil activo.
      </p>
      {backendStatus !== "ready" && (
        <div style={styles.limitationBox}>Perfiles requieren backend Tauri.</div>
      )}
      {message && (
        <div
          style={{
            ...styles.message,
            ...(message.kind === "success"
              ? styles.messageSuccess
              : message.kind === "error"
                ? styles.messageError
                : styles.messageInfo),
          }}
        >
          {message.text}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="ps-btn-primary"
          disabled={backendStatus !== "ready" || busy}
          onClick={() => void saveCurrentAsNew()}
        >
          Guardar configuración actual como perfil nuevo
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {profiles.map((p) => (
          <div key={p.id} style={{ ...psCard, padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: ps.textMuted }}>{p.description || "Sin descripción"}</div>
              <div style={{ fontSize: 11, color: ps.textMuted, marginTop: 4 }}>{p.created_at}</div>
            </div>
            <DnaStrip seed={p.id} width={140} height={18} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                className="ps-btn-primary"
                disabled={busy || backendStatus !== "ready"}
                onClick={() => void activate(p.id, p.name)}
              >
                Activar
              </button>
              <button
                type="button"
                className="ps-btn-secondary"
                disabled={busy || backendStatus !== "ready"}
                onClick={() => void duplicate(p)}
              >
                Duplicar
              </button>
              <button
                type="button"
                className="ps-btn-secondary"
                disabled={busy || backendStatus !== "ready"}
                onClick={() => void remove(p.id)}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {profiles.length === 0 && backendStatus === "ready" && (
          <p style={{ color: ps.textMuted, fontSize: 14 }}>Aún no hay perfiles guardados.</p>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  limitationBox: {
    ...psCard,
    padding: 16,
    fontSize: 13,
    color: ps.textMuted,
    marginBottom: 20,
  },
  message: {
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 12,
    border: "1px solid",
  },
  messageInfo: { background: ps.infoBg, color: ps.infoText, borderColor: ps.infoBorder },
  messageSuccess: {
    background: ps.successBg,
    color: ps.successText,
    borderColor: ps.successBorder,
  },
  messageError: {
    background: ps.dangerBg,
    color: ps.dangerText,
    borderColor: ps.dangerBorder,
  },
};

export default ProfilesPage;
