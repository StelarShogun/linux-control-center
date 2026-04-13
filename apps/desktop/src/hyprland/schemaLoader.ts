/** Carga `public/hyprland/schema/options.json` (portado desde HyprMod). */

export const SCHEMA_OPTIONS_URL = "/hyprland/schema/options.json";

export const MIN_SCHEMA_QUERY_LENGTH = 2;

export interface SchemaChoiceValue {
  id: string;
  label: string;
}

export interface SchemaOption {
  key: string;
  label: string;
  description?: string;
  type?: string;
  default?: unknown;
  min?: number;
  max?: number;
  /** Si está definido, la opción solo tiene sentido cuando la dependencia está activa (HyprMod). */
  depends_on?: string;
  values?: SchemaChoiceValue[];
}

export interface SchemaSection {
  id: string;
  label: string;
  options: SchemaOption[];
}

export interface SchemaGroup {
  id: string;
  label: string;
  icon?: string;
  hidden?: boolean;
  sections: SchemaSection[];
}

export interface HyprlandOptionsSchema {
  groups: SchemaGroup[];
}

export async function loadHyprlandOptionsSchema(): Promise<HyprlandOptionsSchema> {
  const res = await fetch(SCHEMA_OPTIONS_URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al cargar schema`);
  }
  return (await res.json()) as HyprlandOptionsSchema;
}

export interface FlatSchemaOption extends SchemaOption {
  groupId: string;
  groupLabel: string;
  sectionLabel: string;
}

export function flattenSchemaOptions(schema: HyprlandOptionsSchema): FlatSchemaOption[] {
  const out: FlatSchemaOption[] = [];
  for (const g of schema.groups) {
    if (g.hidden === true) continue;
    for (const sec of g.sections) {
      for (const opt of sec.options) {
        out.push({
          ...opt,
          groupId: g.id,
          groupLabel: g.label,
          sectionLabel: sec.label,
        });
      }
    }
  }
  return out;
}

export function searchSchemaOptions(
  flat: FlatSchemaOption[],
  query: string
): FlatSchemaOption[] {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_SCHEMA_QUERY_LENGTH) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return flat.filter((opt) => {
    const blob = `${opt.label} ${opt.description ?? ""} ${opt.key}`.toLowerCase();
    return terms.every((t) => blob.includes(t));
  });
}
