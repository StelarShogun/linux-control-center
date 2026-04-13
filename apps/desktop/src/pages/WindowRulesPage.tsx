import { useState, type FC } from "react";
import type { AppSettings, HyprlandWindowRule } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { saveSettings } from "../tauri/api";
import { PAGE_BASE, PAGE_HEADING, PAGE_NOTE } from "../layout/pageLayout";
import { ps } from "../theme/playstationDark";
import { psCard } from "../theme/componentStyles";

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
      <h1 style={PAGE_HEADING}>Reglas de ventana</h1>
      <p style={PAGE_NOTE}>
        Se exportan como <code>windowrulev2 = …</code>. «Sync desde sistema» importa{" "}
        <code>windowrulev2</code> y <code>windowrule</code> (v1) desde tu cadena de configs Hyprland.
      </p>
      {msg && (
        <p
          style={{
            ...PAGE_NOTE,
            color: msg.startsWith("Error") ? ps.dangerText : ps.successText,
          }}
        >
          {msg}
        </p>
      )}
      <div style={styles.toolbar}>
        <button
          type="button"
          className="ps-btn-secondary"
          onClick={() => {
            setDraft(emptyRule());
            setModal("add");
          }}
        >
          Añadir regla
        </button>
        <button
          type="button"
          className="ps-btn-primary"
          disabled={backendStatus !== "ready" || busy}
          onClick={() => void save()}
        >
          {busy ? "Guardando…" : "Guardar en la app"}
        </button>
      </div>
      {rules.length === 0 ? (
        <div style={styles.emptyPanel}>
          <p style={PAGE_NOTE}>No hay reglas en la app.</p>
          <p style={styles.noteMuted}>
            Usa «Sync desde sistema» para leer <code>windowrulev2</code> / <code>windowrule</code> desde tus
            archivos Hyprland.
          </p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Act.</th>
                <th style={styles.th}>Regla</th>
                <th style={styles.th}>Class</th>
                <th style={styles.th}>Title</th>
                <th style={styles.th}>Nota</th>
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
                  <td style={styles.tdMono}>
                    <input
                      style={styles.in}
                      value={r.description}
                      onChange={(e) => {
                        const next = [...rules];
                        next[idx] = { ...r, description: e.target.value };
                        setRules(next);
                      }}
                      placeholder="origen / nota"
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
              <button type="button" className="ps-btn-secondary" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="ps-btn-primary"
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
  page: {
    ...PAGE_BASE,
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  noteMuted: { fontSize: 12, color: ps.textDisabled, marginTop: 8, lineHeight: 1.5 },
  emptyPanel: {
    flex: 1,
    minHeight: 200,
    padding: 28,
    borderRadius: 12,
    border: `1px dashed ${ps.borderStrong}`,
    background: ps.surfacePanel,
  },
  tableWrap: { overflow: "auto", flex: 1, minHeight: 0, width: "100%" },
  toolbar: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" },
  btnDanger: {
    padding: "4px 10px",
    fontSize: 11,
    borderRadius: 3,
    border: `1px solid ${ps.dangerBorder}`,
    background: ps.dangerBg,
    color: ps.dangerText,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: {
    textAlign: "left",
    padding: 8,
    background: ps.surfaceInput,
    color: ps.textAccent,
    borderBottom: `1px solid ${ps.borderDefault}`,
  },
  td: { padding: 8, borderBottom: `1px solid ${ps.borderSubtle}`, verticalAlign: "middle" },
  tdMono: { padding: 8, borderBottom: `1px solid ${ps.borderSubtle}` },
  in: {
    width: "100%",
    minWidth: 80,
    padding: 4,
    background: ps.surfaceCode,
    border: `1px solid ${ps.borderStrong}`,
    borderRadius: 3,
    color: ps.textPrimary,
    fontFamily: "monospace",
    fontSize: 11,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    ...psCard,
    padding: 22,
    width: "min(420px, 92vw)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: 300, color: ps.textPrimary, margin: 0 },
  lab: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: ps.textMuted },
  inFull: {
    padding: 8,
    background: ps.surfaceInput,
    border: `1px solid ${ps.borderStrong}`,
    borderRadius: 3,
    color: ps.textPrimary,
    fontFamily: "inherit",
    fontSize: 13,
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 },
};

export default WindowRulesPage;
