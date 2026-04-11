import { useEffect, useState, type FC } from "react";
import type { AppSettings, RofiSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import {
  applyConfigToRealPath,
  applyConfigToSandbox,
  previewRofiConfig,
  saveSettings,
} from "../tauri/api";
import type { ApplyToRealPathResult } from "../tauri/types";
import OpMessage, { type OpMsg } from "../components/OpMessage";
import WriteResultPanel from "../components/WriteResultPanel";
import { PAGE_BASE } from "../layout/pageLayout";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

const RofiPage: FC<Props> = ({ settings, onSettingsChange, backendStatus }) => {
  const [busy, setBusy] = useState(false);
  const [activeOp, setActiveOp] = useState<string | null>(null);
  const [message, setMessage] = useState<OpMsg | null>(null);
  const [configPreview, setConfigPreview] = useState<string | null>(null);
  const [sandboxResult, setSandboxResult] = useState<{ path: string; snapshotId: string } | null>(null);
  const [realResult, setRealResult] = useState<ApplyToRealPathResult | null>(null);

  const startOp = (label: string) => { setBusy(true); setActiveOp(label); setMessage({ kind: "info", text: `${label}…` }); };
  const endOp = () => { setBusy(false); setActiveOp(null); };

  useEffect(() => {
    if (backendStatus !== "ready") return;
    previewRofiConfig()
      .then(setConfigPreview)
      .catch(() => setConfigPreview(null));
  }, [backendStatus, settings.rofi]);

  const local = settings.rofi;
  const update = <K extends keyof RofiSettings>(key: K, value: RofiSettings[K]) =>
    onSettingsChange({
      ...settings,
      rofi: { ...settings.rofi, [key]: value },
    });

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Rofi</h1>
      <p style={styles.note}>
        Controla font, iconos, modi y formato de Rofi.
        Escribe <code>~/.config/rofi/config.rasi</code> con backup automático.
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
        <h2 style={styles.sectionTitle}>Launcher</h2>
        <TextField
          label="Modi"
          value={local.modi}
          onChange={(v) => update("modi", v)}
        />
        <TextField
          label="Font"
          value={local.font}
          onChange={(v) => update("font", v)}
        />
        <TextField
          label="Icon theme"
          value={local.icon_theme}
          onChange={(v) => update("icon_theme", v)}
        />
        <BoolField
          label="Show icons"
          value={local.show_icons}
          onChange={(v) => update("show_icons", v)}
        />
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Labels</h2>
        <TextField
          label="Display drun"
          value={local.display_drun}
          onChange={(v) => update("display_drun", v)}
        />
        <TextField
          label="Display run"
          value={local.display_run}
          onChange={(v) => update("display_run", v)}
        />
        <TextField
          label="Display window"
          value={local.display_window}
          onChange={(v) => update("display_window", v)}
        />
        <TextField
          label="Drun display format"
          value={local.drun_display_format}
          onChange={(v) => update("drun_display_format", v)}
        />
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Theme</h2>
        <TextField
          label="Theme name"
          value={local.theme}
          onChange={(v) => update("theme", v)}
        />
        <p style={styles.fieldNote}>
          Reserved — @theme directive support is deferred to a future phase.
        </p>
      </section>

      <div style={styles.actionRow}>
        <button
          style={styles.saveBtn}
          disabled={backendStatus !== "ready" || busy}
          onClick={async () => {
            if (!window.confirm("¿Guardar los cambios de Rofi?\n\nGuarda los settings en la app. No escribe en disco todavía.")) return;
            startOp("Guardando");
            try {
              const saved = await saveSettings({ settings });
              onSettingsChange(saved);
              setMessage({ kind: "success", text: "Settings guardados." });
            } catch (e) {
              setMessage({ kind: "error", text: `Error al guardar: ${String(e)}` });
            } finally { endOp(); }
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
              const res = await applyConfigToSandbox({ target: "Rofi", snapshot_label: "apply-to-sandbox" });
              setSandboxResult({ path: res.write.target_path, snapshotId: res.snapshot.id });
              setMessage({ kind: "success", text: "Config escrita en sandbox." });
            } catch (e) {
              setMessage({ kind: "error", text: `Error (sandbox): ${String(e)}` });
            } finally { endOp(); }
          }}
        >
          {activeOp === "Sandbox" ? "Escribiendo…" : "Apply to sandbox"}
        </button>

        <button
          style={styles.saveBtnAmber}
          disabled={backendStatus !== "ready" || busy}
          onClick={async () => {
            if (!window.confirm("Write to ~/.config\n\nEscribe ~/.config/rofi/config.rasi.\nSe hace backup del archivo anterior.")) return;
            startOp("Write to ~/.config");
            setRealResult(null);
            try {
              const res = await applyConfigToRealPath({ target: "RofiConfig", snapshot_label: "apply-real" });
              setRealResult(res);
              setMessage({ kind: "success", text: "Config escrita en ~/.config/rofi/." });
            } catch (e) {
              setMessage({ kind: "error", text: `Error (write real): ${String(e)}` });
            } finally { endOp(); }
          }}
        >
          {activeOp === "Write to ~/.config" ? "Escribiendo…" : "Write to ~/.config"}
        </button>
      </div>

      <OpMessage message={message} />

      {realResult && (
        <WriteResultPanel
          label="write to ~/.config — resultado"
          targetPath={realResult.write.target_path}
          backupFileName={realResult.backup_file_name}
          snapshotId={realResult.snapshot.id}
          rollbackTarget="RofiConfig"
          onRollbackSuccess={(s) => { onSettingsChange(s as AppSettings); setRealResult(null); }}
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
          <div style={styles.previewLabel}>config.rasi preview (generado, no aplicado)</div>
          <pre style={styles.preview}>{configPreview}</pre>
        </div>
      )}
    </div>
  );
};

const TextField: FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div style={styles.field}>
    <label style={styles.label}>{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.textInput}
    />
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
  borderRadius: 8, padding: "9px 14px", cursor: "pointer",
  fontSize: 13, border: "1px solid", fontWeight: 500, flexShrink: 0,
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 },
  fieldNote: { fontSize: 12, color: "#6b7280", margin: "4px 0 0 0" },
  statusBanner: { fontSize: 12, color: "#9ca3af", background: "#151722", border: "1px solid #2e3250", borderRadius: 8, padding: "8px 12px", marginBottom: 24 },
  statusBannerError: { color: "#fca5a5", background: "#1f0b0b", borderColor: "#3a1f1f" },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 13, fontWeight: 600, color: "#88c0d0", textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #2e3250",
  },
  field: { display: "flex", alignItems: "center", gap: 16, marginBottom: 12 },
  label: { width: 140, fontSize: 13, color: "#9ca3af", flexShrink: 0 },
  control: { display: "flex", alignItems: "center", gap: 8 },
  textInput: { background: "#1a1d2e", border: "1px solid #2e3250", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 13, fontFamily: "monospace", width: 240 },
  boolLabel: { fontSize: 13, color: "#9ca3af" },
  actionRow: { display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 8 },
  saveBtn: { ...BTN_BASE, background: "#2e3250", borderColor: "#2e3250", color: "#e2e8f0" },
  saveBtnNeutral: { ...BTN_BASE, background: "#1e2030", borderColor: "#2e3250", color: "#9ca3af" },
  saveBtnAmber: { ...BTN_BASE, background: "#1a1500", borderColor: "#4a3f20", color: "#fbbf24" },
  previewContainer: { marginTop: 24 },
  previewLabel: { fontSize: 11, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  preview: {
    background: "#151722",
    border: "1px solid #2e3250",
    borderRadius: 8,
    padding: 16,
    fontSize: 12,
    color: "#88c0d0",
    overflow: "auto",
    fontFamily: "monospace",
    maxHeight: "min(55vh, 560px)",
  },
};

export default RofiPage;
