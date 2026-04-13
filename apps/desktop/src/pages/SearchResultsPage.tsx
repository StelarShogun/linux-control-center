import { useEffect, useMemo, useState, type FC } from "react";
import type { BackendStatus } from "../types/backend";
import type { Page } from "../components/Sidebar";
import {
  filterSettingsIndex,
  groupResultsByPage,
  mergeSearchEntries,
  matchesAllSearchTerms,
  type SettingEntry,
} from "../search/index";
import { loadSchemaSearchBoost } from "../search/schemaSearchBoost";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";

const PAGE_LABEL: Record<Page, string> = {
  search: "Buscar",
  preferences: "Preferencias",
  appearance: "Apariencia",
  hyprland: "Hyprland",
  hyprland_schema: "Opciones (schema)",
  animations: "Animaciones",
  monitors: "Monitores",
  keybindings: "Atajos",
  "window-rules": "Reglas",
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
  query: string;
  onQueryChange: (q: string) => void;
  backendStatus: BackendStatus;
  onPick: (entry: SettingEntry) => void;
}

function filterSchemaBoost(entries: SettingEntry[], query: string, limit: number): SettingEntry[] {
  const ql = query.trim();
  if (!ql) return [];
  return entries
    .filter((e) => matchesAllSearchTerms(`${e.label} ${e.keywords} ${e.id}`, ql))
    .slice(0, limit);
}

const SearchResultsPage: FC<Props> = ({ query, onQueryChange, backendStatus, onPick }) => {
  const [schemaBoost, setSchemaBoost] = useState<SettingEntry[]>([]);

  useEffect(() => {
    if (backendStatus !== "ready") return;
    void loadSchemaSearchBoost().then(setSchemaBoost);
  }, [backendStatus]);

  const results = useMemo(() => {
    const primary = filterSettingsIndex(query, 48);
    const fromSchema = filterSchemaBoost(schemaBoost, query, 48);
    return mergeSearchEntries(primary, fromSchema, 80);
  }, [query, schemaBoost]);

  const grouped = useMemo(() => groupResultsByPage(results), [results]);

  return (
    <div style={PAGE_BASE}>
      <h1 style={PAGE_HEADING}>Resultados de búsqueda</h1>
      <p style={PAGE_NOTE}>
        Varias palabras: todas deben aparecer en el texto (estilo HyprMod). Mínimo 1 carácter para el
        índice estático; el schema sigue su longitud mínima en el panel dedicado.
      </p>
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar…"
        disabled={backendStatus !== "ready"}
        style={{
          width: "100%",
          maxWidth: 520,
          marginBottom: 16,
          padding: "10px 12px",
          borderRadius: 8,
          border: `1px solid ${ps.borderStrong}`,
          background: ps.surfaceInput,
          color: ps.textPrimary,
          fontSize: 14,
        }}
      />
      {results.length === 0 ? (
        <div style={{ color: ps.textMuted, fontSize: 14 }}>
          {query.trim() ? "Sin resultados." : "Escribe para buscar."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from(grouped.entries()).map(([page, items]) => (
            <div key={page} style={{ ...psCard, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: ps.textMuted, marginBottom: 8 }}>
                {PAGE_LABEL[page]}
              </div>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPick(item)}
                  className="ps-search-row"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                    padding: "8px 6px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    color: ps.textSecondary,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{item.label}</span>
                  {item.section && (
                    <span style={{ fontSize: 11, color: ps.textMuted }}>{item.section}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResultsPage;
