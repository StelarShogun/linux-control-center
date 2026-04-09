use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Destino de escritura — allowlist cerrada (sin rutas arbitrarias).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum WriteTarget {
    /// Archivo managed por Linux Control Center (NO es el orquestador principal).
    /// `~/.config/hypr/generated/linux-control-center.conf`
    HyprlandGeneratedConfig,
    /// Archivo principal de Hyprland (orquestador). **Nunca** debe sobrescribirse completo
    /// por la app; solo se permite insertar (idempotentemente) un `source = ...` si falta.
    /// `~/.config/hypr/hyprland.conf`
    HyprlandMainConfig,
    WaybarConfig,
    RofiConfig,
}

/// Targets de sandbox: **solo** bajo `{app_data_dir}/exported/`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum SandboxTarget {
    Hyprland,
    Waybar,
    Rofi,
}

/// Solicitud de escritura.
///
/// `content` debe ser generado por un adapter (no input directo arbitrario).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WriteRequest {
    pub target: WriteTarget,
    pub content: String,
}

/// Resultado de una escritura exitosa.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WriteResult {
    /// Ruta absoluta del archivo escrito.
    pub target_path: String,
    /// En sandbox siempre es `None` (no hay backups en esta fase).
    pub backup_path: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum HelperError {
    #[error("empty content is not allowed")]
    EmptyContent,

    #[error("content exceeds size limit ({0} bytes > {1} bytes)")]
    ContentTooLarge(usize, usize),

    #[error("resolved path is not under HOME: {0}")]
    PathConfinementViolation(std::path::PathBuf),

    #[error("home directory could not be determined")]
    HomeDirUnknown,

    #[error("invalid backup file name: {0}")]
    InvalidBackupName(String),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

