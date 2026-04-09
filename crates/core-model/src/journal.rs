//! Entradas del Operation Journal (Fase C — observabilidad / forensics).

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Acción registrada en el journal (operaciones sensibles).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum JournalOperationAction {
    ApplySandbox,
    ApplyReal,
    ApplyLive,
    /// Write `config.jsonc` + `pkill -USR2 waybar` (Fase F).
    ApplyLiveWaybar,
    ApplyTheme,
    ApplyWallpaper,
    Rollback,
}

/// Una operación completada o fallida, persistida en `{app_data_dir}/journal/`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct OperationJournalEntry {
    pub operation_id: String,
    pub action: JournalOperationAction,
    /// Subsistema / destino legible (p. ej. `Hyprland`, `Waybar`, `HyprlandGeneratedConfig`).
    pub target: String,
    /// Inicio de la operación (RFC3339 UTC).
    pub started_at: String,
    /// Fin de la operación (RFC3339 UTC).
    pub finished_at: String,
    pub success: bool,
    pub snapshot_id: Option<String>,
    pub backup_file_name: Option<String>,
    /// Ruta absoluta del archivo escrito o restaurado cuando aplica.
    pub written_path: Option<String>,
    /// `apply_live` / `apply_live_waybar`: resultado del reload (`hyprctl` / `pkill -USR2 waybar`).
    pub reload_status: Option<bool>,
    /// Mensaje de error truncado si `success == false`; opcional en éxito con advertencias menores.
    pub error_summary: Option<String>,
}

/// Trunca texto para almacenamiento estable en disco.
pub fn truncate_journal_error(msg: &str, max_bytes: usize) -> String {
    if msg.len() <= max_bytes {
        return msg.to_string();
    }
    let mut end = max_bytes.min(msg.len());
    while end > 0 && !msg.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…", &msg[..end])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operation_journal_entry_toml_roundtrip() {
        let e = OperationJournalEntry {
            operation_id: "a1b2c3d4-e5f6-4789-abcd-ef0123456789".into(),
            action: JournalOperationAction::ApplyReal,
            target: "HyprlandGeneratedConfig".into(),
            started_at: "2026-04-09T12:00:00Z".into(),
            finished_at: "2026-04-09T12:00:01Z".into(),
            success: true,
            snapshot_id: Some("snap-1".into()),
            backup_file_name: Some("linux-control-center.conf.bak.x".into()),
            written_path: Some("/home/u/.config/hypr/generated/linux-control-center.conf".into()),
            reload_status: None,
            error_summary: None,
        };
        let toml = toml::to_string_pretty(&e).expect("serialize");
        let back: OperationJournalEntry = toml::from_str(&toml).expect("deserialize");
        assert_eq!(back, e);
    }

    #[test]
    fn truncate_journal_error_respects_utf8_boundary() {
        let s = "áááááá";
        let t = truncate_journal_error(s, 3);
        assert!(t.len() <= 4 || t.ends_with('…'));
    }
}
