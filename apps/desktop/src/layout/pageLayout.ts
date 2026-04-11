import type { CSSProperties } from "react";

/** Contenedor de página: ancho completo del área principal, padding responsive. */
export const PAGE_BASE: CSSProperties = {
  padding: "24px clamp(16px, 2.5vw, 48px)",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
};
