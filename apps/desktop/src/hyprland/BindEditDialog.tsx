import { useEffect, useMemo, useState, type CSSProperties, type FC } from "react";
import type { HyprlandBind } from "../types/settings";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";
import {
  BIND_TYPES,
  DIALOG_CATEGORIES,
  DISPATCHER_INFO,
  type DispatcherCategory,
} from "./dispatchers";

const WORKSPACE_CHOICES: [string, string][] = [
  ["1", "1"],
  ["2", "2"],
  ["+1", "Siguiente"],
  ["-1", "Anterior"],
  ["empty", "Primero vacío"],
  ["special", "Scratchpad"],
];

const FULLSCREEN_MODES: [string, string][] = [
  ["0", "Completo"],
  ["1", "Maximizar"],
  ["2", "Sin gaps"],
];

const DIRECTIONS: [string, string][] = [
  ["l", "Izquierda"],
  ["d", "Abajo"],
  ["u", "Arriba"],
  ["r", "Derecha"],
];

const DPMS_CHOICES: [string, string][] = [
  ["on", "On"],
  ["off", "Off"],
  ["toggle", "Alternar"],
];

const GROUP_DIR: [string, string][] = [
  ["f", "Adelante"],
  ["b", "Atrás"],
];

function categorizeForDispatcher(d: string): string {
  const info = DISPATCHER_INFO[d];
  return info ? info.category_id : "apps";
}

interface Props {
  title: string;
  initial: HyprlandBind;
  open: boolean;
  onClose: () => void;
  onSave: (b: HyprlandBind) => void;
}

const fieldIn: CSSProperties = {
  padding: 8,
  background: ps.surfaceInput,
  border: `1px solid ${ps.borderStrong}`,
  borderRadius: 3,
  color: ps.textPrimary,
  fontFamily: "inherit",
  fontSize: 13,
};

const ArgWidget: FC<{
  argType: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ argType, value, onChange }) => {
  switch (argType) {
    case "none":
      return <span style={{ fontSize: 12, color: ps.textMuted }}>Sin argumento</span>;
    case "fullscreen_mode":
      return (
        <select
          style={fieldIn}
          value={value || "0"}
          onChange={(e) => onChange(e.target.value)}
        >
          {FULLSCREEN_MODES.map(([v, lab]) => (
            <option key={v} value={v}>
              {lab}
            </option>
          ))}
        </select>
      );
    case "workspace":
      return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            style={fieldIn}
            value={WORKSPACE_CHOICES.some(([v]) => v === value) ? value : "__custom__"}
            onChange={(e) => {
              if (e.target.value === "__custom__") onChange("");
              else onChange(e.target.value);
            }}
          >
            <option value="__custom__">Personalizado…</option>
            {WORKSPACE_CHOICES.map(([v, lab]) => (
              <option key={v} value={v}>
                {lab}
              </option>
            ))}
          </select>
          <input
            style={{ ...fieldIn, flex: 1, minWidth: 120 }}
            placeholder="p. ej. 3 o name:foo"
            value={WORKSPACE_CHOICES.some(([v]) => v === value) ? "" : value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "direction":
      return (
        <select style={fieldIn} value={value || "l"} onChange={(e) => onChange(e.target.value)}>
          {DIRECTIONS.map(([v, lab]) => (
            <option key={v} value={v}>
              {lab}
            </option>
          ))}
        </select>
      );
    case "group_dir":
      return (
        <select style={fieldIn} value={value || "f"} onChange={(e) => onChange(e.target.value)}>
          {GROUP_DIR.map(([v, lab]) => (
            <option key={v} value={v}>
              {lab}
            </option>
          ))}
        </select>
      );
    case "dpms":
      return (
        <select style={fieldIn} value={value || "toggle"} onChange={(e) => onChange(e.target.value)}>
          {DPMS_CHOICES.map(([v, lab]) => (
            <option key={v} value={v}>
              {lab}
            </option>
          ))}
        </select>
      );
    case "optional_text":
      return (
        <input
          style={fieldIn}
          placeholder="Opcional"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <input
          style={fieldIn}
          placeholder="Argumento"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
};

export const BindEditDialog: FC<Props> = ({ title, initial, open, onClose, onSave }) => {
  const [draft, setDraft] = useState<HyprlandBind>(initial);
  const [catId, setCatId] = useState(() => categorizeForDispatcher(initial.dispatcher));

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setCatId(categorizeForDispatcher(initial.dispatcher));
    }
  }, [open, initial]);

  const category = DIALOG_CATEGORIES.find((c) => c.id === catId) ?? DIALOG_CATEGORIES[0]!;

  const dispatchersInCat = useMemo(() => {
    const keys = Object.keys(category.dispatchers);
    if (draft.dispatcher && !keys.includes(draft.dispatcher)) {
      return [draft.dispatcher, ...keys];
    }
    return keys;
  }, [category, draft.dispatcher]);

  const dInfo = DISPATCHER_INFO[draft.dispatcher];
  const argType = dInfo?.arg_type ?? "text";

  const onPickCategory = (id: string) => {
    setCatId(id);
    const cat = DIALOG_CATEGORIES.find((c) => c.id === id);
    const first = cat && Object.keys(cat.dispatchers)[0];
    if (first) {
      setDraft((d) => ({
        ...d,
        dispatcher: first,
        args: "",
      }));
    }
  };

  const onPickDispatcher = (disp: string) => {
    setDraft((d) => ({
      ...d,
      dispatcher: disp,
      args: "",
    }));
  };

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={{ ...psCard, ...modalBox }}>
        <h2 style={{ fontSize: 18, fontWeight: 300, color: ps.textPrimary, margin: 0 }}>{title}</h2>
        <label style={lab}>
          Tipo de bind
          <select
            style={fieldIn}
            value={draft.bind_type || "bind"}
            onChange={(e) => setDraft((d) => ({ ...d, bind_type: e.target.value }))}
          >
            {Object.entries(BIND_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {k} — {v.label}
              </option>
            ))}
          </select>
        </label>
        <label style={lab}>
          Categoría
          <select style={fieldIn} value={catId} onChange={(e) => onPickCategory(e.target.value)}>
            {DIALOG_CATEGORIES.map((c: DispatcherCategory) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label style={lab}>
          Dispatcher
          <select
            style={fieldIn}
            value={dispatchersInCat.includes(draft.dispatcher) ? draft.dispatcher : dispatchersInCat[0]!}
            onChange={(e) => onPickDispatcher(e.target.value)}
          >
            {dispatchersInCat.map((d) => (
              <option key={d} value={d}>
                {category.dispatchers[d]?.label ?? DISPATCHER_INFO[d]?.label ?? d}
              </option>
            ))}
          </select>
          <input
            style={{ ...fieldIn, marginTop: 6 }}
            placeholder="Nombre exacto del dispatcher (hyprctl)"
            value={draft.dispatcher}
            onChange={(e) => setDraft((d) => ({ ...d, dispatcher: e.target.value }))}
          />
        </label>
        <label style={lab}>
          Modificadores (separados por espacio)
          <input
            style={fieldIn}
            value={draft.modifiers.join(" ")}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                modifiers: e.target.value.split(/\s+/).filter(Boolean) || ["SUPER"],
              }))
            }
          />
        </label>
        <label style={lab}>
          Tecla
          <input
            style={fieldIn}
            value={draft.key}
            onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
          />
        </label>
        <label style={lab}>
          Argumento
          <ArgWidget
            argType={argType}
            value={draft.args}
            onChange={(v) => setDraft((d) => ({ ...d, args: v }))}
          />
        </label>
        {(draft.bind_type === "bindd" || draft.bind_type === "binddr") && (
          <label style={lab}>
            Descripción (bindd)
            <input
              style={fieldIn}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </label>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button type="button" className="ps-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="ps-btn-primary" onClick={() => onSave(draft)}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
};

const modalBox: CSSProperties = {
  padding: 22,
  width: "min(480px, 92vw)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const lab: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  color: ps.textMuted,
};
