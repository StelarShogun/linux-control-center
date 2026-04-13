/**
 * IPC genérico para opciones del schema no enlazadas a HyprlandSettings (estilo HyprMod).
 */

import type { FlatSchemaOption } from "./schemaLoader";
import { SCHEMA_TO_SETTINGS } from "./schemaSettingsBridge";

export function mappedIntegrationSchemaKeys(): Set<string> {
  return new Set(SCHEMA_TO_SETTINGS.map((m) => m.schemaKey));
}

function hexToRgbaKeyword(hex: string): string {
  const t = String(hex).trim().replace(/^#/, "");
  if (t.length === 6 && /^[0-9a-fA-F]+$/.test(t)) return `rgba(${t}ff)`;
  return String(hex).trim();
}

/** Valor en la línea `int:` / `float:` / … de `hyprctl getoption`. */
export function parseHyprctlGetOption(stdout: string): string | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(int|float|vec2|color|custom|str|bool)\s*:\s*(.+)$/i);
    if (m) return m[2].trim();
  }
  const setm = stdout.match(/^\s*set:\s*(.+)$/im);
  if (setm) return setm[1].trim();
  return null;
}

export function defaultDraftString(opt: FlatSchemaOption): string {
  const d = opt.default;
  if (d === undefined || d === null) return "";
  if (typeof d === "boolean") return d ? "true" : "false";
  if (typeof d === "number") return String(d);
  return String(d);
}

/** Serializa el valor actual del control a lo que espera `hyprctl keyword <key> <valor>`. */
export function formatKeywordValueFromSchema(opt: FlatSchemaOption, draft: string): string {
  const raw = draft.trim();
  const t = (opt.type ?? "").toLowerCase();
  if (t === "int" || t === "float") {
    const n = parseFloat(raw.replace(",", "."));
    if (Number.isNaN(n)) return raw;
    return t === "int" ? String(Math.trunc(n)) : String(n);
  }
  if (t === "bool") {
    const lower = raw.toLowerCase();
    if (["1", "true", "yes", "on"].includes(lower)) return "true";
    if (["0", "false", "no", "off"].includes(lower)) return "false";
    return raw || "false";
  }
  if (t === "color") {
    if (raw.startsWith("#")) return hexToRgbaKeyword(raw);
    return raw;
  }
  if (t === "choice") return raw;
  return raw;
}

export function isDependencySatisfied(
  opt: FlatSchemaOption,
  draftValues: Record<string, string>
): boolean {
  const dep = opt.depends_on?.trim();
  if (!dep) return true;
  const pv = draftValues[dep];
  if (pv === undefined) return true;
  const lower = pv.trim().toLowerCase();
  if (lower === "false" || lower === "0" || lower === "no" || lower === "off" || lower === "") {
    return false;
  }
  return true;
}
