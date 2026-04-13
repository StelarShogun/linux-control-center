const LS_AUTO_SAVE = "lcc.prefs.autoSave";
const LS_HYPR_BANNER_DISMISSED = "lcc.prefs.hyprBannerDismissed";
const LS_HYPR_ONBOARDING_DONE = "lcc.prefs.hyprOnboardingDone";

function readBool(key: string, defaultValue: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return defaultValue;
    return v === "1" || v === "true";
  } catch {
    return defaultValue;
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function getAutoSavePreference(): boolean {
  return readBool(LS_AUTO_SAVE, false);
}

export function setAutoSavePreference(value: boolean): void {
  writeBool(LS_AUTO_SAVE, value);
}

export function getHyprlandBannerDismissed(): boolean {
  return readBool(LS_HYPR_BANNER_DISMISSED, false);
}

export function setHyprlandBannerDismissed(value: boolean): void {
  writeBool(LS_HYPR_BANNER_DISMISSED, value);
}

export function getHyprlandOnboardingDone(): boolean {
  return readBool(LS_HYPR_ONBOARDING_DONE, false);
}

export function setHyprlandOnboardingDone(value: boolean): void {
  writeBool(LS_HYPR_ONBOARDING_DONE, value);
}
