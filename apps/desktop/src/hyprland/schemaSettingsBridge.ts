/**
 * Mapea claves del schema HyprMod (`general:gaps_in`, …) a campos de `HyprlandSettings`.
 */

import type { HyprlandSettings } from "../types/settings";

export type MappedKind = "int" | "float" | "bool" | "color" | "string";

export interface MappedSchemaKey {
  schemaKey: string;
  kind: MappedKind;
  label: string;
  /** Rango UI (opcional) */
  min?: number;
  max?: number;
  step?: number;
  get: (s: HyprlandSettings) => string | number | boolean;
  set: (s: HyprlandSettings, v: string | number | boolean) => HyprlandSettings;
  /** Valor para `hyprctl keyword` (p. ej. color rgba) */
  toKeywordValue: (v: string | number | boolean) => string;
}

function hexToRgbaKeyword(hex: string): string {
  const t = String(hex).trim().replace(/^#/, "");
  if (t.length === 6 && /^[0-9a-fA-F]+$/.test(t)) return `rgba(${t}ff)`;
  return String(hex).trim();
}

export const SCHEMA_TO_SETTINGS: MappedSchemaKey[] = [
  {
    schemaKey: "general:gaps_in",
    kind: "int",
    label: "Gaps inner",
    min: 0,
    max: 100,
    get: (s) => s.gaps_in,
    set: (s, v) => ({ ...s, gaps_in: clampInt(v, 0, 100) }),
    toKeywordValue: (v) => String(v),
  },
  {
    schemaKey: "general:gaps_out",
    kind: "int",
    label: "Gaps outer",
    min: 0,
    max: 100,
    get: (s) => s.gaps_out,
    set: (s, v) => ({ ...s, gaps_out: clampInt(v, 0, 100) }),
    toKeywordValue: (v) => String(v),
  },
  {
    schemaKey: "general:border_size",
    kind: "int",
    label: "Border size",
    min: 0,
    max: 24,
    get: (s) => s.border_size,
    set: (s, v) => ({ ...s, border_size: clampInt(v, 0, 24) }),
    toKeywordValue: (v) => String(v),
  },
  {
    schemaKey: "general:col.active_border",
    kind: "color",
    label: "Active border color",
    get: (s) => s.active_border_color,
    set: (s, v) => ({ ...s, active_border_color: String(v) }),
    toKeywordValue: (v) => hexToRgbaKeyword(String(v)),
  },
  {
    schemaKey: "general:col.inactive_border",
    kind: "color",
    label: "Inactive border color",
    get: (s) => s.inactive_border_color,
    set: (s, v) => ({ ...s, inactive_border_color: String(v) }),
    toKeywordValue: (v) => hexToRgbaKeyword(String(v)),
  },
  {
    schemaKey: "decoration:rounding",
    kind: "int",
    label: "Rounding",
    min: 0,
    max: 64,
    get: (s) => s.rounding,
    set: (s, v) => ({ ...s, rounding: clampInt(v, 0, 64) }),
    toKeywordValue: (v) => String(v),
  },
  {
    schemaKey: "decoration:blur:enabled",
    kind: "bool",
    label: "Blur enabled",
    get: (s) => s.blur_enabled,
    set: (s, v) => ({ ...s, blur_enabled: Boolean(v) }),
    toKeywordValue: (v) => (v ? "true" : "false"),
  },
  {
    schemaKey: "decoration:blur:size",
    kind: "int",
    label: "Blur size",
    min: 1,
    max: 32,
    get: (s) => s.blur_size,
    set: (s, v) => ({ ...s, blur_size: clampInt(v, 1, 32) }),
    toKeywordValue: (v) => String(v),
  },
  {
    schemaKey: "decoration:blur:passes",
    kind: "int",
    label: "Blur passes",
    min: 1,
    max: 16,
    get: (s) => s.blur_passes,
    set: (s, v) => ({ ...s, blur_passes: clampInt(v, 1, 16) }),
    toKeywordValue: (v) => String(v),
  },
  {
    schemaKey: "animations:enabled",
    kind: "bool",
    label: "Animations enabled",
    get: (s) => s.animations_enabled,
    set: (s, v) => ({ ...s, animations_enabled: Boolean(v) }),
    toKeywordValue: (v) => (v ? "true" : "false"),
  },
  {
    schemaKey: "input:kb_layout",
    kind: "string",
    label: "Keyboard layout",
    get: (s) => s.input.kb_layout,
    set: (s, v) => ({ ...s, input: { ...s.input, kb_layout: String(v) } }),
    toKeywordValue: (v) => String(v),
  },
  {
    schemaKey: "input:kb_variant",
    kind: "string",
    label: "Keyboard variant",
    get: (s) => s.input.kb_variant,
    set: (s, v) => ({ ...s, input: { ...s.input, kb_variant: String(v) } }),
    toKeywordValue: (v) => String(v),
  },
  {
    schemaKey: "input:kb_options",
    kind: "string",
    label: "Keyboard options",
    get: (s) => s.input.kb_options,
    set: (s, v) => ({ ...s, input: { ...s.input, kb_options: String(v) } }),
    toKeywordValue: (v) => String(v),
  },
  {
    schemaKey: "input:sensitivity",
    kind: "float",
    label: "Mouse sensitivity",
    min: -1,
    max: 1,
    step: 0.05,
    get: (s) => s.input.mouse_sensitivity,
    set: (s, v) => ({
      ...s,
      input: { ...s.input, mouse_sensitivity: clampFloat(v, -1, 1) },
    }),
    toKeywordValue: (v) => String(v),
  },
  {
    schemaKey: "input:natural_scroll",
    kind: "bool",
    label: "Natural scroll (mouse)",
    get: (s) => s.input.natural_scroll,
    set: (s, v) => ({ ...s, input: { ...s.input, natural_scroll: Boolean(v) } }),
    toKeywordValue: (v) => (v ? "true" : "false"),
  },
  {
    schemaKey: "input:touchpad:natural_scroll",
    kind: "bool",
    label: "Natural scroll (touchpad)",
    get: (s) => s.input.touchpad_natural_scroll,
    set: (s, v) => ({
      ...s,
      input: { ...s.input, touchpad_natural_scroll: Boolean(v) },
    }),
    toKeywordValue: (v) => (v ? "true" : "false"),
  },
];

const MAP_BY_KEY = new Map(SCHEMA_TO_SETTINGS.map((m) => [m.schemaKey, m]));

export function getBridgeForSchemaKey(key: string): MappedSchemaKey | undefined {
  return MAP_BY_KEY.get(key);
}

export function isMappedSchemaKey(key: string): boolean {
  return MAP_BY_KEY.has(key);
}

function clampInt(v: string | number | boolean, lo: number, hi: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function clampFloat(v: string | number | boolean, lo: number, hi: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return 0;
  return Math.min(hi, Math.max(lo, n));
}

export function applyBridgeToSettings(
  s: HyprlandSettings,
  key: string,
  value: string | number | boolean
): HyprlandSettings {
  const b = MAP_BY_KEY.get(key);
  if (!b) return s;
  return b.set(s, value);
}
