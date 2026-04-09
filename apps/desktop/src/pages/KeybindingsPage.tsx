import { useState, type FC } from "react";
import type { AppSettings, HyprlandBind } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { saveSettings } from "../tauri/api";

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
}

const emptyBind = (): HyprlandBind => ({
  modifiers: ["SUPER"],
  key: "",
  dispatcher: "exec",
  args: "",
  description: "",
  enabled: true,
});

const KeybindingsPage: FC<Props> = ({ settings, onSettingsChange, backendStatus }) => {
  const binds = settings.hyprland.keyboard.binds;
  const [modal, setModal] = useState<"add" | null>(null);
  const [draft, setDraft] = useState<HyprlandBind>(emptyBind);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const setBinds = (next: HyprlandBind[]) => {
    onSettingsChange({
      ...settings,
      hyprland: {
        ...settings.hyprland,
        keyboard: { binds: next },
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
      <h1 style={styles.heading}>Atajos (Hyprland)</h1>
      <p style={styles.note}>
        Se exportan como <code>bind = …</code> en el include gestionado. Modificadores separados por espacio
        (p. ej. SUPER SHIFT).
      </p>
      {msg && (
        <p style={{ ...styles.note, color: msg.startsWith("Error") ? "#f87171" : "#4ade80" }}>{msg}</p>
      )}
      <div style={styles.toolbar}>
        <button type="button" style={styles.btn} onClick={() => { setDraft(emptyBind()); setModal("add"); }}>
          Añadir atajo
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
      {binds.length === 0 ? (
        <p style={styles.note}>No hay atajos definidos.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Act.</th>
                <th style={styles.th}>Mods</th>
                <th style={styles.th}>Tecla</th>
                <th style={styles.th}>Dispatcher</th>
                <th style={styles.th}>Args</th>
                <th style={styles.th} />
              </tr>
            </thead>
            <tbody>
              {binds.map((b, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>
                    <input
                      type="checkbox"
                      checked={b.enabled}
                      onChange={(e) => {
                        const next = [...binds];
                        next[idx] = { ...b, enabled: e.target.checked };
                        setBinds(next);
                      }}
                    />
                  </td>
                  <td style={styles.tdMono}>
                    <input
                      style={styles.in}
                      value={b.modifiers.join(" ")}
                      onChange={(e) => {
                        const mods = e.target.value.split(/\s+/).filter(Boolean);
                        const next = [...binds];
                        next[idx] = { ...b, modifiers: mods.length > 0 ? mods : ["SUPER"] };
                        setBinds(next);
                      }}
                    />
                  </td>
                  <td style={styles.tdMono}>
                    <input
                      style={styles.in}
                      value={b.key}
                      onChange={(e) => {
                        const next = [...binds];
                        next[idx] = { ...b, key: e.target.value };
                        setBinds(next);
                      }}
                    />
                  </td>
                  <td style={styles.tdMono}>
                    <input
                      style={styles.in}
                      value={b.dispatcher}
                      onChange={(e) => {
                        const next = [...binds];
                        next[idx] = { ...b, dispatcher: e.target.value };
                        setBinds(next);
                      }}
                    />
                  </td>
                  <td style={styles.tdMono}>
                    <input
                      style={styles.in}
                      value={b.args}
                      onChange={(e) => {
                        const next = [...binds];
                        next[idx] = { ...b, args: e.target.value };
                        setBinds(next);
                      }}
                    />
                  </td>
                  <td style={styles.td}>
                    <button
                      type="button"
                      style={styles.btnDanger}
                      onClick={() => setBinds(binds.filter((_, i) => i !== idx))}
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
            <h2 style={styles.modalTitle}>Nuevo atajo</h2>
            <label style={styles.lab}>
              Modificadores (espacio)
              <input
                style={styles.inFull}
                value={draft.modifiers.join(" ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    modifiers: e.target.value.split(/\s+/).filter(Boolean) || ["SUPER"],
                  })
                }
              />
            </label>
            <label style={styles.lab}>
              Tecla
              <input
                style={styles.inFull}
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              />
            </label>
            <label style={styles.lab}>
              Dispatcher
              <input
                style={styles.inFull}
                value={draft.dispatcher}
                onChange={(e) => setDraft({ ...draft, dispatcher: e.target.value })}
              />
            </label>
            <label style={styles.lab}>
              Argumentos
              <input
                style={styles.inFull}
                value={draft.args}
                onChange={(e) => setDraft({ ...draft, args: e.target.value })}
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
                  setBinds([...binds, draft]);
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

export default KeybindingsPage;
