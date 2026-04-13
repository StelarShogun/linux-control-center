import { useEffect, useState, type FC } from "react";
import type { Page } from "./Sidebar";
import { hyprctlVersionJson } from "../tauri/api";
import { getHyprlandBannerDismissed, setHyprlandBannerDismissed } from "../app/appPreferences";
import { ps } from "../theme/playstationDark";

interface Props {
  backendReady: boolean;
  onNavigate: (page: Page) => void;
}

const HyprlandRuntimeBanner: FC<Props> = ({ backendReady, onNavigate }) => {
  const [dismissed, setDismissed] = useState(() => getHyprlandBannerDismissed());
  const [checking, setChecking] = useState(true);
  const [hyprOk, setHyprOk] = useState(true);

  useEffect(() => {
    if (!backendReady) {
      setChecking(true);
      return;
    }
    let cancelled = false;
    setChecking(true);
    hyprctlVersionJson()
      .then((raw) => {
        if (cancelled) return;
        try {
          const j = JSON.parse(raw) as { branch?: string };
          setHyprOk(Boolean(j && typeof j === "object"));
        } catch {
          setHyprOk(false);
        }
      })
      .catch(() => {
        if (!cancelled) setHyprOk(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [backendReady]);

  if (!backendReady || dismissed || checking || hyprOk) return null;

  const dismiss = () => {
    setHyprlandBannerDismissed(true);
    setDismissed(true);
  };

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "8px 20px",
        background: "rgba(180, 100, 20, 0.18)",
        borderBottom: `1px solid ${ps.borderDefault}`,
        color: ps.textSecondary,
        fontSize: 13,
      }}
    >
      <span>
        No se detectó una sesión Hyprland activa (o <code style={{ fontSize: 12 }}>hyprctl</code> no
        responde). Las acciones en vivo y la lectura del compositor pueden fallar.
      </span>
      <button type="button" className="ps-btn-secondary" onClick={() => onNavigate("hyprland")}>
        Ir a Hyprland
      </button>
      <button type="button" className="ps-btn-secondary" onClick={dismiss}>
        Ocultar
      </button>
    </div>
  );
};

export default HyprlandRuntimeBanner;
