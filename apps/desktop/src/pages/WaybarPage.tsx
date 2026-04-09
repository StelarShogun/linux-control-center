import { useEffect, useState, type FC } from "react";
import type { AppSettings, WaybarSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import {
  applyConfigToRealPath,
  applyConfigToSandbox,
  previewWaybarConfig,
  saveSettings,
} from "../tauri/api";
import type { ApplyToRealPathResult } from "../tauri/types";
import OpMessage, { type OpMsg } from "../components/OpMessage";
import WriteResultPanel from "../components/WriteResultPanel";

const VALID_POSITIONS = ["top", "bottom", "left", "right"] as const;

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

const WaybarPage: FC<Props> = ({ settings, onSettingsChange, backendStatus }) => {
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
    previewWaybarConfig()
      .then(setConfigPreview)
      .catch(() => setConfigPreview(null));
  }, [backendStatus, settings.waybar]);

  const local = settings.waybar;

  const update = <K extends keyof WaybarSettings>(
    key: K,
    value: WaybarSettings[K]
  ) =>
    onSettingsChange({
      ...settings,
      waybar: { ...settings.waybar, [key]: value },
    });

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Waybar</h1>
      <p style={styles.note}>
        Controla posición, altura, módulos y opacidad de Waybar.
        Escribe <code>~/.config/waybar/config.jsonc</code> con backup automático.
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
        <h2 style={styles.sectionTitle}>Bar</h2>
        <div style={styles.field}>
          <label style={styles.label}>Position</label>
          <select
            style={styles.select}
            value={local.position}
            onChange={(e) =>
              update(
                "position",
                e.target.value as WaybarSettings["position"]
              )
            }
          >
            {VALID_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Height</label>
          <input
            type="range"
            min={20}
            max={56}
            value={local.height}
            onChange={(e) => update("height", Number(e.target.value))}
            style={styles.range}
          />
          <span style={styles.rangeValue}>{local.height}px</span>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Modules</h2>
        <ModuleList
          label="Left"
          modules={local.modules_left}
          onChange={(v) => update("modules_left", v)}
        />
        <ModuleList
          label="Center"
          modules={local.modules_center}
          onChange={(v) => update("modules_center", v)}
        />
        <ModuleList
          label="Right"
          modules={local.modules_right}
          onChange={(v) => update("modules_right", v)}
        />
      </section>

      <div style={styles.actionRow}>
        <button
          style={styles.saveBtn}
          disabled={backendStatus !== "ready" || busy}
          onClick={async () => {
            if (!window.confirm("¿Guardar los cambios de Waybar?\n\nGuarda los settings en la app. No escribe en disco todavía.")) return;
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
              const res = await applyConfigToSandbox({ target: "Waybar", snapshot_label: "apply-to-sandbox" });
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
            if (!window.confirm("Write to ~/.config\n\nEscribe ~/.config/waybar/config.jsonc.\nSe hace backup del archivo anterior.")) return;
            startOp("Write to ~/.config");
            setRealResult(null);
            try {
              const res = await applyConfigToRealPath({ target: "WaybarConfig", snapshot_label: "apply-real" });
              setRealResult(res);
              setMessage({ kind: "success", text: "Config escrita en ~/.config/waybar/." });
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
          rollbackTarget="WaybarConfig"
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
          <div style={styles.previewLabel}>config.jsonc preview (generado, no aplicado)</div>
          <pre style={styles.preview}>{configPreview}</pre>
        </div>
      )}
    </div>
  );
};

const ModuleList: FC<{
  label: string;
  modules: string[];
  onChange: (v: string[]) => void;
}> = ({ label, modules, onChange }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>
      {label}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {modules.map((m, i) => (
        <span key={i} style={styles.chip}>
          {m}
          <button
            style={styles.chipRemove}
            onClick={() => onChange(modules.filter((_, idx) => idx !== i))}
            title="Remove"
          >
            ×
          </button>
        </span>
      ))}
    </div>
    <p style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>
      Edición de módulos pendiente (add/reorder). Solo visualización.
    </p>
  </div>
);

const BTN_BASE: React.CSSProperties = {
  borderRadius: 8, padding: "9px 14px", cursor: "pointer",
  fontSize: 13, border: "1px solid", fontWeight: 500, flexShrink: 0,
};

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "32px 40px", maxWidth: 680 },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 },
  statusBanner: { fontSize: 12, color: "#9ca3af", background: "#151722", border: "1px solid #2e3250", borderRadius: 8, padding: "8px 12px", marginBottom: 24 },
  statusBannerError: { color: "#fca5a5", background: "#1f0b0b", borderColor: "#3a1f1f" },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 13, fontWeight: 600, color: "#88c0d0", textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #2e3250",
  },
  field: { display: "flex", alignItems: "center", gap: 16, marginBottom: 12 },
  label: { width: 100, fontSize: 13, color: "#9ca3af", flexShrink: 0 },
  select: { background: "#1e2030", border: "1px solid #2e3250", borderRadius: 6, color: "#e2e8f0", padding: "4px 8px", fontSize: 13 },
  range: { width: 160, accentColor: "#88c0d0" },
  rangeValue: { fontSize: 13, color: "#e2e8f0", fontFamily: "monospace" },
  chip: { display: "inline-flex", alignItems: "center", gap: 4, background: "#2e3250", borderRadius: 4, padding: "3px 8px", fontSize: 12, color: "#c4c9e2", fontFamily: "monospace" },
  chipRemove: { background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 },
  actionRow: { display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 8 },
  saveBtn: { ...BTN_BASE, background: "#2e3250", borderColor: "#2e3250", color: "#e2e8f0" },
  saveBtnNeutral: { ...BTN_BASE, background: "#1e2030", borderColor: "#2e3250", color: "#9ca3af" },
  saveBtnAmber: { ...BTN_BASE, background: "#1a1500", borderColor: "#4a3f20", color: "#fbbf24" },
  previewContainer: { marginTop: 24 },
  previewLabel: { fontSize: 11, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  preview: { background: "#151722", border: "1px solid #2e3250", borderRadius: 8, padding: 16, fontSize: 12, color: "#88c0d0", overflow: "auto", fontFamily: "monospace" },
};

export default WaybarPage;
