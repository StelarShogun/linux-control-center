import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types/settings";
import type {
  ApplyConfigToRealPathArgs,
  ApplyConfigToSandboxArgs,
  ApplyLiveHyprlandArgs,
  ApplyLiveResult,
  ApplyToRealPathResult,
  ApplyToSandboxResult,
  CreateSnapshotArgs,
  RestoreSnapshotArgs,
  RollbackConfigFileArgs,
  RollbackFullStateArgs,
  RollbackFullStateResult,
  SaveProfileArgs,
  SaveSettingsArgs,
  SnapshotInfo,
} from "./types";

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

