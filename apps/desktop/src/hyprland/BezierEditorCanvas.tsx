import { useCallback, useRef, useState, type FC } from "react";
import { ps } from "../theme/playstationDark";

export interface BezierPoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Props {
  value: BezierPoints;
  onChange: (v: BezierPoints) => void;
  size?: number;
}

type Handle = "p1" | "p2";

/**
 * Editor Bézier mínimo: arrastra P1 y P2 (handles de control); P0=(0,0), P3=(1,1) fijos.
 */
export const BezierEditorCanvas: FC<Props> = ({ value, onChange, size = 200 }) => {
  const pad = 16;
  const inner = size - pad * 2;
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Handle | null>(null);

  const toSvg = useCallback(
    (x: number, y: number) => ({
      px: pad + x * inner,
      py: pad + (1 - y) * inner,
    }),
    [pad, inner]
  );

  const fromEvent = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = svgRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      const x = (px - pad) / inner;
      const y = 1 - (py - pad) / inner;
      return {
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1.5, Math.max(-0.5, y)),
      };
    },
    [pad, inner]
  );

  const onMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const p = fromEvent(e.clientX, e.clientY);
    if (!p) return;
    if (drag === "p1") onChange({ ...value, x1: p.x, y1: p.y });
    else onChange({ ...value, x2: p.x, y2: p.y });
  };

  const p0 = toSvg(0, 0);
  const p3 = toSvg(1, 1);
  const h1 = toSvg(value.x1, value.y1);
  const h2 = toSvg(value.x2, value.y2);
  const pathD = `M ${p0.px},${p0.py} C ${h1.px},${h1.py} ${h2.px},${h2.py} ${p3.px},${p3.py}`;

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      style={{ cursor: drag ? "grabbing" : "default", touchAction: "none" }}
      onMouseLeave={() => setDrag(null)}
      onMouseUp={() => setDrag(null)}
      onMouseMove={onMove}
    >
      <rect width={size} height={size} fill={ps.surfaceCode} stroke={ps.borderStrong} />
      <path d={pathD} fill="none" stroke={ps.blue} strokeWidth={2} />
      <line x1={p0.px} y1={p0.py} x2={h1.px} y2={h1.py} stroke={ps.textMuted} strokeWidth={1} strokeDasharray="4 3" />
      <line x1={p3.px} y1={p3.py} x2={h2.px} y2={h2.py} stroke={ps.textMuted} strokeWidth={1} strokeDasharray="4 3" />
      <circle
        cx={h1.px}
        cy={h1.py}
        r={8}
        fill={ps.warningBg}
        stroke={ps.warningBorder}
        style={{ cursor: "grab" }}
        onMouseDown={(e) => {
          e.preventDefault();
          setDrag("p1");
        }}
      />
      <circle
        cx={h2.px}
        cy={h2.py}
        r={8}
        fill={ps.successBg}
        stroke={ps.successBorder}
        style={{ cursor: "grab" }}
        onMouseDown={(e) => {
          e.preventDefault();
          setDrag("p2");
        }}
      />
    </svg>
  );
};
