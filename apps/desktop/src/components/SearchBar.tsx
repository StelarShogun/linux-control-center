import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import type { Page } from "./Sidebar";
import {
  filterSettingsIndex,
  groupResultsByPage,
  mergeSearchEntries,
  matchesAllSearchTerms,
  type SettingEntry,
} from "../search/index";
import { loadSchemaSearchBoost } from "../search/schemaSearchBoost";
import { ps } from "../theme/playstationDark";

export type NavigateOpts = {
  focusSchemaKey?: string;
  searchQuery?: string;
};

const PAGE_LABEL: Record<Page, string> = {
  search: "Buscar",
  preferences: "Preferencias",
  appearance: "Apariencia",
  hyprland: "Hyprland",
  hyprland_schema: "Opciones Hyprland (schema)",
  animations: "Animaciones",
  monitors: "Monitores",
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
  onNavigate: (page: Page, opts?: NavigateOpts) => void;
  disabled?: boolean;
}

function filterExtraEntries(entries: SettingEntry[], query: string, limit: number): SettingEntry[] {
  const ql = query.trim();
  if (!ql) return [];
  return entries
    .filter((e) => matchesAllSearchTerms(`${e.label} ${e.keywords} ${e.id}`, ql))
    .slice(0, limit);
}

const SearchBar: FC<Props> = ({ onNavigate, disabled }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [schemaBoost, setSchemaBoost] = useState<SettingEntry[]>([]);

  useEffect(() => {
    if (disabled) return;
    void loadSchemaSearchBoost().then(setSchemaBoost);
  }, [disabled]);

  const results = useMemo(() => {
    const primary = filterSettingsIndex(q, 28);
    const fromSchema = filterExtraEntries(schemaBoost, q, 28);
    return mergeSearchEntries(primary, fromSchema, 40);
  }, [q, schemaBoost]);
  const grouped = useMemo(() => groupResultsByPage(results), [results]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inField =
        t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        if (inField) return;
        e.preventDefault();
        if (disabled) return;
        setOpen(true);
        queueMicrotask(() => inputRef.current?.focus());
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        if (inField) return;
        e.preventDefault();
        if (disabled) return;
        const text = open ? q : "";
        onNavigate("search", { searchQuery: text });
        setOpen(false);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, open, close, onNavigate, q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (entry: SettingEntry) => {
    const focusSchemaKey = entry.id.startsWith("schema:") ? entry.id.slice(7) : undefined;
    onNavigate(entry.page, focusSchemaKey ? { focusSchemaKey } : undefined);
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
        <span style={styles.orHint}> / </span>
        <kbd style={styles.kbd}>Ctrl</kbd>
        <kbd style={styles.kbd}>F</kbd>
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
          <div style={{ padding: "6px 10px", borderBottom: `1px solid ${ps.borderDefault}` }}>
            <button
              type="button"
              className="ps-btn-secondary"
              style={{ fontSize: 12, width: "100%" }}
              onClick={() => {
                onNavigate("search", { searchQuery: q });
                close();
              }}
            >
              Ver todos los resultados…
            </button>
          </div>
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
                      className="ps-search-row"
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
    padding: "8px 14px",
    borderRadius: 12,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfacePanel,
    color: ps.textSecondary,
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "inherit",
    textAlign: "left",
    transition: "border-color 180ms ease, box-shadow 180ms ease",
  },
  triggerHint: { flex: 1 },
  orHint: { fontSize: 11, color: ps.textMuted },
  kbd: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 3,
    border: `1px solid ${ps.borderStrong}`,
    background: ps.surfaceInput,
    color: ps.textMuted,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    zIndex: 50,
    background: ps.surfaceOverlay,
    border: `1px solid ${ps.borderDefault}`,
    borderRadius: 12,
    boxShadow: ps.shadowDropdown,
    overflow: "hidden",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: "none",
    borderBottom: `1px solid ${ps.borderDefault}`,
    background: ps.surfaceCode,
    color: ps.textPrimary,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  },
  empty: { padding: 16, fontSize: 12, color: ps.textMuted },
  results: { maxHeight: 320, overflowY: "auto" },
  group: { padding: "6px 0" },
  groupTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    color: ps.textMuted,
    padding: "6px 14px",
  },
  resultRow: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    width: "100%",
    padding: "8px 14px",
    border: "none",
    background: "transparent",
    color: ps.textSecondary,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    fontSize: 13,
    transition: "background 180ms ease, color 180ms ease",
  },
  resultLabel: { fontWeight: 500 },
  resultMeta: { fontSize: 11, color: ps.textMuted, marginTop: 2 },
};

export default SearchBar;
