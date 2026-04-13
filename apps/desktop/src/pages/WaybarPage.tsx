import { useEffect, useState, type FC } from "react";
import type { AppSettings, WaybarSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import {
  applyConfigToRealPath,
  applyConfigToSandbox,
  applyLiveWaybar,
  previewWaybarConfig,
  saveSettings,
} from "../tauri/api";
import type { ApplyLiveResult, ApplyToRealPathResult } from "../tauri/types";
import OpMessage, { type OpMsg } from "../components/OpMessage";
import WriteResultPanel from "../components/WriteResultPanel";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";

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
  const [liveResult, setLiveResult] = useState<ApplyLiveResult | null>(null);

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
      <h1 style={PAGE_HEADING}>Waybar</h1>
      <p style={{ ...PAGE_NOTE, marginBottom: 24 }}>
        Controla posición, altura, módulos y opacidad de Waybar.
        Escribe <code>~/.config/waybar/config.jsonc</code> con backup automático.
        Apply live además envía <code>SIGUSR2</code> al proceso <code>waybar</code> (
        <code>pkill -USR2 waybar</code>) para recargar la barra sin reiniciar la sesión; requiere Waybar en
        ejecución y <code>pkill</code> en PATH.
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

        <button
          style={styles.saveBtnGreen}
          disabled={backendStatus !== "ready" || busy}
          onClick={async () => {
            if (
              !window.confirm(
                "Apply live (Waybar)\n\nEscribe ~/.config/waybar/config.jsonc con backup y ejecuta pkill -USR2 waybar para recargar la barra.\n\nSi Waybar no está corriendo, el archivo se escribe igual pero el reload fallará."
              )
            )
              return;
            startOp("Apply live");
            setLiveResult(null);
            try {
              const res = await applyLiveWaybar({ snapshot_label: "apply-live-waybar" });
              setLiveResult(res);
              setMessage({
                kind: res.reload_ok ? "success" : "warning",
                text: res.reload_ok
                  ? "Config escrita y señal de recarga enviada a Waybar."
                  : "Config escrita. Recarga Waybar falló (¿proceso inactivo o sin pkill?) — reinicia Waybar o la sesión para ver cambios.",
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

      {liveResult && (
        <WriteResultPanel
          label="apply live — resultado"
          targetPath={liveResult.write.target_path}
          backupFileName={liveResult.snapshot.backup_file_name}
          snapshotId={liveResult.snapshot.id}
          reloadOk={liveResult.reload_ok}
          reloadOutput={liveResult.reload_output}
          rollbackTarget="WaybarConfig"
          onRollbackSuccess={(s) => {
            onSettingsChange(s as AppSettings);
            setLiveResult(null);
          }}
          onMessage={setMessage}
        />
      )}

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
    <div style={{ fontSize: 13, color: ps.textMuted, marginBottom: 6 }}>
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
    <p style={{ fontSize: 11, color: ps.textDisabled, marginTop: 6 }}>
      Edición de módulos pendiente (add/reorder). Solo visualización.
    </p>
  </div>
);

const BTN_BASE: React.CSSProperties = {
  borderRadius: 999,
  padding: "9px 18px",
  cursor: "pointer",
  fontSize: 13,
  border: "1px solid",
  fontWeight: 500,
  flexShrink: 0,
  fontFamily: "inherit",
};

const styles: Record<string, React.CSSProperties> = {
  page: { ...PAGE_BASE },
  statusBanner: {
    fontSize: 12,
    color: ps.textMuted,
    ...psCard,
    padding: "10px 14px",
    marginBottom: 24,
  },
  statusBannerError: {
    color: ps.dangerText,
    background: ps.dangerBg,
    borderColor: ps.dangerBorder,
  },
  section: { marginBottom: 36 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 300,
    color: ps.textAccent,
    letterSpacing: "0.02em",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: `1px solid ${ps.borderDefault}`,
  },
  field: { display: "flex", alignItems: "center", gap: 16, marginBottom: 12 },
  label: { width: 100, fontSize: 13, color: ps.textMuted, flexShrink: 0 },
  select: {
    background: ps.surfaceInput,
    border: `1px solid ${ps.borderStrong}`,
    borderRadius: 3,
    color: ps.textPrimary,
    padding: "6px 10px",
    fontSize: 13,
  },
  range: { width: 160, accentColor: ps.blue },
  rangeValue: { fontSize: 13, color: ps.textPrimary, fontFamily: "monospace" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "rgba(0, 112, 204, 0.2)",
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    color: ps.textSecondary,
    fontFamily: "monospace",
  },
  chipRemove: {
    background: "none",
    border: "none",
    color: ps.textMuted,
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    padding: 0,
  },
  actionRow: { display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 8 },
  saveBtn: { ...BTN_BASE, background: ps.blue, borderColor: ps.blue, color: "#ffffff" },
  saveBtnNeutral: { ...BTN_BASE, background: ps.surfaceRaised, borderColor: ps.borderStrong, color: ps.textSecondary },
  saveBtnAmber: { ...BTN_BASE, background: ps.warningBg, borderColor: ps.warningBorder, color: ps.warningText },
  saveBtnGreen: { ...BTN_BASE, background: ps.successBg, borderColor: ps.successBorder, color: ps.successText },
  previewContainer: { marginTop: 28 },
  previewLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: ps.textMuted,
    marginBottom: 8,
    letterSpacing: "0.02em",
  },
  preview: {
    ...psCard,
    padding: 16,
    fontSize: 12,
    color: ps.textMono,
    overflow: "auto",
    fontFamily: "monospace",
    maxHeight: "min(55vh, 560px)",
  },
};

export default WaybarPage;
