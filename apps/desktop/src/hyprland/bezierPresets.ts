/** Presets CSS / HyprMod `bezier_presets.py` (valores inmutables). */

export const BUILTIN_BEZIER_PRESETS: Record<string, readonly [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1.0],
  easeIn: [0.42, 0.0, 1.0, 1.0],
  easeOut: [0.0, 0.0, 0.58, 1.0],
  easeInOut: [0.42, 0.0, 0.58, 1.0],
  easeInSine: [0.12, 0.0, 0.39, 0.0],
  easeOutSine: [0.61, 1.0, 0.88, 1.0],
  easeInOutSine: [0.37, 0.0, 0.63, 1.0],
  easeInQuad: [0.11, 0.0, 0.5, 0.0],
  easeOutQuad: [0.5, 1.0, 0.89, 1.0],
  easeInOutQuad: [0.45, 0.0, 0.55, 1.0],
  easeInCubic: [0.32, 0.0, 0.67, 0.0],
  easeOutCubic: [0.33, 1.0, 0.68, 1.0],
  easeInOutCubic: [0.65, 0.0, 0.35, 1.0],
  easeInExpo: [0.7, 0.0, 0.84, 0.0],
  easeOutExpo: [0.16, 1.0, 0.3, 1.0],
  easeInOutExpo: [0.87, 0.0, 0.13, 1.0],
  easeInBack: [0.36, 0.0, 0.66, -0.56],
  easeOutBack: [0.34, 1.56, 0.64, 1.0],
  easeInOutBack: [0.68, -0.6, 0.32, 1.6],
};

export function bezierLine(name: string, x1: number, y1: number, x2: number, y2: number): string {
  return `bezier = ${name}, ${x1}, ${y1}, ${x2}, ${y2}`;
}
