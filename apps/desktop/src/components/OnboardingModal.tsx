import { useEffect, useState, type FC } from "react";
import {
  getHyprlandOnboardingDone,
  setHyprlandOnboardingDone,
} from "../app/appPreferences";
import { inspectHyprlandSetup, repairHyprlandMainInclude } from "../tauri/api";
import { ps } from "../theme/playstationDark";

interface Props {
  backendReady: boolean;
}

const OnboardingModal: FC<Props> = ({ backendReady }) => {
  const [open, setOpen] = useState(false);
  const [canRepair, setCanRepair] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!backendReady || getHyprlandOnboardingDone()) return;
    let cancelled = false;
    void inspectHyprlandSetup()
      .then((s) => {
        if (cancelled) return;
        if (s.state.type === "ManagedIncludeAbsent" && s.can_auto_repair) {
          setCanRepair(true);
          setOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [backendReady]);

  if (!open || !canRepair) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onb-title"
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: ps.surfaceOverlay,
          border: `1px solid ${ps.borderDefault}`,
          borderRadius: 12,
          padding: 24,
          boxShadow: ps.shadowDropdown,
        }}
      >
        <h2 id="onb-title" style={{ marginTop: 0, fontSize: 18, fontWeight: 600 }}>
          Configurar Hyprland
        </h2>
        <p style={{ fontSize: 14, color: ps.textSecondary, lineHeight: 1.5 }}>
          Falta el include gestionado en <code>hyprland.conf</code>. Linux Control Center puede
          insertarlo de forma idempotente para que las opciones generadas se carguen al iniciar el
          compositor.
        </p>
        {msg && <p style={{ fontSize: 13, color: ps.dangerText }}>{msg}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="ps-btn-secondary"
            disabled={busy}
            onClick={() => {
              setHyprlandOnboardingDone(true);
              setOpen(false);
            }}
          >
            Ahora no
          </button>
          <button
            type="button"
            className="ps-btn-primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setMsg(null);
              void repairHyprlandMainInclude()
                .then(() => {
                  setHyprlandOnboardingDone(true);
                  setOpen(false);
                })
                .catch((e) => setMsg(String(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Insertando…" : "Insertar include"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
