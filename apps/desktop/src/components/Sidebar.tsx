import { useCallback, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";

export type Page =
  | "appearance"
  | "hyprland"
  | "keybindings"
  | "window-rules"
  | "waybar"
  | "rofi"
  | "themes"
  | "wallpapers"
  | "systemd"
  | "network"
  | "power"
  | "snapshots"
  | "profiles"
  | "recent_operations";

interface NavItem {
  id: Page;
  label: string;
}

interface NavGroup {
  id: string;
  label: string;
  defaultOpen: boolean;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "system",
    label: "Sistema",
    defaultOpen: true,
    items: [
      { id: "systemd", label: "Systemd" },
      { id: "network", label: "Red" },
      { id: "power", label: "Energía" },
    ],
  },
  {
    id: "compositor",
    label: "Compositor",
    defaultOpen: true,
    items: [
      { id: "hyprland", label: "Hyprland" },
      { id: "keybindings", label: "Atajos" },
      { id: "window-rules", label: "Reglas de ventana" },
    ],
  },
  {
    id: "shell",
    label: "Shell",
    defaultOpen: true,
    items: [
      { id: "waybar", label: "Waybar" },
      { id: "rofi", label: "Rofi" },
    ],
  },
  {
    id: "appearance",
    label: "Apariencia",
    defaultOpen: true,
    items: [
      { id: "appearance", label: "Apariencia" },
      { id: "themes", label: "Temas" },
      { id: "wallpapers", label: "Wallpapers" },
    ],
  },
  {
    id: "management",
    label: "Gestión",
    defaultOpen: true,
    items: [
      { id: "snapshots", label: "Snapshots" },
      { id: "profiles", label: "Perfiles" },
      { id: "recent_operations", label: "Últimas operaciones" },
    ],
  },
];

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
  backendStatus: BackendStatus;
}

const Sidebar: FC<SidebarProps> = ({ current, onNavigate, backendStatus }) => {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      init[g.id] = g.defaultOpen;
    }
    return init;
  });

  const toggle = useCallback((id: string) => {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  }, []);

  return (
    <nav style={styles.nav}>
      <div style={styles.title}>Control Center</div>
      <ul style={styles.list}>
        {NAV_GROUPS.map((group) => {
          const isOpen = open[group.id] ?? true;
          return (
            <li key={group.id} style={styles.groupLi}>
              <button
                type="button"
                style={styles.groupHeader}
                onClick={() => toggle(group.id)}
                aria-expanded={isOpen}
              >
                <span style={styles.chev}>{isOpen ? "▼" : "▶"}</span>
                <span style={styles.groupLabel}>{group.label}</span>
              </button>
              {isOpen && (
                <ul style={styles.subList}>
                  {group.items.map((item) => {
                    const isActive = item.id === current;
                    return (
                      <li key={item.id}>
                        <button
                          style={{
                            ...styles.item,
                            ...(isActive ? styles.itemActive : {}),
                          }}
                          onClick={() => onNavigate(item.id)}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <span>{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
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
    width: 216,
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
    gap: 4,
  },
  groupLi: { listStyle: "none" },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    padding: "6px 8px",
    marginTop: 4,
    background: "none",
    border: "none",
    borderRadius: 6,
    color: "#6b7280",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  },
  chev: { fontSize: 9, color: "#4b5563", width: 14 },
  groupLabel: { flex: 1 },
  subList: {
    listStyle: "none",
    margin: 0,
    padding: "0 0 4px 4px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "7px 10px",
    background: "none",
    border: "none",
    borderRadius: 6,
    color: "#9ca3af",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.15s, color 0.15s",
    fontFamily: "inherit",
  },
  itemActive: {
    background: "#2e3250",
    color: "#e2e8f0",
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
