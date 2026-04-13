/**
 * Normaliza `availableModes` de `hyprctl monitors -j` (strings u objetos) y parsea modos WxH@Hz.
 */

export function normalizeAvailableModes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const w = Number(o.width);
      const h = Number(o.height);
      const rr = o.refreshRate != null ? Number(o.refreshRate) : NaN;
      if (w > 0 && h > 0 && Number.isFinite(rr)) {
        out.push(`${Math.round(w)}x${Math.round(h)}@${rr.toFixed(3)}`);
      }
    }
  }
  return out;
}

/** Opciones de `transform` (Hyprland wiki). */
export const MONITOR_TRANSFORM_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0, label: "0 — Normal" },
  { value: 1, label: "1 — 90°" },
  { value: 2, label: "2 — 180°" },
  { value: 3, label: "3 — 270°" },
  { value: 4, label: "4 — Volteado" },
  { value: 5, label: "5 — Volteado + 90°" },
  { value: 6, label: "6 — Volteado + 180°" },
  { value: 7, label: "7 — Volteado + 270°" },
];

/** Interpreta cadenas tipo `1920x1080@60.00Hz` o `2560x1440@143.912` del EDID. */
export function parseModeString(modeStr: string): { width: number; height: number; refresh: string } | null {
  const s = modeStr.trim();
  const m = s.match(/^(\d+)\s*x\s*(\d+)\s*@\s*([\d.]+)(?:\s*Hz)?$/i);
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  const hz = parseFloat(m[3]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(hz) || w < 1 || h < 1) {
    return null;
  }
  return { width: w, height: h, refresh: hz.toFixed(3) };
}

export function currentModeToken(
  modes: string[],
  w: number,
  h: number,
  refresh: string
): string {
  const r = parseFloat(refresh);
  const r3 = Number.isFinite(r) ? r.toFixed(3) : refresh.trim();
  for (const mode of modes) {
    const p = parseModeString(mode);
    if (p && p.width === w && p.height === h && p.refresh === r3) return mode;
  }
  return "__custom__";
}
