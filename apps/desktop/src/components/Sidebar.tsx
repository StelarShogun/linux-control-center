import { useCallback, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import type { AppSettings } from "../types/settings";
import { ps } from "../theme/playstationDark";
import DnaStrip from "./DnaStrip";

export type Page =
  | "search"
  | "preferences"
  | "appearance"
  | "hyprland"
  | "hyprland_schema"
  | "animations"
  | "monitors"
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
      { id: "hyprland_schema", label: "Opciones (schema)" },
      { id: "animations", label: "Animaciones" },
      { id: "monitors", label: "Monitores" },
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
      { id: "preferences", label: "Preferencias" },
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
  dirtyCounts?: Partial<Record<Page, number>>;
  settings?: AppSettings;
}

const Sidebar: FC<SidebarProps> = ({ current, onNavigate, backendStatus, dirtyCounts, settings }) => {
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
      <div style={styles.title}>Control center</div>
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
                          <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                            <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                            {dirtyCounts && dirtyCounts[item.id] ? (
                              <span style={styles.badge}>{dirtyCounts[item.id]}</span>
                            ) : null}
                          </span>
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
        {settings && (
          <div style={{ padding: "0 12px 12px", display: "flex", justifyContent: "center" }}>
            <DnaStrip settings={settings} />
          </div>
        )}
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
    width: 220,
    minHeight: "100vh",
    background: ps.surfaceChrome,
    borderRight: `1px solid ${ps.borderDefault}`,
    display: "flex",
    flexDirection: "column",
    padding: "20px 0",
    boxSizing: "border-box",
    flexShrink: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: 300,
    letterSpacing: "0.04em",
    color: ps.textPrimary,
    padding: "0 18px 18px",
    borderBottom: `1px solid ${ps.borderDefault}`,
    marginBottom: 10,
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
    padding: "8px 10px",
    marginTop: 4,
    background: "none",
    border: "none",
    borderRadius: 6,
    color: ps.textMuted,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.02em",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  },
  chev: { fontSize: 10, color: ps.textDisabled, width: 14 },
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
    padding: "8px 12px",
    background: "none",
    border: "none",
    borderRadius: 8,
    color: ps.textSecondary,
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left",
    transition: "background 180ms ease, color 180ms ease",
    fontFamily: "inherit",
  },
  itemActive: {
    background: "rgba(0, 112, 204, 0.22)",
    color: ps.textPrimary,
    boxShadow: `inset 3px 0 0 ${ps.blue}`,
  },
  footer: {
    marginTop: "auto",
    padding: "14px 18px 0",
    borderTop: `1px solid ${ps.borderDefault}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    minWidth: 18,
    height: 18,
    lineHeight: "18px",
    textAlign: "center",
    borderRadius: 9,
    background: ps.borderStrong,
    color: ps.textPrimary,
    flexShrink: 0,
  },
  footerLabel: { fontSize: 12, color: ps.textMuted },
  pill: {
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 999,
    padding: "4px 12px",
    border: `1px solid ${ps.borderStrong}`,
    color: ps.textSecondary,
    background: ps.surfacePanel,
    letterSpacing: "0.02em",
  },
  pillReady: {
    borderColor: ps.successBorder,
    color: ps.successText,
    background: ps.successBg,
  },
  pillLoading: {
    borderColor: ps.borderStrong,
    color: ps.textPrimary,
    background: ps.surfacePanel,
  },
  pillUnavailable: {
    borderColor: ps.dangerBorder,
    color: ps.dangerText,
    background: ps.dangerBg,
  },
};

export default Sidebar;
