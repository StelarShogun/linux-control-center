import { invoke } from "@tauri-apps/api/core";
import type { OperationJournalEntry } from "../types/generated/OperationJournalEntry";
import type { ThemePresetSummary } from "../types/generated/ThemePresetSummary";
import type { AppSettings } from "../types/settings";
import type { CurrentWallpaperState } from "../types/generated/CurrentWallpaperState";
import type { WallpaperApplyResult } from "../types/generated/WallpaperApplyResult";
import type { WallpaperBackendStatus } from "../types/generated/WallpaperBackendStatus";
import type { WallpaperCollection } from "../types/generated/WallpaperCollection";
import type { WallpaperPreview } from "../types/generated/WallpaperPreview";
import type {
  ApplyConfigToRealPathArgs,
  ApplyConfigToSandboxArgs,
  ApplyLiveHyprlandArgs,
  ApplyLiveResult,
  ApplyLiveWaybarArgs,
  ApplyThemeArgs,
  ApplyToRealPathResult,
  ApplyToSandboxResult,
  ApplyWallpaperArgs,
  BackupAuditReport,
  CreateSnapshotArgs,
  DeleteOrphanBackupArgs,
  DeleteOrphanBackupResult,
  GetThemePreviewArgs,
  GetWallpaperPreviewArgs,
  ListWallpapersArgs,
  RestoreSnapshotArgs,
  RollbackConfigFileArgs,
  RollbackFullStateArgs,
  RollbackFullStateResult,
  SaveProfileArgs,
  SaveSettingsArgs,
  SnapshotInfo,
  ThemeApplyResult,
  ThemePreviewDto,
} from "./types";
import type { NetworkInterface } from "../types/generated";
import type { PowerProfileKind, PowerStatus } from "../types/generated";

// ─── Hyprland migration types ────────────────────────────────────────────────

export type HyprlandSetupState =
  | { type: "ManagedIncludePresent" }
  | { type: "ManagedIncludeAbsent" }
  | { type: "LegacyGeneratedDetected" }
  | { type: "NonStandardSetup"; reason: string }
  | { type: "MainFileNotFound" };

export interface HyprlandMigrationStatus {
  state: HyprlandSetupState;
  main_config_exists: boolean;
  available_backups: string[];
  can_auto_repair: boolean;
  warnings: string[];
}

export async function getCurrentSettings(): Promise<AppSettings> {
  return await invoke<AppSettings>("get_current_settings");
}

/**
 * Lee los archivos de configuración reales del sistema
 * (~/.config/hypr, ~/.config/waybar, ~/.config/rofi) y devuelve un AppSettings
 * construido a partir de ellos. No persiste ni modifica el estado; el llamador
 * debe invocar saveSettings si quiere persistir el resultado.
 */
export async function importSystemSettings(): Promise<AppSettings> {
  return await invoke<AppSettings>("import_system_settings");
}

/** Operation Journal: últimas operaciones sensibles (apply / rollback), más recientes primero. */
export async function listRecentOperations(limit?: number): Promise<OperationJournalEntry[]> {
  return await invoke<OperationJournalEntry[]>("list_recent_operations", { limit });
}

/** Cruza backups en ~/.config (allowlist) con journal, snapshots y registro persistente. No modifica disco. */
export async function auditConfigBackups(): Promise<BackupAuditReport> {
  return await invoke<BackupAuditReport>("audit_config_backups");
}

/** Borra un backup huérfano validado (solo basename + WriteTarget); `dry_run` no borra. */
export async function deleteOrphanBackup(
  args: DeleteOrphanBackupArgs,
): Promise<DeleteOrphanBackupResult> {
  return await invoke<DeleteOrphanBackupResult>("delete_orphan_backup", { args });
}

export async function listThemePresets(): Promise<ThemePresetSummary[]> {
  return await invoke<ThemePresetSummary[]>("list_theme_presets");
}

export async function getThemePreview(args: GetThemePreviewArgs): Promise<ThemePreviewDto> {
  return await invoke<ThemePreviewDto>("get_theme_preview", { args });
}

export async function applyTheme(args: ApplyThemeArgs): Promise<ThemeApplyResult> {
  return await invoke<ThemeApplyResult>("apply_theme", { args });
}

export async function listWallpapers(args?: ListWallpapersArgs): Promise<WallpaperCollection> {
  return await invoke<WallpaperCollection>("list_wallpapers", { args: args ?? {} });
}

export async function refreshWallpaperCatalog(): Promise<WallpaperCollection> {
  return await invoke<WallpaperCollection>("refresh_wallpaper_catalog", {});
}

export async function getWallpaperPreview(args: GetWallpaperPreviewArgs): Promise<WallpaperPreview> {
  return await invoke<WallpaperPreview>("get_wallpaper_preview", { args });
}

export async function getWallpaperBackendStatus(): Promise<WallpaperBackendStatus> {
  return await invoke<WallpaperBackendStatus>("get_wallpaper_backend_status", {});
}

export async function getCurrentWallpaper(): Promise<CurrentWallpaperState> {
  return await invoke<CurrentWallpaperState>("get_current_wallpaper", {});
}

export async function applyWallpaper(args: ApplyWallpaperArgs): Promise<WallpaperApplyResult> {
  return await invoke<WallpaperApplyResult>("apply_wallpaper", { args });
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  return await invoke<SnapshotInfo[]>("list_snapshots");
}

export async function saveProfile(args: SaveProfileArgs): Promise<string> {
  return await invoke<string>("save_profile", { args });
}

export async function saveSettings(args: SaveSettingsArgs): Promise<AppSettings> {
  return await invoke<AppSettings>("save_settings", { args });
}

export async function createSnapshot(args: CreateSnapshotArgs): Promise<SnapshotInfo> {
  return await invoke<SnapshotInfo>("create_snapshot", { args });
}

export async function restoreSnapshot(args: RestoreSnapshotArgs): Promise<AppSettings> {
  return await invoke<AppSettings>("restore_snapshot", { args });
}

/** Returns the Hyprland config text that would be generated from current settings. Read-only. */
export async function previewHyprlandConfig(): Promise<string> {
  return await invoke<string>("preview_hyprland_config");
}

/** Returns the Waybar config JSON that would be generated from current settings. Read-only. */
export async function previewWaybarConfig(): Promise<string> {
  return await invoke<string>("preview_waybar_config");
}

/** Returns the Rofi config .rasi that would be generated from current settings. Read-only. */
export async function previewRofiConfig(): Promise<string> {
  return await invoke<string>("preview_rofi_config");
}

export async function applyConfigToSandbox(
  args: ApplyConfigToSandboxArgs
): Promise<ApplyToSandboxResult> {
  return await invoke<ApplyToSandboxResult>("apply_config_to_sandbox", { args });
}

/** Applies current settings to the real user config path (~/.config/…). Creates a backup first. */
export async function applyConfigToRealPath(
  args: ApplyConfigToRealPathArgs
): Promise<ApplyToRealPathResult> {
  return await invoke<ApplyToRealPathResult>("apply_config_to_real_path", { args });
}

/** Restores a config file from a previously created backup. */
export async function rollbackConfigFile(args: RollbackConfigFileArgs): Promise<void> {
  return await invoke<void>("rollback_config_file", { args });
}

/**
 * Atomic full rollback: restores the config file from backup AND restores the
 * associated settings snapshot in a single command.
 */
export async function rollbackFullState(
  args: RollbackFullStateArgs
): Promise<RollbackFullStateResult> {
  return await invoke<RollbackFullStateResult>("rollback_full_state", { args });
}

/**
 * Writes ~/.config/hypr/hyprland.conf from current settings and executes
 * `hyprctl reload` to apply changes live. Returns reload_ok so the UI can
 * show the exact outcome. If reload fails, the file is still written correctly.
 */
export async function applyLiveHyprland(
  args: ApplyLiveHyprlandArgs
): Promise<ApplyLiveResult> {
  return await invoke<ApplyLiveResult>("apply_live_hyprland", { args });
}

/**
 * Escribe ~/.config/waybar/config.jsonc y envía SIGUSR2 a Waybar (`pkill -USR2 waybar`).
 * Si el reload falla (Waybar no corre, sin pkill), el archivo en disco sigue actualizado.
 */
export async function applyLiveWaybar(
  args: ApplyLiveWaybarArgs
): Promise<ApplyLiveResult> {
  return await invoke<ApplyLiveResult>("apply_live_waybar", { args });
}

// ─── Hyprland migration commands ─────────────────────────────────────────────

/**
 * Inspects the managed-include state of the user's hyprland.conf.
 * Read-only — does not modify any file.
 */
export async function inspectHyprlandSetup(): Promise<HyprlandMigrationStatus> {
  return await invoke<HyprlandMigrationStatus>("inspect_hyprland_setup_cmd");
}

/**
 * Inserts the managed include into hyprland.conf if it is absent (idempotent).
 * Returns `true` if the include was inserted, `false` if it was already present.
 * Should only be called when state is `ManagedIncludeAbsent`.
 */
export async function repairHyprlandMainInclude(): Promise<boolean> {
  return await invoke<boolean>("repair_hyprland_main_include");
}

/**
 * Lists the basenames of available backups for hyprland.conf
 * (e.g. `hyprland.conf.bak.20260409T…-uuid`), sorted newest first.
 */
export async function listHyprlandMainBackups(): Promise<string[]> {
  return await invoke<string[]>("list_hyprland_main_backups_cmd");
}

export interface UnitStatusDto {
  name: string;
  description: string;
  kind: string;
  load_state: string;
  active_state: string;
  sub_state: string;
  unit_file_state: string;
  fragment_path: string | null;
}

export interface ListUnitsResponse {
  units: UnitStatusDto[];
  source: "dbus" | "fixture";
}

/** Lists systemd units with optional filtering. Falls back to fixture when D-Bus is unavailable. */
export async function listSystemdUnits(
  kinds: string[] = [],
  activeOnly: boolean = false,
  maxResults: number = 200
): Promise<ListUnitsResponse> {
  return await invoke<ListUnitsResponse>("list_systemd_units", {
    kinds,
    activeOnly,
    maxResults,
  });
}

/** Queries the status of a specific systemd unit. Requires D-Bus; returns error if unavailable. */
export async function getSystemdUnit(name: string): Promise<UnitStatusDto> {
  return await invoke<UnitStatusDto>("get_systemd_unit", { name });
}

/** Interfaces de red (solo lectura). */
export async function listNetworkInterfaces(): Promise<NetworkInterface[]> {
  return await invoke<NetworkInterface[]>("list_network_interfaces");
}

/** Estado de energía y perfil activo. */
export async function getPowerStatus(): Promise<PowerStatus> {
  return await invoke<PowerStatus>("get_power_status");
}

/** Cambia perfil vía powerprofilesctl. */
export async function setPowerProfile(profile: PowerProfileKind): Promise<void> {
  return await invoke<void>("set_power_profile", { args: { profile } });
}

