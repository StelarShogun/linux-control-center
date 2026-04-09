import { useEffect, useState, type FC } from "react";
import type { AppSettings, HyprlandSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import {
  applyConfigToRealPath,
  applyConfigToSandbox,
  applyLiveHyprland,
  previewHyprlandConfig,
  saveSettings,
} from "../tauri/api";
import type { ApplyLiveResult, ApplyToRealPathResult } from "../tauri/types";
import OpMessage, { type OpMsg } from "../components/OpMessage";
import WriteResultPanel from "../components/WriteResultPanel";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

const HyprlandPage: FC<Props> = ({ settings, onSettingsChange, backendStatus }) => {
  const [busy, setBusy] = useState(false);
  const [activeOp, setActiveOp] = useState<string | null>(null);
  const [message, setMessage] = useState<OpMsg | null>(null);
  const [configPreview, setConfigPreview] = useState<string | null>(null);
  const [sandboxResult, setSandboxResult] = useState<{ path: string; snapshotId: string } | null>(null);
  const [realResult, setRealResult] = useState<ApplyToRealPathResult | null>(null);
  const [liveResult, setLiveResult] = useState<ApplyLiveResult | null>(null);

  const startOp = (label: string) => {
    setBusy(true);
    setActiveOp(label);
    setMessage({ kind: "info", text: `${label}…` });
  };
  const endOp = () => {
    setBusy(false);
    setActiveOp(null);
  };

  useEffect(() => {
    if (backendStatus !== "ready") return;
    previewHyprlandConfig()
      .then(setConfigPreview)
      .catch(() => setConfigPreview(null));
  }, [backendStatus, settings.hyprland]);

  const local = settings.hyprland;
  const update = <K extends keyof HyprlandSettings>(
    key: K,
    value: HyprlandSettings[K]
  ) =>
    onSettingsChange({
      ...settings,
      hyprland: { ...settings.hyprland, [key]: value },
    });

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Hyprland</h1>
      <p style={styles.note}>
        Controla gaps, bordes, blur, rounding y animaciones.
        Los cambios se aplican a <code>~/.config/hypr/generated/linux-control-center.conf</code> sin tocar el resto de tu configuración.
      </p>
      {backendStatus === "loading" && (
        <div style={styles.statusBanner}>Cargando configuración…</div>
      )}
      {backendStatus === "unavailable" && (
        <div style={{ ...styles.statusBanner, ...styles.statusBannerError }}>
          Backend no disponible. Ejecuta la app con Tauri para usar todas las funciones.
        </div>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Gaps & Borders</h2>
        <NumField
          label="Gaps inner"
          unit="px"
          value={local.gaps_in}
          min={0}
          max={32}
          onChange={(v) => update("gaps_in", v)}
        />
        <NumField
          label="Gaps outer"
          unit="px"
          value={local.gaps_out}
          min={0}
          max={64}
          onChange={(v) => update("gaps_out", v)}
        />
        <NumField
          label="Border size"
          unit="px"
          value={local.border_size}
          min={0}
          max={8}
          onChange={(v) => update("border_size", v)}
        />
        <ColorField
          label="Active border"
          value={local.active_border_color}
          onChange={(v) => update("active_border_color", v)}
        />
        <ColorField
          label="Inactive border"
          value={local.inactive_border_color}
          onChange={(v) => update("inactive_border_color", v)}
        />
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Decoration</h2>
        <NumField
          label="Corner rounding"
          unit="px"
          value={local.rounding}
          min={0}
          max={32}
          onChange={(v) => update("rounding", v)}
        />
        <BoolField
          label="Blur"
          value={local.blur_enabled}
          onChange={(v) => update("blur_enabled", v)}
        />
        {local.blur_enabled && (
          <>
            <NumField
              label="Blur size"
              unit=""
              value={local.blur_size}
              min={1}
              max={16}
              onChange={(v) => update("blur_size", v)}
            />
            <NumField
              label="Blur passes"
              unit=""
              value={local.blur_passes}
              min={1}
              max={8}
              onChange={(v) => update("blur_passes", v)}
            />
          </>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Animations</h2>
        <BoolField
          label="Enabled"
          value={local.animations_enabled}
          onChange={(v) => update("animations_enabled", v)}
        />
      </section>

      <div style={styles.actionRow}>
        <button
          style={styles.saveBtn}
          disabled={backendStatus !== "ready" || busy}
          onClick={async () => {
            if (!window.confirm("¿Guardar los cambios de Hyprland?\n\nGuarda los settings en la app. No escribe en disco todavía.")) return;
            startOp("Guardando");
            try {
              const saved = await saveSettings({ settings });
              onSettingsChange(saved);
              setMessage({ kind: "success", text: "Settings guardados." });
            } catch (e) {
              setMessage({ kind: "error", text: `Error al guardar: ${String(e)}` });
            } finally {
              endOp();
            }
          }}
        >
          {activeOp === "Guardando" ? "Guardando…" : "Save"}
        </button>

        <button
          style={styles.saveBtnNeutral}
          disabled={backendStatus !== "ready" || busy}
          onClick={async () => {
            if (!window.confirm("Apply to sandbox\n\nEscribe la config en {app_data_dir}/exported/ sin tocar ~/.config.")) return;
            startOp("Sandbox");
            setSandboxResult(null);
            try {
              const res = await applyConfigToSandbox({ target: "Hyprland", snapshot_label: "apply-to-sandbox" });
              setSandboxResult({ path: res.write.target_path, snapshotId: res.snapshot.id });
              setMessage({ kind: "success", text: "Config escrita en sandbox." });
            } catch (e) {
              setMessage({ kind: "error", text: `Error (sandbox): ${String(e)}` });
            } finally {
              endOp();
            }
          }}
        >
          {activeOp === "Sandbox" ? "Escribiendo…" : "Apply to sandbox"}
        </button>

        <button
          style={styles.saveBtnAmber}
          disabled={backendStatus !== "ready" || busy}
          onClick={async () => {
            if (!window.confirm("Write to ~/.config\n\nEscribe ~/.config/hypr/generated/linux-control-center.conf.\nSe hace backup del archivo anterior.")) return;
            startOp("Write to ~/.config");
            setRealResult(null);
            try {
              const res = await applyConfigToRealPath({ target: "HyprlandGeneratedConfig", snapshot_label: "apply-real" });
              setRealResult(res);
              setMessage({ kind: "success", text: "Config escrita en ~/.config/hypr/generated/." });
            } catch (e) {
              setMessage({ kind: "error", text: `Error (write real): ${String(e)}` });
            } finally {
              endOp();
            }
          }}
        >
          {activeOp === "Write to ~/.config" ? "Escribiendo…" : "Write to ~/.config"}
        </button>

        <button
          style={styles.saveBtnGreen}
          disabled={backendStatus !== "ready" || busy}
          onClick={async () => {
            if (!window.confirm("Apply live\n\nEscribe ~/.config/hypr/generated/linux-control-center.conf y ejecuta hyprctl reload.\nSe hace backup del archivo anterior antes de sobrescribir.")) return;
            startOp("Apply live");
            setLiveResult(null);
            try {
              const res = await applyLiveHyprland({ snapshot_label: "apply-live" });
              setLiveResult(res);
              setMessage({
                kind: res.reload_ok ? "success" : "warning",
                text: res.reload_ok
                  ? "Config escrita y Hyprland recargado."
                  : "Config escrita. Reload falló — los cambios se aplicarán al reiniciar Hyprland.",
              });
            } catch (e) {
              setMessage({ kind: "error", text: `Error (apply live): ${String(e)}` });
            } finally {
              endOp();
            }
          }}
        >
          {activeOp === "Apply live" ? "Aplicando…" : "Apply live ⚡"}
        </button>
      </div>

      <OpMessage message={message} />

      {realResult && (
        <WriteResultPanel
          label="write to ~/.config — resultado"
          targetPath={realResult.write.target_path}
          backupFileName={realResult.backup_file_name}
          snapshotId={realResult.snapshot.id}
          rollbackTarget="HyprlandGeneratedConfig"
          onRollbackSuccess={(s) => { onSettingsChange(s as AppSettings); setRealResult(null); }}
          onMessage={setMessage}
        />
      )}

      {liveResult && (
        <WriteResultPanel
          label="apply live — resultado"
          targetPath={liveResult.write.target_path}
          backupFileName={liveResult.snapshot.backup_file_name}
          snapshotId={liveResult.snapshot.id}
          reloadOk={liveResult.reload_ok}
          reloadOutput={liveResult.reload_output}
          rollbackTarget="HyprlandGeneratedConfig"
          onRollbackSuccess={(s) => { onSettingsChange(s as AppSettings); setLiveResult(null); }}
          onMessage={setMessage}
        />
      )}

      {sandboxResult && (
        <WriteResultPanel
          label="sandbox — resultado"
          targetPath={sandboxResult.path}
          backupFileName={null}
          snapshotId={sandboxResult.snapshotId}
          isSandbox
        />
      )}

      {configPreview !== null && (
        <div style={styles.previewContainer}>
          <div style={styles.previewLabel}>hyprland.conf preview (generado, no aplicado)</div>
          <pre style={styles.preview}>{configPreview}</pre>
        </div>
      )}
    </div>
  );
};

const NumField: FC<{
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ label, unit, value, min, max, onChange }) => (
  <div style={styles.field}>
    <label style={styles.label}>{label}</label>
    <div style={styles.control}>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={styles.range}
      />
      <span style={styles.rangeValue}>
        {value}
        {unit}
      </span>
    </div>
  </div>
);

const ColorField: FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div style={styles.field}>
    <label style={styles.label}>{label}</label>
    <div style={styles.control}>
      <input
        type="color"
        style={styles.colorInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span style={styles.colorValue}>{value}</span>
    </div>
  </div>
);

const BoolField: FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div style={styles.field}>
    <label style={styles.label}>{label}</label>
    <div style={styles.control}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, cursor: "pointer" }}
      />
      <span style={styles.boolLabel}>{value ? "enabled" : "disabled"}</span>
    </div>
  </div>
);

const BTN_BASE: React.CSSProperties = {
  borderRadius: 8,
  padding: "9px 14px",
  cursor: "pointer",
  fontSize: 13,
  border: "1px solid",
  fontWeight: 500,
  flexShrink: 0,
};

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "32px 40px", maxWidth: 680 },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 },
  statusBanner: {
    fontSize: 12,
    color: "#9ca3af",
    background: "#151722",
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 24,
  },
  statusBannerError: {
    color: "#fca5a5",
    background: "#1f0b0b",
    borderColor: "#3a1f1f",
  },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#88c0d0",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: "1px solid #2e3250",
  },
  field: { display: "flex", alignItems: "center", gap: 16, marginBottom: 12 },
  label: { width: 140, fontSize: 13, color: "#9ca3af", flexShrink: 0 },
  control: { display: "flex", alignItems: "center", gap: 8 },
  range: { width: 160, accentColor: "#88c0d0" },
  rangeValue: { fontSize: 13, color: "#e2e8f0", width: 48, fontFamily: "monospace" },
  colorInput: { width: 36, height: 28, border: "none", cursor: "pointer" },
  colorValue: { fontSize: 13, color: "#9ca3af", fontFamily: "monospace" },
  boolLabel: { fontSize: 13, color: "#9ca3af" },
  actionRow: { display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 8 },
  saveBtn: { ...BTN_BASE, background: "#2e3250", borderColor: "#2e3250", color: "#e2e8f0" },
  saveBtnNeutral: { ...BTN_BASE, background: "#1e2030", borderColor: "#2e3250", color: "#9ca3af" },
  saveBtnAmber: { ...BTN_BASE, background: "#1a1500", borderColor: "#4a3f20", color: "#fbbf24" },
  saveBtnGreen: { ...BTN_BASE, background: "#0b1f1a", borderColor: "#1a3a2a", color: "#6ee7b7" },
  previewContainer: { marginTop: 24 },
  previewLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  preview: {
    background: "#151722",
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: 16,
    fontSize: 12,
    color: "#88c0d0",
    overflow: "auto",
    fontFamily: "monospace",
  },
};

export default HyprlandPage;
