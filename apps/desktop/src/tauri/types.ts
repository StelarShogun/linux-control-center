import type { AppSettings } from "../types/settings";
import type { SnapshotInfo } from "../types/generated/SnapshotInfo";
import type { SandboxTarget } from "../types/generated/SandboxTarget";
import type { WriteResult } from "../types/generated/WriteResult";
import type { WriteTarget } from "../types/generated/WriteTarget";

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

export interface ApplyLiveResult {
  snapshot: SnapshotInfo;
  write: WriteResult;
  /** true si hyprctl reload devolvió exit code 0 */
  reload_ok: boolean;
  /** stdout+stderr de hyprctl, o mensaje de error si no estaba disponible */
  reload_output: string;
}

