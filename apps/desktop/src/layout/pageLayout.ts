import type { CSSProperties } from "react";
import { ps } from "../theme/playstationDark";

/** Contenedor de página: ancho completo del área principal, padding responsive. */
export const PAGE_BASE: CSSProperties = {
  padding: "32px clamp(16px, 2.5vw, 56px)",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  color: ps.textPrimary,
};

/** Títulos de página — SST display weight 300 (DESIGN.md). */
export const PAGE_HEADING: CSSProperties = {
  fontSize: 22,
  fontWeight: 300,
  letterSpacing: "0.01em",
  lineHeight: 1.25,
  color: ps.textPrimary,
  marginBottom: 8,
};

/** Notas / cuerpo secundario bajo el título. */
export const PAGE_NOTE: CSSProperties = {
  fontSize: 13,
  color: ps.textMuted,
  marginBottom: 20,
  lineHeight: 1.6,
};
