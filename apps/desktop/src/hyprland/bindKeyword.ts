import type { HyprlandBind } from "../types/settings";

/** Valor para `hyprctl keyword <bind_type> …` (línea tras el tipo). */
export function buildBindKeywordRest(b: HyprlandBind): string {
  const mods = b.modifiers.length ? b.modifiers.join(" ") : "SUPER";
  const bt = (b.bind_type || "bind").trim() || "bind";
  if (bt === "bindd" || bt === "binddr") {
    const desc = b.description.trim() || " ";
    return `${mods}, ${b.key}, ${b.dispatcher}, ${b.args}, ${desc}`;
  }
  if (!b.args.trim()) {
    return `${mods}, ${b.key}, ${b.dispatcher}`;
  }
  return `${mods}, ${b.key}, ${b.dispatcher}, ${b.args}`;
}

/** Argumento de `hyprctl keyword unbind …`. */
export function buildUnbindKeywordRest(b: HyprlandBind): string {
  const mods = b.modifiers.length ? b.modifiers.join(" ") : "SUPER";
  return `${mods}, ${b.key}`;
}
