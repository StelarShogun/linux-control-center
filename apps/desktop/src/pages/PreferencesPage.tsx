import { useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import {
  getAutoSavePreference,
  getHyprlandBannerDismissed,
  setAutoSavePreference,
  setHyprlandBannerDismissed,
} from "../app/appPreferences";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";

interface Props {
  backendStatus: BackendStatus;
  autoSaveEnabled: boolean;
  onAutoSaveChange: (value: boolean) => void;
}

const PreferencesPage: FC<Props> = ({
  backendStatus,
  autoSaveEnabled,
  onAutoSaveChange,
}) => {
  const [bannerDismissed, setBannerDismissed] = useState(() => getHyprlandBannerDismissed());
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div style={PAGE_BASE}>
      <h1 style={PAGE_HEADING}>Preferencias</h1>
      <p style={PAGE_NOTE}>
        Opciones locales de Linux Control Center (no forman parte de Hyprland). Se guardan en el
        navegador / WebView mediante <code style={{ fontSize: 12 }}>localStorage</code>.
      </p>
      {backendStatus === "unavailable" && (
        <p style={{ ...PAGE_NOTE, marginTop: -12 }}>
          Backend no disponible: el guardado automático en disco no funcionará.
        </p>
      )}

      <section style={{ ...psCard, padding: 20, maxWidth: 560 }}>
        <h2 style={styles.h2}>Guardado</h2>
        <label style={styles.row}>
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={(e) => {
              const v = e.target.checked;
              setAutoSavePreference(v);
              onAutoSaveChange(v);
              setMsg(v ? "Guardado automático activado." : "Guardado automático desactivado.");
            }}
          />
          <span>Guardar automáticamente los cambios en el backend (debounce ~800 ms)</span>
        </label>
        <p style={styles.hint}>
          Si está desactivado, usa «Save» en cada página o guarda desde perfiles como hasta ahora.
        </p>
      </section>

      <section style={{ ...psCard, padding: 20, maxWidth: 560, marginTop: 20 }}>
        <h2 style={styles.h2}>Aviso de Hyprland</h2>
        <p style={styles.p}>
          Si ocultaste el banner amarillo de «Hyprland no detectado», puedes volver a mostrarlo la
          próxima vez que inicies la app.
        </p>
        <button
          type="button"
          className="ps-btn-secondary"
          disabled={!bannerDismissed}
          onClick={() => {
            setHyprlandBannerDismissed(false);
            setBannerDismissed(false);
            setMsg("El aviso se mostrará de nuevo al recargar o al reiniciar la app.");
          }}
        >
          Restaurar aviso de sesión Hyprland
        </button>
      </section>

      {msg && (
        <p style={{ ...styles.msg, color: ps.textSecondary }} role="status">
          {msg}
        </p>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  h2: { fontSize: 15, fontWeight: 600, marginBottom: 12, color: ps.textPrimary },
  row: { display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 14 },
  hint: { fontSize: 12, color: ps.textMuted, marginTop: 10, lineHeight: 1.5 },
  p: { fontSize: 13, color: ps.textSecondary, lineHeight: 1.55, marginBottom: 12 },
  msg: { marginTop: 16, fontSize: 13 },
};

export default PreferencesPage;
