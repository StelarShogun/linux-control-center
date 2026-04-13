import type { Page } from "../components/Sidebar";

export interface SettingEntry {
  id: string;
  label: string;
  /** Texto para coincidencia (minúsculas internamente). */
  keywords: string;
  page: Page;
  section?: string;
}

/** Índice estático para búsqueda global (Ctrl+K). */
export const SEARCH_INDEX: SettingEntry[] = [
  // Apariencia
  {
    id: "app-theme",
    label: "Tema de apariencia",
    keywords: "appearance theme dark light accent",
    page: "appearance",
    section: "Apariencia",
  },
  {
    id: "app-accent",
    label: "Color de acento",
    keywords: "accent color appearance",
    page: "appearance",
  },
  {
    id: "app-font",
    label: "Fuente y tamaño",
    keywords: "font family size appearance",
    page: "appearance",
  },
  {
    id: "app-icons",
    label: "Tema de iconos y cursor",
    keywords: "icon cursor theme appearance",
    page: "appearance",
  },
  // Hyprland principal
  {
    id: "hypr-gaps",
    label: "Gaps Hyprland",
    keywords: "gaps border hyprland spacing",
    page: "hyprland",
  },
  {
    id: "hypr-decoration",
    label: "Rounding y blur",
    keywords: "decoration blur rounding hyprland",
    page: "hyprland",
  },
  {
    id: "hypr-input",
    label: "Input teclado y puntero",
    keywords: "keyboard layout sensitivity scroll touchpad hyprland input",
    page: "hyprland",
  },
  {
    id: "hypr-apply",
    label: "Apply live Hyprland",
    keywords: "apply reload hyprctl hyprland",
    page: "hyprland",
  },
  {
    id: "hypr-schema",
    label: "Opciones Hyprland (schema JSON)",
    keywords: "schema options gaps decoration keyword hyprmod",
    page: "hyprland_schema",
  },
  {
    id: "hypr-anim",
    label: "Animaciones y curvas Bézier",
    keywords: "animation bezier easing curve hyprland",
    page: "animations",
  },
  {
    id: "hypr-monitors",
    label: "Monitores Hyprland",
    keywords: "monitor display resolution layout hyprctl",
    page: "monitors",
  },
  // Atajos y reglas
  {
    id: "hypr-binds",
    label: "Atajos de teclado (bind)",
    keywords: "keybindings bind shortcut keyboard hyprland",
    page: "keybindings",
  },
  {
    id: "hypr-rules",
    label: "Reglas de ventana",
    keywords: "window rules windowrulev2 float hyprland",
    page: "window-rules",
  },
  // Shell
  {
    id: "waybar",
    label: "Waybar",
    keywords: "bar modules waybar status",
    page: "waybar",
  },
  {
    id: "rofi",
    label: "Rofi",
    keywords: "launcher rofi drun",
    page: "rofi",
  },
  // Temas y fondos
  {
    id: "themes",
    label: "Theme Manager",
    keywords: "preset nord graphite theme tokens",
    page: "themes",
  },
  {
    id: "wallpapers",
    label: "Wallpapers",
    keywords: "fondo wallpaper imagen",
    page: "wallpapers",
  },
  // Sistema
  {
    id: "systemd",
    label: "Systemd",
    keywords: "units services systemd unidades",
    page: "systemd",
  },
  {
    id: "network",
    label: "Red",
    keywords: "network interface ip ethernet wifi",
    page: "network",
  },
  {
    id: "power",
    label: "Energía",
    keywords: "power battery perfil balanced performance",
    page: "power",
  },
  // Gestión
  {
    id: "snapshots",
    label: "Snapshots",
    keywords: "snapshot backup restore",
    page: "snapshots",
  },
  {
    id: "profiles",
    label: "Perfiles",
    keywords: "profile settings export",
    page: "profiles",
  },
  {
    id: "journal",
    label: "Últimas operaciones",
    keywords: "journal operations log audit backup",
    page: "recent_operations",
  },
  {
    id: "lcc-preferences",
    label: "Preferencias de la app",
    keywords: "preferences autosave guardado local storage lcc settings",
    page: "preferences",
    section: "LCC",
  },
  {
    id: "hypr-reload-only",
    label: "hyprctl reload (solo compositor)",
    keywords: "reload recargar hyprctl compositor sin escribir archivos",
    page: "hyprland",
  },
];

/** HyprMod: todas las palabras deben aparecer en el texto (substring). */
export function matchesAllSearchTerms(haystack: string, query: string): boolean {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return true;
  const h = haystack.toLowerCase();
  return terms.every((t) => h.includes(t));
}

export function filterSettingsIndex(query: string, limit = 24): SettingEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_INDEX.filter((e) => {
    const blob = `${e.label} ${e.keywords} ${e.id}`;
    return matchesAllSearchTerms(blob, q);
  }).slice(0, limit);
}

/** Combina dos listas ya filtradas por la misma consulta, sin duplicar `id`. */
export function mergeSearchEntries(
  primary: SettingEntry[],
  secondary: SettingEntry[],
  max: number
): SettingEntry[] {
  const seen = new Set<string>();
  const out: SettingEntry[] = [];
  for (const e of [...primary, ...secondary]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
    if (out.length >= max) break;
  }
  return out;
}

export function groupResultsByPage(entries: SettingEntry[]): Map<Page, SettingEntry[]> {
  const m = new Map<Page, SettingEntry[]>();
  for (const e of entries) {
    const arr = m.get(e.page) ?? [];
    arr.push(e);
    m.set(e.page, arr);
  }
  return m;
}
