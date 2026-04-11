import { useCallback, useEffect, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import type { PowerProfileKind, PowerStatus, SuspendSettings } from "../types/generated";
import {
  getPowerStatus,
  getSuspendSettings,
  setPowerProfile,
  setSuspendSettings,
} from "../tauri/api";
import { PAGE_BASE } from "../layout/pageLayout";

interface Props {
  backendStatus: BackendStatus;
}

const PROFILE_OPTIONS: { kind: PowerProfileKind; label: string }[] = [
  { kind: "performance", label: "Rendimiento" },
  { kind: "balanced", label: "Equilibrado" },
  { kind: "power_saver", label: "Ahorro" },
];

const BASE_SUSPEND_OPTIONS: { seconds: number | null; label: string }[] = [
  { seconds: null, label: "Nunca" },
  { seconds: 300, label: "5 minutos" },
  { seconds: 600, label: "10 minutos" },
  { seconds: 900, label: "15 minutos" },
  { seconds: 1200, label: "20 minutos" },
  { seconds: 1800, label: "30 minutos" },
  { seconds: 2700, label: "45 minutos" },
  { seconds: 3600, label: "1 hora" },
  { seconds: 7200, label: "2 horas" },
];

function suspendValue(seconds: number | null | undefined): string {
  return seconds == null ? "never" : String(seconds);
}

function formatSuspendTimeout(seconds: number | null | undefined): string {
  if (seconds == null) {
    return "Nunca";
  }
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

function suspendOptions(currentSeconds: number | null | undefined): { seconds: number | null; label: string }[] {
  if (
    currentSeconds == null ||
    BASE_SUSPEND_OPTIONS.some((option) => option.seconds === currentSeconds)
  ) {
    return BASE_SUSPEND_OPTIONS;
  }

  return [
    { seconds: currentSeconds, label: `${formatSuspendTimeout(currentSeconds)} (actual)` },
    ...BASE_SUSPEND_OPTIONS,
  ];
}

function currentSuspendLabel(status: PowerStatus | null, suspend: SuspendSettings | null): string {
  if (status?.on_ac === true) {
    return formatSuspendTimeout(suspend?.ac_timeout_seconds);
  }
  if (status?.on_ac === false) {
    return formatSuspendTimeout(suspend?.battery_timeout_seconds);
  }
  if (suspend?.battery_timeout_seconds === suspend?.ac_timeout_seconds) {
    return formatSuspendTimeout(suspend?.ac_timeout_seconds);
  }
  return `${formatSuspendTimeout(suspend?.battery_timeout_seconds)} / ${formatSuspendTimeout(
    suspend?.ac_timeout_seconds
  )}`;
}

function suspendHint(settings: SuspendSettings | null): string {
  if (!settings) {
    return "Se usara ~/.config/hypr/hypridle.conf para controlar la suspension automatica.";
  }
  if (!settings.binary_available) {
    return "hypridle no esta instalado en PATH. Puedes guardar el ajuste, pero la suspension automatica no funcionara hasta instalarlo.";
  }
  if (!settings.config_exists) {
    return "Se creara ~/.config/hypr/hypridle.conf cuando apliques los tiempos de suspension.";
  }
  return "Se escriben listeners gestionados independientes para bateria y corriente. Si hypridle se inicio fuera de systemd --user, reinicialo para recargar el archivo.";
}

const PowerPage: FC<Props> = ({ backendStatus }) => {
  const [status, setStatus] = useState<PowerStatus | null>(null);
  const [suspend, setSuspend] = useState<SuspendSettings | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [suspendBusy, setSuspendBusy] = useState(false);
  const [selectedBatteryTimeout, setSelectedBatteryTimeout] = useState("never");
  const [selectedAcTimeout, setSelectedAcTimeout] = useState("never");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (backendStatus !== "ready") return;
    try {
      const [power, suspendSettings] = await Promise.all([getPowerStatus(), getSuspendSettings()]);
      setStatus(power);
      setSuspend(suspendSettings);
      setSelectedBatteryTimeout(suspendValue(suspendSettings.battery_timeout_seconds));
      setSelectedAcTimeout(suspendValue(suspendSettings.ac_timeout_seconds));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [backendStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (backendStatus !== "ready") return;
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [backendStatus, load]);

  const applyProfile = async (kind: PowerProfileKind) => {
    if (kind === "unknown" || backendStatus !== "ready" || !status?.can_set_profile) return;
    setProfileBusy(true);
    setError(null);
    try {
      await setPowerProfile(kind);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setProfileBusy(false);
    }
  };

  const applySuspend = async () => {
    if (backendStatus !== "ready") return;
    setSuspendBusy(true);
    setError(null);
    try {
      await setSuspendSettings(
        selectedBatteryTimeout === "never" ? null : Number(selectedBatteryTimeout),
        selectedAcTimeout === "never" ? null : Number(selectedAcTimeout)
      );
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSuspendBusy(false);
    }
  };

  const availableProfiles = status?.available_profiles ?? [];
  const currentBatteryValue = suspendValue(suspend?.battery_timeout_seconds);
  const currentAcValue = suspendValue(suspend?.ac_timeout_seconds);
  const hasSuspendChanges =
    selectedBatteryTimeout !== currentBatteryValue || selectedAcTimeout !== currentAcValue;

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Energía</h1>
      <p style={styles.note}>
        Perfiles via <code>powerprofilesctl</code> y suspension automatica via <code>hypridle</code>
        con tiempos separados para bateria y corriente, como en Windows.
      </p>
      {backendStatus !== "ready" && <p style={styles.note}>Backend no disponible.</p>}
      {backendStatus === "ready" && (
        <div style={styles.toolbar}>
          <button
            type="button"
            style={styles.btn}
            onClick={() => void load()}
            disabled={profileBusy || suspendBusy}
          >
            Refrescar ahora
          </button>
        </div>
      )}
      {error && <p style={{ ...styles.note, color: "#f87171" }}>{error}</p>}
      {status && (
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.k}>Fuente</span>
            <span>{status.source}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.k}>Perfil activo</span>
            <code style={styles.mono}>{status.profile_label || status.profile}</code>
          </div>
          {status.battery_percent != null && (
            <div style={styles.row}>
              <span style={styles.k}>Batería</span>
              <span>{status.battery_percent}%</span>
            </div>
          )}
          {status.on_ac != null && (
            <div style={styles.row}>
              <span style={styles.k}>AC</span>
              <span>{status.on_ac ? "conectado" : "bateria"}</span>
            </div>
          )}
          <div style={styles.row}>
            <span style={styles.k}>Suspender con batería</span>
            <span>{formatSuspendTimeout(suspend?.battery_timeout_seconds)}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.k}>Suspender conectado</span>
            <span>{formatSuspendTimeout(suspend?.ac_timeout_seconds)}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.k}>Se aplicará ahora</span>
            <span>{currentSuspendLabel(status, suspend)}</span>
          </div>
        </div>
      )}
      {backendStatus === "ready" && (
        <>
          <div style={styles.section}>
            <h2 style={styles.h2}>Perfiles de energía</h2>
            <div style={styles.btns}>
              {PROFILE_OPTIONS.map((option) => {
                const supported =
                  status?.can_set_profile === true &&
                  (availableProfiles.length === 0 || availableProfiles.includes(option.kind));
                const active = status?.profile === option.kind;

                return (
                  <button
                    key={option.kind}
                    type="button"
                    style={{
                      ...styles.profileBtn,
                      ...(active ? styles.profileBtnActive : {}),
                      ...(!supported ? styles.profileBtnDisabled : {}),
                    }}
                    disabled={!supported || profileBusy}
                    onClick={() => void applyProfile(option.kind)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p style={styles.hint}>
              {status?.can_set_profile
                ? "Solo se habilitan los perfiles que el sistema reporta como soportados."
                : "No se detecto powerprofilesctl; solo se muestra telemetria basica de bateria y AC."}
            </p>
          </div>

          <div style={styles.section}>
            <h2 style={styles.h2}>Suspensión</h2>
            <p style={styles.note}>
              Configura por separado cuánto esperar antes de suspender cuando el equipo está con
              batería o conectado a la corriente.
            </p>
            <div style={styles.suspendPanel}>
              <div style={styles.suspendGrid}>
                <label style={styles.fieldGroup} htmlFor="suspend-battery-timeout">
                  <span style={styles.fieldLabel}>Con batería</span>
                  <select
                    id="suspend-battery-timeout"
                    style={styles.select}
                    value={selectedBatteryTimeout}
                    onChange={(e) => setSelectedBatteryTimeout(e.target.value)}
                    disabled={suspendBusy}
                  >
                    {suspendOptions(suspend?.battery_timeout_seconds).map((option) => (
                      <option
                        key={`battery-${option.seconds == null ? "never" : option.seconds}`}
                        value={option.seconds == null ? "never" : String(option.seconds)}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.fieldGroup} htmlFor="suspend-ac-timeout">
                  <span style={styles.fieldLabel}>Con corriente</span>
                  <select
                    id="suspend-ac-timeout"
                    style={styles.select}
                    value={selectedAcTimeout}
                    onChange={(e) => setSelectedAcTimeout(e.target.value)}
                    disabled={suspendBusy}
                  >
                    {suspendOptions(suspend?.ac_timeout_seconds).map((option) => (
                      <option
                        key={`ac-${option.seconds == null ? "never" : option.seconds}`}
                        value={option.seconds == null ? "never" : String(option.seconds)}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={styles.actionsRow}>
                <button
                  type="button"
                  style={styles.btn}
                  disabled={suspendBusy || !hasSuspendChanges}
                  onClick={() => void applySuspend()}
                >
                  {suspendBusy ? "Aplicando…" : "Aplicar"}
                </button>
              </div>
            </div>
            <p style={styles.hint}>{suspendHint(suspend)}</p>
            {suspend?.config_path && (
              <p style={styles.hint}>
                Archivo: <code>{suspend.config_path}</code>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 },
  toolbar: { marginBottom: 16 },
  btn: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid #3d4466",
    background: "#252840",
    color: "#a0aec0",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  },
  card: {
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: 16,
    background: "#12141c",
    marginBottom: 24,
  },
  row: { display: "flex", gap: 12, fontSize: 13, color: "#d1d5db", marginBottom: 8 },
  k: { color: "#6b7280", minWidth: 160 },
  mono: { color: "#88c0d0" },
  section: { marginTop: 8, marginBottom: 24 },
  h2: { fontSize: 14, color: "#88c0d0", marginBottom: 12 },
  btns: { display: "flex", flexWrap: "wrap", gap: 10 },
  profileBtn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #3d5a50",
    background: "#15201c",
    color: "#86efac",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  },
  profileBtnActive: {
    borderColor: "#86efac",
    boxShadow: "0 0 0 1px rgba(134, 239, 172, 0.25)",
    background: "#193126",
  },
  profileBtnDisabled: {
    borderColor: "#343b46",
    background: "#171a22",
    color: "#6b7280",
    cursor: "not-allowed",
  },
  suspendPanel: {
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: 16,
    background: "#12141c",
  },
  suspendGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  fieldLabel: {
    display: "block",
    fontSize: 13,
    color: "#d1d5db",
  },
  actionsRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  select: {
    minWidth: 220,
    padding: "9px 12px",
    borderRadius: 6,
    border: "1px solid #3d4466",
    background: "#181c28",
    color: "#e2e8f0",
    fontSize: 13,
    fontFamily: "inherit",
  },
  hint: { fontSize: 11, color: "#6b7280", marginTop: 12, lineHeight: 1.6 },
};

export default PowerPage;
