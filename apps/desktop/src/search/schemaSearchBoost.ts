import type { SettingEntry } from "./index";
import {
  flattenSchemaOptions,
  loadHyprlandOptionsSchema,
  type FlatSchemaOption,
} from "../hyprland/schemaLoader";

let cached: SettingEntry[] | null = null;
let inflight: Promise<SettingEntry[]> | null = null;

function flatOptionToEntry(opt: FlatSchemaOption): SettingEntry {
  const bits = [
    opt.key,
    opt.label,
    opt.description ?? "",
    opt.groupLabel,
    opt.sectionLabel,
    opt.type ?? "",
  ];
  const page = opt.groupId === "monitor_globals" ? "monitors" : "hyprland_schema";
  return {
    id: `schema:${opt.key}`,
    label: opt.label,
    keywords: bits.join(" ").toLowerCase(),
    page,
    section: `${opt.groupLabel} › ${opt.sectionLabel}`,
  };
}

/** Entradas derivadas del schema Hyprland (una vez en caché). */
export async function loadSchemaSearchBoost(): Promise<SettingEntry[]> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const schema = await loadHyprlandOptionsSchema();
      cached = flattenSchemaOptions(schema).map(flatOptionToEntry);
      return cached;
    } catch {
      cached = [];
      return cached;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Para pruebas o forzar recarga tras actualizar el JSON. */
export function clearSchemaSearchBoostCache(): void {
  cached = null;
  inflight = null;
}
