/**
 * Parseo de `hyprctl binds -j` y comparación de combos (estilo HyprMod).
 */

import type { HyprlandBind } from "../types/settings";

const MOD_SHIFT = 1;
const MOD_CAPS = 2;
const MOD_CTRL = 4;
const MOD_ALT = 8;
const MOD_SUPER = 64;
const MOD_MOD5 = 128;

export interface HyprctlBindEntry {
  locked: boolean;
  mouse: boolean;
  release: boolean;
  repeat: boolean;
  modmask: number;
  key: string;
  dispatcher: string;
  arg: string;
  description?: string;
}

export function parseHyprctlBindsJson(raw: string): HyprctlBindEntry[] {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data as HyprctlBindEntry[];
  } catch {
    return [];
  }
}

/** Convierte modmask de Hyprland a nombres de modificadores (orden estable). */
export function modmaskToModifiers(mask: number): string[] {
  const found: string[] = [];
  if (mask & MOD_SUPER) found.push("SUPER");
  if (mask & MOD_CTRL) found.push("CTRL");
  if (mask & MOD_ALT) found.push("ALT");
  if (mask & MOD_SHIFT) found.push("SHIFT");
  if (mask & MOD_CAPS) found.push("CAPS");
  if (mask & MOD_MOD5) found.push("MOD5");
  return found;
}

function normalizeModsList(mods: string[]): string {
  return [...mods.map((m) => m.trim().toUpperCase())].filter(Boolean).sort().join(" ");
}

export function bindComboKey(b: HyprlandBind): string {
  const mods = b.modifiers.length ? b.modifiers : ["SUPER"];
  return `${normalizeModsList(mods)}||${b.key.trim()}`;
}

export function runtimeEntryComboKey(e: HyprctlBindEntry): string {
  return `${normalizeModsList(modmaskToModifiers(e.modmask))}||${e.key.trim()}`;
}

export function findRuntimeOverride(
  owned: HyprlandBind,
  runtime: HyprctlBindEntry[]
): HyprctlBindEntry | undefined {
  const key = bindComboKey(owned);
  return runtime.find((e) => runtimeEntryComboKey(e) === key);
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Misma acción (dispatcher + argumento) en guardado y en runtime. */
export function runtimeActionMatchesSaved(owned: HyprlandBind, rt: HyprctlBindEntry): boolean {
  const a = norm(owned.dispatcher);
  const b = norm(rt.dispatcher);
  if (a !== b) return false;
  return owned.args.trim() === String(rt.arg ?? "").trim();
}

/**
 * Estado respecto a `hyprctl binds -j`: sin binding para ese combo, en sync, o el compositor
 * tiene otra acción (override de runtime frente a lo guardado en la app).
 */
export type BindRuntimeStatus = "no_runtime" | "sync" | "override";

export function bindRuntimeStatus(owned: HyprlandBind, runtime: HyprctlBindEntry[]): BindRuntimeStatus {
  const rt = findRuntimeOverride(owned, runtime);
  if (!rt) return "no_runtime";
  if (runtimeActionMatchesSaved(owned, rt)) return "sync";
  return "override";
}
