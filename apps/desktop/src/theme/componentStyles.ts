import type { CSSProperties } from "react";
import { ps } from "./playstationDark";

/** Tarjeta / panel con radio PlayStation (12px). */
export const psCard: CSSProperties = {
  border: `1px solid ${ps.borderDefault}`,
  borderRadius: 12,
  background: ps.surfacePanel,
  boxShadow: ps.shadowCard,
};

/** Botón secundario compacto (misma voz que `.ps-btn-secondary`, sin clase). */
export const psBtnCompact: CSSProperties = {
  padding: "8px 18px",
  borderRadius: 999,
  border: `1px solid ${ps.borderStrong}`,
  background: ps.surfaceRaised,
  color: ps.textSecondary,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: "inherit",
};

/** Texto de etiqueta / clave en filas. */
export const psKeyLabel: CSSProperties = {
  color: ps.textMuted,
  minWidth: 56,
};
