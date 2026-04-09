import { useState, type FC } from "react";
import type { AppSettings, HyprlandWindowRule } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { saveSettings } from "../tauri/api";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

const emptyRule = (): HyprlandWindowRule => ({
  rule: "float",
  class: "",
  title: "",
  description: "",
  enabled: true,
});

const WindowRulesPage: FC<Props> = ({ settings, onSettingsChange, backendStatus }) => {
  const rules = settings.hyprland.windows.rules;
  const [modal, setModal] = useState<"add" | null>(null);
  const [draft, setDraft] = useState<HyprlandWindowRule>(emptyRule());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const setRules = (next: HyprlandWindowRule[]) => {
    onSettingsChange({
      ...settings,
      hyprland: {
        ...settings.hyprland,
        windows: { rules: next },
      },
    });
  };

  const save = async () => {
    if (backendStatus !== "ready") return;
    setBusy(true);
    setMsg(null);
    try {
      const s = await saveSettings({ settings });
      onSettingsChange(s);
      setMsg("Guardado.");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Reglas de ventana</h1>
      <p style={styles.note}>
        Se exportan como <code>windowrulev2 = regla, class:…, title:…</code>. La clase/título suelen ser
        expresiones como <code>^(kitty)$</code>.
      </p>
      {msg && (
        <p style={{ ...styles.note, color: msg.startsWith("Error") ? "#f87171" : "#4ade80" }}>{msg}</p>
      )}
      <div style={styles.toolbar}>
        <button type="button" style={styles.btn} onClick={() => { setDraft(emptyRule()); setModal("add"); }}>
          Añadir regla
        </button>
        <button
          type="button"
          style={styles.btnPrimary}
          disabled={backendStatus !== "ready" || busy}
          onClick={() => void save()}
        >
          {busy ? "Guardando…" : "Guardar en la app"}
        </button>
      </div>
      {rules.length === 0 ? (
        <p style={styles.note}>No hay reglas.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Act.</th>
                <th style={styles.th}>Regla</th>
                <th style={styles.th}>Class</th>
                <th style={styles.th}>Title</th>
                <th style={styles.th} />
              </tr>
            </thead>
            <tbody>
              {rules.map((r, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => {
                        const next = [...rules];
                        next[idx] = { ...r, enabled: e.target.checked };
                        setRules(next);
                      }}
                    />
                  </td>
                  <td style={styles.tdMono}>
                    <input
                      style={styles.in}
                      value={r.rule}
                      onChange={(e) => {
                        const next = [...rules];
                        next[idx] = { ...r, rule: e.target.value };
                        setRules(next);
                      }}
                    />
                  </td>
                  <td style={styles.tdMono}>
                    <input
                      style={styles.in}
                      value={r.class}
                      onChange={(e) => {
                        const next = [...rules];
                        next[idx] = { ...r, class: e.target.value };
                        setRules(next);
                      }}
                    />
                  </td>
                  <td style={styles.tdMono}>
                    <input
                      style={styles.in}
                      value={r.title}
                      onChange={(e) => {
                        const next = [...rules];
                        next[idx] = { ...r, title: e.target.value };
                        setRules(next);
                      }}
                    />
                  </td>
                  <td style={styles.td}>
                    <button
                      type="button"
                      style={styles.btnDanger}
                      onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal === "add" && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Nueva regla</h2>
            <label style={styles.lab}>
              Regla (p. ej. float, opacity)
              <input
                style={styles.inFull}
                value={draft.rule}
                onChange={(e) => setDraft({ ...draft, rule: e.target.value })}
              />
            </label>
            <label style={styles.lab}>
              Class (opcional)
              <input
                style={styles.inFull}
                value={draft.class}
                onChange={(e) => setDraft({ ...draft, class: e.target.value })}
              />
            </label>
            <label style={styles.lab}>
              Title (opcional)
              <input
                style={styles.inFull}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <div style={styles.modalActions}>
              <button type="button" style={styles.btn} onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={() => {
                  setRules([...rules, draft]);
                  setModal(null);
                }}
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "32px 40px", maxWidth: "100%" },
  heading: { fontSize: 22, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 16 },
  toolbar: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  btn: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid #3d4466",
    background: "#252840",
    color: "#a0aec0",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  },
  btnPrimary: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid #3d5a50",
    background: "#15201c",
    color: "#86efac",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  },
  btnDanger: {
    padding: "4px 8px",
    fontSize: 11,
    borderRadius: 4,
    border: "1px solid #5a3030",
    background: "#221010",
    color: "#fca5a5",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: {
    textAlign: "left",
    padding: 8,
    background: "#1e2030",
    color: "#88c0d0",
    borderBottom: "1px solid #2e3250",
  },
  td: { padding: 8, borderBottom: "1px solid #252840", verticalAlign: "middle" },
  tdMono: { padding: 8, borderBottom: "1px solid #252840" },
  in: {
    width: "100%",
    minWidth: 80,
    padding: 4,
    background: "#151722",
    border: "1px solid #3d4466",
    borderRadius: 4,
    color: "#e2e8f0",
    fontFamily: "monospace",
    fontSize: 11,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    background: "#1a1c28",
    border: "1px solid #2e3250",
    borderRadius: 10,
    padding: 20,
    width: "min(420px, 92vw)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  modalTitle: { fontSize: 16, color: "#e2e8f0", margin: 0 },
  lab: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#9ca3af" },
  inFull: {
    padding: 8,
    background: "#151722",
    border: "1px solid #3d4466",
    borderRadius: 6,
    color: "#e2e8f0",
    fontFamily: "inherit",
    fontSize: 13,
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 },
};

export default WindowRulesPage;
