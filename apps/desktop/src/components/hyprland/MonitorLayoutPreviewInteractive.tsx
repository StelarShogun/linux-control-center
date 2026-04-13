import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { ps } from "../../theme/playstationDark";
import type { DragMon } from "../../hyprland/monitorHyprland";

const VW = 320;
const VH = 170;
const PAD = 10;

interface Props {
  /** Monitores independientes (sin espejo) con tamaño efectivo ya calculado. */
  items: DragMon[];
  /** Índice del monitor con foco (resalte), opcional. */
  focusedName?: string | null;
  /** Inicio de arrastre (p. ej. apilar snapshot para deshacer). */
  onDragStart?: (id: number) => void;
  /** Mientras arrastra: posición lógica tentativa (ya resuelta por el padre). */
  onDragLive: (
    id: number,
    x: number,
    y: number,
    startMonX: number,
    startMonY: number
  ) => void;
  /** Fin del gesto (aplicar undo local, etc.). */
  onDragEnd: () => void;
}

function computeLayout(items: DragMon[]) {
  const active = items.filter((m) => !m.disabled && !m.mirrorOf.trim());
  if (active.length === 0) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of active) {
    minX = Math.min(minX, m.x);
    minY = Math.min(minY, m.y);
    maxX = Math.max(maxX, m.x + m.ew);
    maxY = Math.max(maxY, m.y + m.eh);
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const sx = (VW - PAD * 2) / bw;
  const sy = (VH - PAD * 2) / bh;
  const sc = Math.min(sx, sy);
  const drawnW = bw * sc;
  const drawnH = bh * sc;
  const ox = (VW - drawnW) / 2;
  const oy = (VH - drawnH) / 2;
  return { active, minX, minY, sc, ox, oy };
}

function hitTest(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  layout: NonNullable<ReturnType<typeof computeLayout>>
): number | null {
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;
  const { active, minX, minY, sc, ox, oy } = layout;
  for (let i = active.length - 1; i >= 0; i--) {
    const mon = active[i]!;
    const mx = ox + (mon.x - minX) * sc;
    const my = oy + (mon.y - minY) * sc;
    const mw = mon.ew * sc;
    const mh = mon.eh * sc;
    if (cx >= mx && cx <= mx + mw && cy >= my && cy <= my + mh) {
      return mon.id;
    }
  }
  return null;
}

/**
 * Vista previa con arrastre (posición en px lógicos, cuadrícula 10 px como HyprMod).
 */
export const MonitorLayoutPreviewInteractive: FC<Props> = ({
  items,
  focusedName,
  onDragStart,
  onDragLive,
  onDragEnd,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{
    id: number;
    startClientX: number;
    startClientY: number;
    startMonX: number;
    startMonY: number;
  } | null>(null);

  const layout = computeLayout(items);
  const multi = (layout?.active.length ?? 0) > 1;

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!drag || !layout || !svgRef.current) return;
      const sc = layout.sc;
      const dx = Math.round((e.clientX - drag.startClientX) / sc);
      const dy = Math.round((e.clientY - drag.startClientY) / sc);
      const nx = Math.round((drag.startMonX + dx) / 10) * 10;
      const ny = Math.round((drag.startMonY + dy) / 10) * 10;
      onDragLive(drag.id, nx, ny, drag.startMonX, drag.startMonY);
    },
    [drag, layout, onDragLive]
  );

  const onMouseUp = useCallback(() => {
    if (drag) {
      onDragEnd();
      setDrag(null);
    }
  }, [drag, onDragEnd]);

  useEffect(() => {
    if (!drag) return;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [drag, onMouseMove, onMouseUp]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!multi || !layout || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const id = hitTest(e.clientX, e.clientY, rect, layout);
    if (id === null) return;
    const mon = items.find((m) => m.id === id);
    if (!mon || mon.disabled || mon.mirrorOf.trim()) return;
    e.preventDefault();
    onDragStart?.(id);
    setDrag({
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMonX: mon.x,
      startMonY: mon.y,
    });
  };

  if (!layout) {
    return (
      <p style={{ fontSize: 12, color: ps.textMuted, margin: 0 }}>
        Sin monitores para la vista previa.
      </p>
    );
  }

  const { active, minX, minY, sc, ox, oy } = layout;

  return (
    <div>
      <svg
        ref={svgRef}
        width={VW}
        height={VH}
        style={{
          display: "block",
          borderRadius: 4,
          background: ps.surfaceCode,
          cursor: multi ? "grab" : "default",
        }}
        onMouseDown={onMouseDown}
        aria-hidden
      >
        {active.map((mon) => {
          const mx = ox + (mon.x - minX) * sc;
          const my = oy + (mon.y - minY) * sc;
          const mw = mon.ew * sc;
          const mh = mon.eh * sc;
          const focused = focusedName != null && focusedName === mon.name;
          return (
            <g key={mon.id}>
              <rect
                x={mx}
                y={my}
                width={mw}
                height={mh}
                fill={focused ? ps.infoBg : ps.surfaceInput}
                stroke={focused ? ps.blue : ps.borderStrong}
                strokeWidth={focused ? 2 : 1}
                rx={2}
              />
              <text
                x={mx + 6}
                y={my + 14}
                fill={ps.textPrimary}
                style={{ fontSize: 10, fontFamily: "system-ui, sans-serif" }}
                pointerEvents="none"
              >
                {mon.name.length > 16 ? `${mon.name.slice(0, 14)}…` : mon.name}
              </text>
            </g>
          );
        })}
      </svg>
      {multi && (
        <p style={{ fontSize: 10, color: ps.textMuted, margin: "6px 0 0 0" }}>
          Arrastra un rectángulo para mover la salida (cuadrícula 10 px).
        </p>
      )}
    </div>
  );
};
