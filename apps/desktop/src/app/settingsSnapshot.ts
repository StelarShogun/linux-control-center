import type { AppSettings } from "../types/settings";

/** Copia profunda para baseline / discard. */
export function cloneAppSettings(s: AppSettings): AppSettings {
  return JSON.parse(JSON.stringify(s)) as AppSettings;
}

/** Huella estable para comparar dirty (suficiente para snapshots Tauri). */
export function stableSettingsFingerprint(s: AppSettings): string {
  return JSON.stringify(s);
}
