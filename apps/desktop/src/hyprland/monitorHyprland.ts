/**
 * Lógica de monitores alineada con HyprMod / hyprland-monitors (sin copiar código GPL):
 * escalas cuantizadas 1/120, tamaño lógico efectivo según transform, vecinos, conexión y keyword.
 */

export const SCALE_QUANT = 120;

export interface ScaleOption {
  value: number;
  label: string;
}

/** `width/scale` y `height/scale` deben ser enteros (layout lógico Hyprland). */
export function isValidHyprlandScale(width: number, height: number, scale: number): boolean {
  if (!Number.isFinite(scale) || scale <= 0) return false;
  const lw = width / scale;
  const lh = height / scale;
  return (
    Math.abs(lw - Math.round(lw)) < 1e-4 &&
    Math.abs(lh - Math.round(lh)) < 1e-4 &&
    lw >= 1 &&
    lh >= 1
  );
}

/** Escalas válidas entre ~0.2 y 4.0 en pasos de 1/120 (comportamiento típico Hyprland). */
export function computeValidScales(width: number, height: number): ScaleOption[] {
  const out: ScaleOption[] = [];
  const seen = new Set<number>();
  const minK = 25;
  const maxK = 480;
  for (let k = minK; k <= maxK; k++) {
    const s = k / SCALE_QUANT;
    if (!isValidHyprlandScale(width, height, s)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    const label = Number.isInteger(s) ? `${s}×` : `${s.toFixed(3).replace(/\.?0+$/, "")}×`;
    out.push({ value: s, label });
  }
  out.sort((a, b) => a.value - b.value);
  return out;
}

export function nearestScaleIndex(scales: ScaleOption[], target: number): number {
  if (scales.length === 0) return 0;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < scales.length; i++) {
    const d = Math.abs(scales[i]!.value - target);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Tamaño lógico para colisiones / layout (90° y 270° intercambian ejes). */
export function effectiveLogicalSize(
  width: number,
  height: number,
  transform: number
): { ew: number; eh: number } {
  const t = Math.min(7, Math.max(0, Math.round(transform)));
  if (t % 2 === 1) return { ew: height, eh: width };
  return { ew: width, eh: height };
}

export interface MonitorGeom {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  transform: number;
  disabled: boolean;
  mirrorOf: string;
}

const EPS = 2;

function yOverlap(a: MonitorGeom, ea: { ew: number; eh: number }, b: MonitorGeom, eb: { ew: number; eh: number }): boolean {
  return !(a.y + ea.eh <= b.y + EPS || b.y + eb.eh <= a.y + EPS);
}

function xOverlap(a: MonitorGeom, ea: { ew: number; eh: number }, b: MonitorGeom, eb: { ew: number; eh: number }): boolean {
  return !(a.x + ea.ew <= b.x + EPS || b.x + eb.ew <= a.x + EPS);
}

/** Salidas activas no espejo comparten borde (no solo esquina). */
export function allMonitorsConnected(monitors: MonitorGeom[]): boolean {
  const act = monitors.filter((m) => !m.disabled && !m.mirrorOf.trim());
  if (act.length <= 1) return true;
  const eff = (m: MonitorGeom) => effectiveLogicalSize(m.width, m.height, m.transform);

  const neighbors = (i: number): number[] => {
    const a = act[i]!;
    const ea = eff(a);
    const n: number[] = [];
    for (let j = 0; j < act.length; j++) {
      if (i === j) continue;
      const b = act[j]!;
      const eb = eff(b);
      const touchRight =
        Math.abs(a.x + ea.ew - b.x) < EPS && yOverlap(a, ea, b, eb);
      const touchLeft =
        Math.abs(b.x + eb.ew - a.x) < EPS && yOverlap(a, ea, b, eb);
      const touchBottom =
        Math.abs(a.y + ea.eh - b.y) < EPS && xOverlap(a, ea, b, eb);
      const touchTop =
        Math.abs(b.y + eb.eh - a.y) < EPS && xOverlap(a, ea, b, eb);
      if (touchRight || touchLeft || touchBottom || touchTop) n.push(j);
    }
    return n;
  };

  const visited = new Set<number>();
  const stack = [0];
  visited.add(0);
  while (stack.length) {
    const u = stack.pop()!;
    for (const v of neighbors(u)) {
      if (!visited.has(v)) {
        visited.add(v);
        stack.push(v);
      }
    }
  }
  return visited.size === act.length;
}

export function validateMirror(
  monitors: MonitorGeom[],
  self: MonitorGeom,
  mirrorTarget: string
): string | null {
  const t = mirrorTarget.trim();
  if (!t) return null;
  if (t === self.name) return "No puedes espejar un monitor hacia sí mismo.";
  const tgt = monitors.find((m) => m.name === t);
  if (!tgt) return "No se encontró la salida fuente del mirror.";
  if (tgt.disabled) return "No puedes espejar desde un monitor desactivado.";
  if (tgt.mirrorOf.trim() === self.name) return "Esto crearía un mirror circular.";
  return null;
}

/**
 * Desplaza monitores adyacentes cuando cambia el tamaño lógico efectivo de uno (idea HyprMod).
 */
export function adjustNeighbors(
  monitors: MonitorGeom[],
  changedId: number,
  oldEw: number,
  oldEh: number
): MonitorGeom[] {
  const m = monitors.find((x) => x.id === changedId);
  if (!m || m.disabled) return monitors;
  const { ew: newEw, eh: newEh } = effectiveLogicalSize(m.width, m.height, m.transform);
  const dW = newEw - oldEw;
  const dH = newEh - oldEh;
  if (Math.abs(dW) < EPS && Math.abs(dH) < EPS) return monitors;

  const mx = m.x;
  const my = m.y;
  const oldRight = mx + oldEw;
  const oldBottom = my + oldEh;

  return monitors.map((o) => {
    if (o.id === m.id || o.disabled || o.mirrorOf.trim()) return o;
    const e = effectiveLogicalSize(o.width, o.height, o.transform);
    let { x, y } = o;
    if (yOverlap(m, { ew: oldEw, eh: oldEh }, o, e) && o.x >= oldRight - EPS) {
      x += dW;
    }
    if (xOverlap(m, { ew: oldEw, eh: oldEh }, o, e) && o.y >= oldBottom - EPS) {
      y += dH;
    }
    return { ...o, x, y };
  });
}

export interface MonitorKeywordInput {
  name: string;
  width: number;
  height: number;
  refresh: string;
  x: number;
  y: number;
  scale: number;
  transform: number;
  disabled: boolean;
  mirrorOf: string;
  /** "8" | "10" | "" omitir */
  bitDepth: string;
  /** "1" | "2" | "3" | "" omitir (off) */
  vrr: string;
  /** "srgb" | "hdr" | "" */
  cm: string;
}

export function buildMonitorKeywordFull(m: MonitorKeywordInput): string {
  if (m.disabled) {
    return `${m.name},disable`;
  }
  const w = Math.max(1, Math.round(m.width));
  const h = Math.max(1, Math.round(m.height));
  const rr = m.refresh.trim() || "60";
  const x = Math.round(m.x);
  const y = Math.round(m.y);
  const sc = m.scale;
  let line = `${m.name},${w}x${h}@${rr},${x}x${y},${sc}`;
  const tr = Math.round(Math.min(7, Math.max(0, m.transform)));
  if (tr !== 0) line += `,transform,${tr}`;
  const mir = m.mirrorOf.trim();
  if (mir) line += `,mirror,${mir}`;
  const bd = m.bitDepth.trim();
  if (bd === "8" || bd === "10") line += `,bitdepth,${bd}`;
  const vrr = m.vrr.trim();
  if (vrr === "1" || vrr === "2" || vrr === "3") line += `,vrr,${vrr}`;
  const cm = m.cm.trim().toLowerCase();
  if (cm === "srgb" || cm === "hdr") line += `,cm,${cm}`;
  return line;
}

/** Estado mínimo para arrastre en la vista previa (tamaños lógicos efectivos). */
export interface DragMon {
  id: number;
  name: string;
  x: number;
  y: number;
  ew: number;
  eh: number;
  disabled: boolean;
  mirrorOf: string;
}

export function previewResolveCollisions(
  all: DragMon[],
  dragId: number,
  x: number,
  y: number,
  startX: number,
  startY: number
): { x: number; y: number } {
  const dragged = all.find((m) => m.id === dragId);
  if (!dragged) return { x, y };
  let nx = x;
  let ny = y;
  const dw = dragged.ew;
  const dh = dragged.eh;
  const sx = startX;
  const sy = startY;

  for (const other of all) {
    if (other.id === dragId || other.mirrorOf.trim()) continue;
    const ow = other.ew;
    const oh = other.eh;
    const ox = other.x;
    const oy = other.y;
    if (!(nx < ox + ow && nx + dw > ox && ny < oy + oh && ny + dh > oy)) continue;

    const hSep = sx + dw <= ox || sx >= ox + ow;
    const vSep = sy + dh <= oy || sy >= oy + oh;
    const candidates: [number, number, number][] = [];

    if (hSep) {
      if (nx + dw / 2 < ox + ow / 2) candidates.push([ox - dw, ny, nx + dw - ox]);
      else candidates.push([ox + ow, ny, ox + ow - nx]);
    }
    if (vSep) {
      if (ny + dh / 2 < oy + oh / 2) candidates.push([nx, oy - dh, ny + dh - oy]);
      else candidates.push([nx, oy + oh, oy + oh - ny]);
    }

    if (candidates.length === 0) {
      if (
        Math.abs(nx + dw / 2 - ox - ow / 2) * (dh + oh) >=
        Math.abs(ny + dh / 2 - oy - oh / 2) * (dw + ow)
      ) {
        nx = nx + dw / 2 < ox + ow / 2 ? ox - dw : ox + ow;
      } else {
        ny = ny + dh / 2 < oy + oh / 2 ? oy - dh : oy + oh;
      }
      continue;
    }
    const best = candidates.reduce((a, b) => (a[2] <= b[2] ? a : b));
    nx = best[0]!;
    ny = best[1]!;
  }
  return { x: nx, y: ny };
}

const MAX_EXTENT_FACTOR = 3;

export function previewClampExtent(
  all: DragMon[],
  dragId: number,
  x: number,
  y: number
): { x: number; y: number } {
  const dragged = all.find((m) => m.id === dragId);
  if (!dragged) return { x, y };
  const dw = dragged.ew;
  const dh = dragged.eh;
  const active = all.filter((m) => !m.disabled && !m.mirrorOf.trim());
  if (active.length < 2) return { x, y };

  const contentW = active.reduce((s, m) => s + m.ew, 0);
  const contentH = active.reduce((s, m) => s + m.eh, 0);
  const maxW = contentW * MAX_EXTENT_FACTOR;
  const maxH = contentH * MAX_EXTENT_FACTOR;

  const others = active.filter((m) => m.id !== dragId);
  if (others.length === 0) return { x, y };
  const minOx = Math.min(...others.map((m) => m.x));
  const minOy = Math.min(...others.map((m) => m.y));
  const maxOx = Math.max(...others.map((m) => m.x + m.ew));
  const maxOy = Math.max(...others.map((m) => m.y + m.eh));

  let nx = x;
  let ny = y;
  nx = Math.max(nx, Math.min(minOx, maxOx - maxW));
  nx = Math.min(nx, Math.max(maxOx, minOx + maxW) - dw);
  ny = Math.max(ny, Math.min(minOy, maxOy - maxH));
  ny = Math.min(ny, Math.max(maxOy, minOy + maxH) - dh);
  return { x: nx, y: ny };
}
