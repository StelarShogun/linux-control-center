import type { FC, ReactNode } from "react";
import { ps } from "../../theme/playstationDark";

export interface OptionRowProps {
  title: ReactNode;
  description?: string;
  /** Controles (inputs) a la derecha */
  children: ReactNode;
  /** Acciones secundarias (p. ej. IPC) */
  actions?: ReactNode;
}

/**
 * Fila tipo HyprMod / libadwaita: título, descripción opcional, control y acciones.
 */
export const OptionRow: FC<OptionRowProps> = ({ title, description, children, actions }) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-start",
      gap: 12,
      padding: "12px 0",
      borderBottom: `1px solid ${ps.borderSubtle}`,
    }}
  >
    <div style={{ flex: "1 1 200px", minWidth: 160 }}>
      <div style={{ fontSize: 14, color: ps.textPrimary, fontWeight: 500 }}>{title}</div>
      {description && (
        <div style={{ fontSize: 12, color: ps.textMuted, marginTop: 4, lineHeight: 1.45 }}>
          {description}
        </div>
      )}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {children}
      {actions}
    </div>
  </div>
);

const ctrlBase: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 3,
  border: `1px solid ${ps.borderStrong}`,
  background: ps.surfaceInput,
  color: ps.textPrimary,
  fontSize: 13,
  fontFamily: "inherit",
};

export const optionInputStyle: React.CSSProperties = ctrlBase;

export const optionRangeStyle: React.CSSProperties = {
  width: 140,
  accentColor: ps.blue,
};
