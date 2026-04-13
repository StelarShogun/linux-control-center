import type { Page } from "../components/Sidebar";
import type { AppSettings } from "../types/settings";
import { stableSettingsFingerprint } from "./settingsSnapshot";

function diffPaths(a: unknown, b: unknown, prefix: string, out: Set<string>): void {
  if (a === b) return;
  if (typeof a !== typeof b) {
    if (prefix) out.add(prefix);
    return;
  }
  if (a === null || b === null || typeof a !== "object") {
    if (a !== b && prefix) out.add(prefix);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (JSON.stringify(a) !== JSON.stringify(b) && prefix) out.add(prefix);
    return;
  }
  const ak = a as Record<string, unknown>;
  const bk = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ak), ...Object.keys(bk)]);
  for (const k of keys) {
    const p = prefix ? `${prefix}.${k}` : k;
    diffPaths(ak[k], bk[k], p, out);
  }
}

/** Heurística: prefijos de paths cambiados → página LCC. */
function pathToPage(path: string): Page | null {
  if (path.startsWith("appearance")) return "appearance";
  if (path.startsWith("hyprland")) {
    if (path.startsWith("hyprland.schema_overrides")) return "hyprland_schema";
    if (path.includes("keyboard")) return "keybindings";
    if (path.includes("windows")) return "window-rules";
    if (path.includes("bezier")) return "animations";
    return "hyprland";
  }
  if (path.startsWith("waybar")) return "waybar";
  if (path.startsWith("rofi")) return "rofi";
  if (path.startsWith("wallpaper")) return "wallpapers";
  return null;
}

/** Conteo aproximado de campos distintos por página (para badges). */
export function computeDirtyPageCounts(
  current: AppSettings,
  baseline: AppSettings
): Partial<Record<Page, number>> {
  if (stableSettingsFingerprint(current) === stableSettingsFingerprint(baseline)) return {};
  const paths = new Set<string>();
  diffPaths(current, baseline, "", paths);
  const counts: Partial<Record<Page, number>> = {};
  for (const p of paths) {
    const page = pathToPage(p);
    if (!page) continue;
    counts[page] = (counts[page] ?? 0) + 1;
  }
  return counts;
}
