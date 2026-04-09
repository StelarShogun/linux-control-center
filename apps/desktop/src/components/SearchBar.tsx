import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import type { Page } from "./Sidebar";
import {
  filterSettingsIndex,
  groupResultsByPage,
  type SettingEntry,
} from "../search/index";

const PAGE_LABEL: Record<Page, string> = {
  appearance: "Apariencia",
  hyprland: "Hyprland",
  keybindings: "Atajos",
  "window-rules": "Reglas de ventana",
  waybar: "Waybar",
  rofi: "Rofi",
  themes: "Temas",
  wallpapers: "Wallpapers",
  systemd: "Systemd",
  network: "Red",
  power: "Energía",
  snapshots: "Snapshots",
  profiles: "Perfiles",
  recent_operations: "Operaciones",
};

interface Props {
  onNavigate: (page: Page) => void;
  disabled?: boolean;
}

const SearchBar: FC<Props> = ({ onNavigate, disabled }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => filterSettingsIndex(q, 32), [q]);
  const grouped = useMemo(() => groupResultsByPage(results), [results]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (disabled) return;
        setOpen(true);
        queueMicrotask(() => inputRef.current?.focus());
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, open, close]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (e: SettingEntry) => {
    onNavigate(e.page);
    close();
  };

  return (
    <div ref={rootRef} style={styles.wrap}>
      <button
        type="button"
        style={styles.trigger}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          queueMicrotask(() => inputRef.current?.focus());
        }}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span style={styles.triggerHint}>Buscar ajustes</span>
        <kbd style={styles.kbd}>Ctrl</kbd>
        <kbd style={styles.kbd}>K</kbd>
      </button>
      {open && !disabled && (
        <div style={styles.dropdown} role="listbox">
          <input
            ref={inputRef}
            type="search"
            placeholder="Escribe para filtrar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={styles.input}
            autoComplete="off"
            aria-label="Buscar ajustes"
          />
          {results.length === 0 ? (
            <div style={styles.empty}>
              {q.trim() ? "Sin resultados" : "Escribe para buscar"}
            </div>
          ) : (
            <div style={styles.results}>
              {Array.from(grouped.entries()).map(([page, items]) => (
                <div key={page} style={styles.group}>
                  <div style={styles.groupTitle}>{PAGE_LABEL[page]}</div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      style={styles.resultRow}
                      onClick={() => pick(item)}
                    >
                      <span style={styles.resultLabel}>{item.label}</span>
                      {item.section && (
                        <span style={styles.resultMeta}>{item.section}</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: "relative", flex: "1 1 220px", maxWidth: 420 },
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #3d4466",
    background: "#151722",
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    textAlign: "left",
  },
  triggerHint: { flex: 1 },
  kbd: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 4,
    border: "1px solid #3d4466",
    background: "#1e2030",
    color: "#6b7280",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    zIndex: 50,
    background: "#1a1c28",
    border: "1px solid #2e3250",
    borderRadius: 8,
    boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
    overflow: "hidden",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "none",
    borderBottom: "1px solid #2e3250",
    background: "#12141c",
    color: "#e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  },
  empty: { padding: 16, fontSize: 12, color: "#6b7280" },
  results: { maxHeight: 320, overflowY: "auto" },
  group: { padding: "6px 0" },
  groupTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6b7280",
    padding: "4px 12px",
  },
  resultRow: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    width: "100%",
    padding: "8px 12px",
    border: "none",
    background: "transparent",
    color: "#d1d5db",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    fontSize: 13,
  },
  resultLabel: { fontWeight: 500 },
  resultMeta: { fontSize: 10, color: "#6b7280", marginTop: 2 },
};

export default SearchBar;
