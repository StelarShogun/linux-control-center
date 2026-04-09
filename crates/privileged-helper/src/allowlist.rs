use std::path::PathBuf;

use crate::types::{HelperError, WriteTarget};

/// Límite de tamaño para evitar contenido accidentalmente enorme.
pub const MAX_CONTENT_BYTES: usize = 1_048_576; // 1 MiB

/// Devuelve el HOME del usuario efectivo.
///
/// Nota: se prefiere `dirs::home_dir()` sobre leer `HOME` del entorno.
pub fn home_dir() -> Result<PathBuf, HelperError> {
    dirs::home_dir().ok_or(HelperError::HomeDirUnknown)
}

/// Resuelve un `WriteTarget` a una ruta concreta bajo `$HOME`.
///
/// Esta allowlist es cerrada y está compilada en el binario.
pub fn resolve_target_path(target: WriteTarget) -> Result<PathBuf, HelperError> {
    let home = home_dir()?;
    let rel = match target {
        WriteTarget::HyprlandGeneratedConfig => ".config/hypr/generated/linux-control-center.conf",
        WriteTarget::HyprlandMainConfig => ".config/hypr/hyprland.conf",
        WriteTarget::WaybarConfig => ".config/waybar/config.jsonc",
        WriteTarget::RofiConfig => ".config/rofi/config.rasi",
    };
    Ok(home.join(rel))
}

