import type { FC } from "react";
import type { BackendStatus } from "../types/backend";

export type Page =
  | "appearance"
  | "hyprland"
  | "waybar"
  | "rofi"
  | "systemd"
  | "snapshots"
  | "profiles";

interface NavItem {
  id: Page;
  label: string;
  implemented: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "appearance", label: "Appearance", implemented: true },
  { id: "hyprland", label: "Hyprland", implemented: true },
  { id: "waybar", label: "Waybar", implemented: true },
  { id: "rofi", label: "Rofi", implemented: true },
  { id: "systemd", label: "Systemd", implemented: true },
  { id: "snapshots", label: "Snapshots", implemented: true },
  { id: "profiles", label: "Profiles", implemented: true },
];

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
  backendStatus: BackendStatus;
}

const Sidebar: FC<SidebarProps> = ({ current, onNavigate, backendStatus }) => {
  return (
    <nav style={styles.nav}>
      <div style={styles.title}>Control Center</div>
      <ul style={styles.list}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === current;
          return (
            <li key={item.id}>
              <button
                style={{
                  ...styles.item,
                  ...(isActive ? styles.itemActive : {}),
                  ...(item.implemented ? {} : styles.itemDisabled),
                }}
                onClick={() => {
                  if (!item.implemented) return;
                  onNavigate(item.id);
                }}
                disabled={!item.implemented}
                aria-current={isActive ? "page" : undefined}
                title={!item.implemented ? "Pendiente de implementar" : undefined}
              >
                <span>{item.label}</span>
                {!item.implemented && (
                  <span style={styles.badge}>TODO</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div style={styles.footer}>
        <div style={styles.footerLabel}>Backend</div>
        <div
          style={{
            ...styles.pill,
            ...(backendStatus === "ready"
              ? styles.pillReady
              : backendStatus === "loading"
                ? styles.pillLoading
                : styles.pillUnavailable),
          }}
        >
          {backendStatus === "ready"
            ? "Ready"
            : backendStatus === "loading"
              ? "Loading…"
              : "Unavailable"}
        </div>
      </div>
    </nav>
  );
};

const styles: Record<string, React.CSSProperties> = {
  nav: {
    width: 200,
    minHeight: "100vh",
    background: "#1e2030",
    borderRight: "1px solid #2e3250",
    display: "flex",
    flexDirection: "column",
    padding: "16px 0",
    boxSizing: "border-box",
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "#88c0d0",
    padding: "0 16px 16px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    borderBottom: "1px solid #2e3250",
    marginBottom: 8,
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: "0 8px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "8px 12px",
    background: "none",
    border: "none",
    borderRadius: 6,
    color: "#9ca3af",
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.15s, color 0.15s",
  },
  itemActive: {
    background: "#2e3250",
    color: "#e2e8f0",
  },
  itemDisabled: {
    opacity: 0.5,
    cursor: "default",
  },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    background: "#374151",
    color: "#6b7280",
    borderRadius: 4,
    padding: "1px 5px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  footer: {
    marginTop: "auto",
    padding: "12px 16px 0",
    borderTop: "1px solid #2e3250",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  footerLabel: { fontSize: 12, color: "#6b7280" },
  pill: {
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 999,
    padding: "3px 10px",
    border: "1px solid #2e3250",
    color: "#9ca3af",
    background: "#151722",
    letterSpacing: "0.02em",
  },
  pillReady: { borderColor: "#1f3a3a", color: "#a7f3d0", background: "#0b1f1a" },
  pillLoading: { borderColor: "#2e3250", color: "#e2e8f0", background: "#151722" },
  pillUnavailable: { borderColor: "#3a1f1f", color: "#fecaca", background: "#1f0b0b" },
};

export default Sidebar;
