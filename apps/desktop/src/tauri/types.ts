import type { AppSettings } from "../types/settings";
import type { SnapshotInfo } from "../types/generated/SnapshotInfo";
import type { SandboxTarget } from "../types/generated/SandboxTarget";
import type { ThemeVariant } from "../types/generated/ThemeVariant";
import type { WriteResult } from "../types/generated/WriteResult";
import type { WallpaperFilter } from "../types/generated/WallpaperFilter";
import type { WriteTarget } from "../types/generated/WriteTarget";

/** Resultado de `audit_config_backups` (solo lectura). */
export interface BackupAuditRow {
  target: WriteTarget | null;
  backup_file_name: string;
  exists_on_disk: boolean;
  size_bytes: number | null;
  tracked_in_registry: boolean;
  referenced_in_journal_or_snapshot: boolean;
  orphan_suspect: boolean;
  referenced_but_missing: boolean;
}

export interface BackupAuditReport {
  rows: BackupAuditRow[];
  disk_file_count: number;
  referenced_name_count: number;
  tracked_union_count: number;
  orphan_count: number;
  referenced_missing_count: number;
}

export interface DeleteOrphanBackupArgs {
  target: WriteTarget;
  backup_file_name: string;
  dry_run: boolean;
}

export interface DeleteOrphanBackupResult {
  dry_run: boolean;
  deleted: boolean;
  path: string;
}

export type { SnapshotInfo } from "../types/generated";
export type { SandboxTarget } from "../types/generated/SandboxTarget";
export type { WriteResult } from "../types/generated/WriteResult";
export type { WriteTarget } from "../types/generated/WriteTarget";

export interface SaveProfileArgs {
  name: string;
  description?: string | null;
  settings: AppSettings;
}

export interface SaveSettingsArgs {
  settings: AppSettings;
}

export interface CreateSnapshotArgs {
  label?: string | null;
}

export interface RestoreSnapshotArgs {
  snapshot_id: string;
}

export interface ApplyConfigToSandboxArgs {
  target: SandboxTarget;
  snapshot_label?: string | null;
}

export interface ApplyToSandboxResult {
  snapshot: SnapshotInfo;
  write: WriteResult;
}

export interface ApplyConfigToRealPathArgs {
  target: WriteTarget;
  snapshot_label?: string | null;
}

export interface ApplyToRealPathResult {
  snapshot: SnapshotInfo;
  write: WriteResult;
  /** Basename del backup (pasarlo directamente a rollbackConfigFile). Null si no había archivo previo. */
  backup_file_name: string | null;
}

export interface RollbackConfigFileArgs {
  /** Solo el basename del backup — nunca una ruta completa. */
  backup_file_name: string;
  target: WriteTarget;
}

export interface RollbackFullStateArgs {
  /** Solo el basename del backup — nunca una ruta completa. */
  backup_file_name: string;
  target: WriteTarget;
}

export interface RollbackFullStateResult {
  snapshot_id: string;
  restored_settings: AppSettings;
}

export interface ApplyLiveHyprlandArgs {
  snapshot_label?: string | null;
}

export interface ApplyLiveWaybarArgs {
  snapshot_label?: string | null;
}

export interface ApplyLiveResult {
  snapshot: SnapshotInfo;
  write: WriteResult;
  /** Hyprland: hyprctl reload. Waybar: pkill -USR2 waybar (exit 0 = señal enviada). */
  reload_ok: boolean;
  /** Salida del comando de reload o mensaje si el binario no está disponible. */
  reload_output: string;
}

export interface GetThemePreviewArgs {
  preset_id: string;
  variant: ThemeVariant;
}

export interface ThemePreviewDto {
  hyprland: string;
  waybar_jsonc: string;
  waybar_css: string;
  rofi: string;
}

export interface ApplyThemeArgs {
  preset_id: string;
  variant: ThemeVariant;
  apply_hyprland?: boolean;
  apply_waybar_config?: boolean;
  apply_waybar_style?: boolean;
  apply_rofi?: boolean;
  reload_hyprland?: boolean;
}

export interface ThemeApplyTargetResult {
  ok: boolean;
  error: string | null;
  snapshot_id: string | null;
  backup_file_name: string | null;
  written_path: string | null;
}

export interface ThemeApplyResult {
  pre_snapshot_id: string;
  preset_id: string;
  variant: string;
  hyprland: ThemeApplyTargetResult | null;
  waybar_config: ThemeApplyTargetResult | null;
  waybar_style: ThemeApplyTargetResult | null;
  rofi: ThemeApplyTargetResult | null;
  reload_ok: boolean | null;
}

export interface ListWallpapersArgs {
  filter?: WallpaperFilter;
  limit?: number | null;
}

export interface GetWallpaperPreviewArgs {
  id: string;
}

export interface ApplyWallpaperArgs {
  id: string;
}

