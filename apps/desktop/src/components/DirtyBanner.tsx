import { useEffect, useRef, useState, type FC } from "react";
import { saveSettings } from "../tauri/api";
import { useSettingsSession } from "../app/SettingsSessionContext";
import { ps } from "../theme/playstationDark";

type ActiveProfile = {
  id: string;
  name: string;
} | null;

interface Props {
  busy?: boolean;
  onBusyChange?: (v: boolean) => void;
  /** Fase 8: perfil activo para menú de guardado extendido */
  activeProfile?: ActiveProfile;
  onSaveAndUpdateProfile?: () => Promise<void>;
  onSaveWithoutProfile?: () => Promise<void>;
  onSaveAsNewProfile?: () => Promise<void>;
}

const DirtyBanner: FC<Props> = ({
  busy = false,
  onBusyChange,
  activeProfile,
  onSaveAndUpdateProfile,
  onSaveWithoutProfile,
  onSaveAsNewProfile,
}) => {
  const { isDirty, settings, markSaved, discardToBaseline } = useSettingsSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuWrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  if (!isDirty) return null;

  const doSave = async () => {
    onBusyChange?.(true);
    setMsg(null);
    try {
      const saved = await saveSettings({ settings });
      markSaved(saved);
      setMsg("Guardado en disco.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      onBusyChange?.(false);
      setMenuOpen(false);
    }
  };

  const splitProfile = Boolean(activeProfile && onSaveAndUpdateProfile);

  return (
    <div
      role="region"
      aria-label="Cambios sin guardar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        padding: "8px 20px",
        background: "rgba(200, 140, 40, 0.2)",
        borderBottom: `1px solid ${ps.borderDefault}`,
        fontSize: 13,
        color: ps.textSecondary,
      }}
    >
      <span style={{ flex: "1 1 200px" }}>
        Hay cambios no guardados en disco (pueden estar aplicados en vivo vía Hyprland). Guarda o
        descarta.
      </span>
      {msg && (
        <span style={{ fontSize: 12, color: msg.startsWith("Error") ? ps.dangerText : ps.successText }}>
          {msg}
        </span>
      )}
      <button
        type="button"
        className="ps-btn-secondary"
        disabled={busy}
        onClick={() => {
          discardToBaseline();
          setMsg(null);
        }}
      >
        Descartar
      </button>
      {splitProfile ? (
        <div ref={menuWrapRef} style={{ position: "relative", display: "flex", gap: 6 }}>
          <button type="button" className="ps-btn-primary" disabled={busy} onClick={() => void doSave()}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            className="ps-btn-secondary"
            disabled={busy}
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
          >
            Perfil ▾
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 4,
                minWidth: 220,
                background: ps.surfaceOverlay,
                border: `1px solid ${ps.borderDefault}`,
                borderRadius: 8,
                boxShadow: ps.shadowDropdown,
                zIndex: 40,
                display: "flex",
                flexDirection: "column",
                padding: 4,
              }}
            >
              <button
                type="button"
                className="ps-search-row"
                style={{ textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", color: ps.textPrimary }}
                onClick={() => {
                  void (async () => {
                    onBusyChange?.(true);
                    try {
                      await onSaveAndUpdateProfile?.();
                    } finally {
                      onBusyChange?.(false);
                      setMenuOpen(false);
                    }
                  })();
                }}
              >
                Guardar y actualizar perfil ({activeProfile?.name})
              </button>
              {onSaveWithoutProfile && (
                <button
                  type="button"
                  className="ps-search-row"
                  style={{ textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", color: ps.textPrimary }}
                  onClick={() => {
                    void (async () => {
                      onBusyChange?.(true);
                      try {
                        await onSaveWithoutProfile();
                      } finally {
                        onBusyChange?.(false);
                        setMenuOpen(false);
                      }
                    })();
                  }}
                >
                  Guardar sin actualizar perfil
                </button>
              )}
              {onSaveAsNewProfile && (
                <button
                  type="button"
                  className="ps-search-row"
                  style={{ textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", color: ps.textPrimary }}
                  onClick={() => {
                    void (async () => {
                      onBusyChange?.(true);
                      try {
                        await onSaveAsNewProfile();
                      } finally {
                        onBusyChange?.(false);
                        setMenuOpen(false);
                      }
                    })();
                  }}
                >
                  Guardar como perfil nuevo…
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <button type="button" className="ps-btn-primary" disabled={busy} onClick={() => void doSave()}>
          {busy ? "Guardando…" : "Guardar en disco"}
        </button>
      )}
    </div>
  );
};

export default DirtyBanner;
