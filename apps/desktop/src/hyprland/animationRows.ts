/**
 * Categorías de animación Hyprland (`animation = NAME, …`).
 * IDs alineados con el árbol de la wiki 0.54.x:
 * https://wiki.hypr.land/0.54.0/Configuring/Animations/
 */

export interface AnimationRowDef {
  id: string;
  label: string;
}

/** Documentación de referencia para el formato IPC de animaciones. */
export const HYPR_ANIMATIONS_DOC_URL =
  "https://wiki.hypr.land/0.54.0/Configuring/Animations/";

const ANIMATION_GROUP_TITLES = [
  "Global",
  "Ventanas y capas",
  "Fundidos",
  "Espacios de trabajo",
  "Otros",
] as const;

type AnimationGroupTitle = (typeof ANIMATION_GROUP_TITLES)[number];

/** Agrupación tipo HyprMod / wiki (solo UI). */
const ID_TO_ANIMATION_GROUP: Record<string, AnimationGroupTitle> = {
  global: "Global",
  windows: "Ventanas y capas",
  windowsIn: "Ventanas y capas",
  windowsOut: "Ventanas y capas",
  windowsMove: "Ventanas y capas",
  layers: "Ventanas y capas",
  layersIn: "Ventanas y capas",
  layersOut: "Ventanas y capas",
  fade: "Fundidos",
  fadeIn: "Fundidos",
  fadeOut: "Fundidos",
  fadeSwitch: "Fundidos",
  fadeShadow: "Fundidos",
  fadeDim: "Fundidos",
  fadeLayers: "Fundidos",
  fadeLayersIn: "Fundidos",
  fadeLayersOut: "Fundidos",
  fadePopups: "Fundidos",
  fadePopupsIn: "Fundidos",
  fadePopupsOut: "Fundidos",
  fadeDpms: "Fundidos",
  workspaces: "Espacios de trabajo",
  workspacesIn: "Espacios de trabajo",
  workspacesOut: "Espacios de trabajo",
  specialWorkspace: "Espacios de trabajo",
  specialWorkspaceIn: "Espacios de trabajo",
  specialWorkspaceOut: "Espacios de trabajo",
  border: "Otros",
  borderangle: "Otros",
  zoomFactor: "Otros",
  monitorAdded: "Otros",
};

export function animationDefsByGroup(): { groupTitle: string; defs: AnimationRowDef[] }[] {
  const buckets = new Map<string, AnimationRowDef[]>();
  for (const t of ANIMATION_GROUP_TITLES) {
    buckets.set(t, []);
  }
  for (const def of ANIMATION_ROW_DEFS) {
    const g = ID_TO_ANIMATION_GROUP[def.id] ?? "Otros";
    buckets.get(g)!.push(def);
  }
  return ANIMATION_GROUP_TITLES.map((groupTitle) => ({
    groupTitle,
    defs: buckets.get(groupTitle) ?? [],
  })).filter((x) => x.defs.length > 0);
}

export const ANIMATION_ROW_DEFS: AnimationRowDef[] = [
  { id: "global", label: "Global" },
  { id: "windows", label: "Windows" },
  { id: "windowsIn", label: "Windows — abrir" },
  { id: "windowsOut", label: "Windows — cerrar" },
  { id: "windowsMove", label: "Windows — mover" },
  { id: "layers", label: "Layers" },
  { id: "layersIn", label: "Layers — abrir" },
  { id: "layersOut", label: "Layers — cerrar" },
  { id: "fade", label: "Fade" },
  { id: "fadeIn", label: "Fade in" },
  { id: "fadeOut", label: "Fade out" },
  { id: "fadeSwitch", label: "Fade switch" },
  { id: "fadeShadow", label: "Fade — sombra" },
  { id: "fadeDim", label: "Fade — atenuar inactivas" },
  { id: "fadeLayers", label: "Fade — layers" },
  { id: "fadeLayersIn", label: "Fade — layers abrir" },
  { id: "fadeLayersOut", label: "Fade — layers cerrar" },
  { id: "fadePopups", label: "Fade — popups Wayland" },
  { id: "fadePopupsIn", label: "Fade — popups abrir" },
  { id: "fadePopupsOut", label: "Fade — popups cerrar" },
  { id: "fadeDpms", label: "Fade — DPMS" },
  { id: "workspaces", label: "Workspaces" },
  { id: "workspacesIn", label: "Workspaces — entrar" },
  { id: "workspacesOut", label: "Workspaces — salir" },
  { id: "specialWorkspace", label: "Special workspace" },
  { id: "specialWorkspaceIn", label: "Special workspace — entrar" },
  { id: "specialWorkspaceOut", label: "Special workspace — salir" },
  { id: "border", label: "Border" },
  { id: "borderangle", label: "Border angle" },
  { id: "zoomFactor", label: "Zoom" },
  { id: "monitorAdded", label: "Monitor añadido" },
];

/**
 * Valor para `hyprctl keyword animation <valor>` (Hyprland 0.54.x, wiki):
 * `animation = NAME, ONOFF, SPEED, CURVE [,STYLE]` — si ONOFF es 0 se omiten el resto de argumentos.
 */
export function buildAnimationKeywordValue(
  name: string,
  enabled: boolean,
  speed: number,
  curve: string,
  style: string
): string {
  const n = name.trim().replace(/,/g, "");
  if (!n) {
    return "global,0";
  }
  if (!enabled) {
    return `${n},0`;
  }
  const c = curve.trim().replace(/,/g, "") || "default";
  const spd = Number.isFinite(speed) ? speed : 5;
  const st = style.trim();
  if (!st || st === "default") {
    return `${n},1,${spd},${c}`;
  }
  return `${n},1,${spd},${c},${st}`;
}
