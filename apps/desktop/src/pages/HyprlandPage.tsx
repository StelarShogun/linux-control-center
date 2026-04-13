import { useEffect, useRef, useState, type FC } from "react";
import type { AppSettings, HyprlandInputSettings, HyprlandSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import {
  applyConfigToRealPath,
  applyConfigToSandbox,
  applyLiveHyprland,
  hyprctlReload,
  inspectHyprlandSetup,
  repairHyprlandMainInclude,
  previewHyprlandConfig,
  saveSettings,
  type HyprlandMigrationStatus,
  type HyprlandSetupState,
} from "../tauri/api";
import type { ApplyLiveResult, ApplyToRealPathResult } from "../tauri/types";
import OpMessage, { type OpMsg } from "../components/OpMessage";
import WriteResultPanel from "../components/WriteResultPanel";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";

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
  const [reloadOnlyBusy, setReloadOnlyBusy] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<HyprlandMigrationStatus | null>(null);
  const [repairingInclude, setRepairingInclude] = useState(false);
  const [inputSectionOpen, setInputSectionOpen] = useState(false);
  const undoHyprland = useRef<string[]>([]);
  const [savedHyprlandJson, setSavedHyprlandJson] = useState(() =>
    JSON.stringify(settings.hyprland)
  );
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const pushUndoHyprland = () => {
    const cur = settingsRef.current.hyprland;
    undoHyprland.current = [...undoHyprland.current.slice(-29), JSON.stringify(cur)];
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      e.preventDefault();
      const prev = undoHyprland.current.pop();
      if (!prev) return;
      try {
        const hyprland = JSON.parse(prev) as HyprlandSettings;
        onSettingsChange({ ...settingsRef.current, hyprland });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSettingsChange]);

  const dirtyHyprland = JSON.stringify(settings.hyprland) !== savedHyprlandJson;

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

  useEffect(() => {
    if (backendStatus !== "ready") return;
    inspectHyprlandSetup()
      .then(setMigrationStatus)
      .catch(() => setMigrationStatus(null));
  }, [backendStatus]);

  const local = settings.hyprland;
  const update = <K extends keyof HyprlandSettings>(
    key: K,
    value: HyprlandSettings[K]
  ) => {
    pushUndoHyprland();
    onSettingsChange({
      ...settings,
      hyprland: { ...settings.hyprland, [key]: value },
    });
  };

  const updateInput = <K extends keyof HyprlandInputSettings>(
    key: K,
    value: HyprlandInputSettings[K]
  ) => {
    pushUndoHyprland();
    onSettingsChange({
      ...settings,
      hyprland: {
        ...settings.hyprland,
        input: { ...settings.hyprland.input, [key]: value },
      },
    });
  };

  return (
    <div style={styles.page} data-no-global-undo>
      <h1 style={PAGE_HEADING}>Hyprland</h1>
      <p style={{ ...PAGE_NOTE, marginBottom: 24 }}>
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

      {dirtyHyprland && (
        <div
          style={{
            ...styles.statusBanner,
            borderColor: ps.warningBorder,
            background: ps.warningBg,
            color: ps.warningText,
            marginBottom: 16,
          }}
        >
          Cambios sin guardar en la app (Hyprland). Pulsa <strong>Save</strong> o usa{" "}
          <kbd>Ctrl+Z</kbd> para deshacer en esta página.
        </div>
      )}

      {migrationStatus && <MigrationBanner
        status={migrationStatus}
        onRepair={async () => {
          setRepairingInclude(true);
          try {
            const inserted = await repairHyprlandMainInclude();
            const refreshed = await inspectHyprlandSetup();
            setMigrationStatus(refreshed);
            setMessage({
              kind: "success",
              text: inserted
                ? "Include gestionado insertado en hyprland.conf."
                : "El include ya estaba presente.",
            });
          } catch (e) {
            setMessage({ kind: "error", text: `Error al reparar include: ${String(e)}` });
          } finally {
            setRepairingInclude(false);
          }
        }}
        repairing={repairingInclude}
      />}

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

      <section style={styles.section}>
        <button
          type="button"
          onClick={() => setInputSectionOpen((o) => !o)}
          style={styles.collapser}
        >
          <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Input (teclado y puntero)</h2>
          <span style={styles.chev}>{inputSectionOpen ? "▼" : "▶"}</span>
        </button>
        {inputSectionOpen && (
          <div style={styles.inputBlock}>
            <div style={styles.field}>
              <label style={styles.label}>Keyboard layout</label>
              <input
                type="text"
                style={styles.textIn}
                value={local.input.kb_layout}
                onChange={(e) => updateInput("kb_layout", e.target.value)}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Keyboard variant</label>
              <input
                type="text"
                style={styles.textIn}
                value={local.input.kb_variant}
                onChange={(e) => updateInput("kb_variant", e.target.value)}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Keyboard options</label>
              <input
                type="text"
                style={styles.textIn}
                value={local.input.kb_options}
                onChange={(e) => updateInput("kb_options", e.target.value)}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>
                Sensibilidad del ratón ({local.input.mouse_sensitivity.toFixed(2)})
              </label>
              <div style={styles.control}>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={local.input.mouse_sensitivity}
                  onChange={(e) =>
                    updateInput("mouse_sensitivity", parseFloat(e.target.value) || 0)
                  }
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <BoolField
              label="Natural scroll (ratón)"
              value={local.input.natural_scroll}
              onChange={(v) => updateInput("natural_scroll", v)}
            />
            <BoolField
              label="Natural scroll (touchpad)"
              value={local.input.touchpad_natural_scroll}
              onChange={(v) => updateInput("touchpad_natural_scroll", v)}
            />
          </div>
        )}
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
              setSavedHyprlandJson(JSON.stringify(saved.hyprland));
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
          disabled={backendStatus !== "ready" || busy || isApplyLiveBlocked(migrationStatus?.state)}
          title={isApplyLiveBlocked(migrationStatus?.state)
            ? applyLiveBlockReason(migrationStatus?.state)
            : undefined}
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

        <button
          type="button"
          style={styles.saveBtnNeutral}
          disabled={backendStatus !== "ready" || busy || reloadOnlyBusy}
          title="Ejecuta solo hyprctl reload. No escribe archivos; útil si ya editaste la config a mano."
          onClick={async () => {
            setReloadOnlyBusy(true);
            try {
              const r = await hyprctlReload();
              setMessage({
                kind: r.ok ? "success" : "warning",
                text: r.ok
                  ? "hyprctl reload completado."
                  : `hyprctl reload falló: ${r.output || "(sin salida)"}`,
              });
            } catch (e) {
              setMessage({ kind: "error", text: String(e) });
            } finally {
              setReloadOnlyBusy(false);
            }
          }}
        >
          {reloadOnlyBusy ? "Reload…" : "hyprctl reload"}
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

// ─── Helpers para el bloqueo de Apply live ────────────────────────────────────

function isApplyLiveBlocked(state: HyprlandSetupState | undefined): boolean {
  if (!state) return false;
  return state.type === "MainFileNotFound" || state.type === "LegacyGeneratedDetected";
}

function applyLiveBlockReason(state: HyprlandSetupState | undefined): string {
  if (!state) return "";
  if (state.type === "MainFileNotFound")
    return "hyprland.conf no encontrado. Crea el archivo antes de aplicar en vivo.";
  if (state.type === "LegacyGeneratedDetected")
    return "Instalación antigua detectada. Usa un backup para restaurar hyprland.conf antes de continuar.";
  return "";
}

// ─── MigrationBanner ──────────────────────────────────────────────────────────

interface MigrationBannerProps {
  status: HyprlandMigrationStatus;
  onRepair: () => void;
  repairing: boolean;
}

const MigrationBanner: FC<MigrationBannerProps> = ({ status, onRepair, repairing }) => {
  const { state, available_backups, warnings } = status;

  if (state.type === "ManagedIncludePresent") return null;

  let bannerStyle = { ...styles.migrationBanner };
  let title = "";
  let body: React.ReactNode = null;

  if (state.type === "ManagedIncludeAbsent") {
    bannerStyle = { ...bannerStyle, ...styles.migrationBannerAmber };
    title = "Include gestionado ausente";
    body = (
      <>
        <span style={styles.migrationBannerText}>
          El include de LCC no está en <code>hyprland.conf</code>.
          Apply live funcionará pero no se aplicarán los cambios hasta repararlo.
        </span>
        <button
          style={styles.migrationBannerBtn}
          onClick={onRepair}
          disabled={repairing}
        >
          {repairing ? "Reparando…" : "Reparar include"}
        </button>
      </>
    );
  } else if (state.type === "LegacyGeneratedDetected") {
    bannerStyle = { ...bannerStyle, ...styles.migrationBannerRed };
    title = "Instalación antigua detectada";
    body = (
      <>
        <span style={styles.migrationBannerText}>
          <code>hyprland.conf</code> fue generado completamente por una versión antigua de LCC.
          Apply live está bloqueado hasta que restaures manualmente desde un backup.
        </span>
        {available_backups.length > 0 && (
          <div style={styles.migrationBackupList}>
            <span style={{ fontSize: 11, color: ps.textMuted }}>Backups disponibles:</span>
            {available_backups.slice(0, 5).map((bak) => (
              <code key={bak} style={styles.migrationBackupItem}>{bak}</code>
            ))}
          </div>
        )}
      </>
    );
  } else if (state.type === "NonStandardSetup") {
    bannerStyle = { ...bannerStyle, ...styles.migrationBannerAmber };
    title = "Setup no estándar detectado";
    body = (
      <span style={styles.migrationBannerText}>
        {state.reason}. Apply live puede funcionar con limitaciones.
      </span>
    );
  } else if (state.type === "MainFileNotFound") {
    bannerStyle = { ...bannerStyle };
    title = "hyprland.conf no encontrado";
    body = (
      <span style={styles.migrationBannerText}>
        No se encontró <code>~/.config/hypr/hyprland.conf</code>.
        Apply live está bloqueado hasta que el archivo exista.
      </span>
    );
  }

  return (
    <div style={bannerStyle}>
      <strong style={styles.migrationBannerTitle}>{title}</strong>
      {body}
      {warnings.map((w, i) => (
        <div key={i} style={{ fontSize: 11, color: ps.textMuted, marginTop: 4 }}>{w}</div>
      ))}
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
  collapser: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    marginBottom: 12,
    fontFamily: "inherit",
  },
  chev: { fontSize: 12, color: ps.textMuted, marginLeft: 8 },
  inputBlock: { paddingTop: 8, borderTop: `1px solid ${ps.borderDefault}` },
  textIn: {
    flex: 1,
    padding: "6px 10px",
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceInput,
    color: ps.textPrimary,
    fontSize: 13,
    fontFamily: "inherit",
    maxWidth: 320,
  },
  field: { display: "flex", alignItems: "center", gap: 16, marginBottom: 12 },
  label: { width: 140, fontSize: 13, color: ps.textMuted, flexShrink: 0 },
  control: { display: "flex", alignItems: "center", gap: 8 },
  range: { width: 160, accentColor: ps.blue },
  rangeValue: { fontSize: 13, color: ps.textPrimary, width: 48, fontFamily: "monospace" },
  colorInput: { width: 36, height: 28, border: "none", cursor: "pointer" },
  colorValue: { fontSize: 13, color: ps.textMuted, fontFamily: "monospace" },
  boolLabel: { fontSize: 13, color: ps.textMuted },
  actionRow: { display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 8 },
  saveBtn: { ...BTN_BASE, background: ps.blue, borderColor: ps.blue, color: "#ffffff" },
  saveBtnNeutral: { ...BTN_BASE, background: ps.surfaceRaised, borderColor: ps.borderStrong, color: ps.textSecondary },
  saveBtnAmber: { ...BTN_BASE, background: ps.warningBg, borderColor: ps.warningBorder, color: ps.warningText },
  saveBtnGreen: { ...BTN_BASE, background: ps.successBg, borderColor: ps.successBorder, color: ps.successText },
  migrationBanner: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    fontSize: 12,
    ...psCard,
    padding: "12px 16px",
    marginBottom: 20,
  },
  migrationBannerAmber: {
    background: ps.warningBg,
    borderColor: ps.warningBorder,
    color: ps.warningText,
  },
  migrationBannerRed: {
    background: ps.dangerBg,
    borderColor: ps.dangerBorder,
    color: ps.dangerText,
  },
  migrationBannerTitle: {
    fontSize: 12,
    fontWeight: 600,
  },
  migrationBannerText: {
    fontSize: 12,
    lineHeight: 1.5,
    color: ps.textSecondary,
  },
  migrationBannerBtn: {
    alignSelf: "flex-start" as const,
    background: ps.warningBg,
    border: `1px solid ${ps.warningBorder}`,
    borderRadius: 999,
    color: ps.warningText,
    fontSize: 12,
    padding: "6px 12px",
    cursor: "pointer",
  },
  migrationBackupList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    marginTop: 4,
  },
  migrationBackupItem: {
    fontSize: 11,
    color: ps.textMuted,
    background: ps.surfaceCode,
    borderRadius: 3,
    padding: "1px 4px",
    fontFamily: "monospace",
  },
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

export default HyprlandPage;
