import type { FC } from "react";

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
    background: "#151722",
    color: "#9ca3af",
    borderColor: "#2e3250",
  },
  success: {
    background: "#0b1f1a",
    color: "#a7f3d0",
    borderColor: "#1f3a3a",
  },
  warning: {
    background: "#1a1500",
    color: "#fde68a",
    borderColor: "#4a3f20",
  },
  error: {
    background: "#1f0b0b",
    color: "#fecaca",
    borderColor: "#3a1f1f",
  },
};

export default OpMessage;
