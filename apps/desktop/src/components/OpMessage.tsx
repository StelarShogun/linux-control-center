import type { FC } from "react";
import { ps } from "../theme/playstationDark";

export interface OpMsg {
  kind: "info" | "success" | "error" | "warning";
  text: string;
}

interface Props {
  message: OpMsg | null;
}

const OpMessage: FC<Props> = ({ message }) => {
  if (!message) return null;
  return (
    <div
      style={{
        ...styles.base,
        ...(message.kind === "success"
          ? styles.success
          : message.kind === "error"
            ? styles.error
            : message.kind === "warning"
              ? styles.warning
              : styles.info),
      }}
    >
      {message.text}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  base: {
    marginTop: 12,
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    border: "1px solid",
    lineHeight: 1.5,
  },
  info: {
    background: ps.infoBg,
    color: ps.infoText,
    borderColor: ps.infoBorder,
  },
  success: {
    background: ps.successBg,
    color: ps.successText,
    borderColor: ps.successBorder,
  },
  warning: {
    background: ps.warningBg,
    color: ps.warningText,
    borderColor: ps.warningBorder,
  },
  error: {
    background: ps.dangerBg,
    color: ps.dangerText,
    borderColor: ps.dangerBorder,
  },
};

export default OpMessage;
