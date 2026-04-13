//! IPC con Hyprland vía `hyprctl getoption` y `hyprctl keyword`.
//!
//! Patrón equivalente al de [HyprMod](https://github.com/BlueManCZ/hyprmod) (previsualización en vivo),
//! implementado aquí sin copiar código GPL: solo la interfaz pública de `hyprctl` documentada por Hyprland.

use std::process::Command;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum HyprctlIpcError {
    #[error("nombre de opción inválido")]
    InvalidOptionName,
    #[error("valor demasiado largo")]
    ValueTooLong,
    #[error("hyprctl no disponible: {0}")]
    Spawn(String),
    #[error("hyprctl falló: {0}")]
    Failed(String),
}

const OPTION_MAX: usize = 256;
const VALUE_MAX: usize = 8192;

fn validate_option(name: &str) -> Result<(), HyprctlIpcError> {
    if name.is_empty() || name.len() > OPTION_MAX {
        return Err(HyprctlIpcError::InvalidOptionName);
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || ":-_.".contains(c))
    {
        return Err(HyprctlIpcError::InvalidOptionName);
    }
    Ok(())
}

fn validate_value(value: &str) -> Result<(), HyprctlIpcError> {
    if value.len() > VALUE_MAX {
        return Err(HyprctlIpcError::ValueTooLong);
    }
    if value.chars().any(|c| c == '\n' || c == '\r') {
        return Err(HyprctlIpcError::ValueTooLong);
    }
    Ok(())
}

/// Salida textual de `hyprctl getoption <name>` (p. ej. líneas `int: 5` y `set: true`).
pub fn get_option(name: &str) -> Result<String, HyprctlIpcError> {
    validate_option(name)?;
    let out = Command::new("hyprctl")
        .args(["getoption", name])
        .output()
        .map_err(|e| HyprctlIpcError::Spawn(e.to_string()))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if out.status.success() {
        Ok(stdout)
    } else {
        let msg = if stderr.is_empty() {
            stdout
        } else {
            format!("{stdout}\n{stderr}")
        };
        Err(HyprctlIpcError::Failed(msg))
    }
}

/// Aplica en el compositor en ejecución: `hyprctl keyword <name> <value>` (sin tocar archivos).
pub fn set_keyword(name: &str, value: &str) -> Result<String, HyprctlIpcError> {
    validate_option(name)?;
    validate_value(value)?;
    let out = Command::new("hyprctl")
        .args(["keyword", name, value])
        .output()
        .map_err(|e| HyprctlIpcError::Spawn(e.to_string()))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if out.status.success() {
        Ok(if stdout.is_empty() { "ok".into() } else { stdout })
    } else {
        let msg = if stderr.is_empty() {
            stdout
        } else {
            format!("{stdout}\n{stderr}")
        };
        Err(HyprctlIpcError::Failed(msg))
    }
}

const BINDS_JSON_MAX_BYTES: usize = 16 * 1024 * 1024;

/// Lista de atajos activos: `hyprctl binds -j` (JSON array; requiere Hyprland reciente).
pub fn binds_json() -> Result<String, HyprctlIpcError> {
    let out = Command::new("hyprctl")
        .args(["binds", "-j"])
        .output()
        .map_err(|e| HyprctlIpcError::Spawn(e.to_string()))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if !out.status.success() {
        let msg = if stderr.is_empty() {
            stdout
        } else {
            format!("{stdout}\n{stderr}")
        };
        return Err(HyprctlIpcError::Failed(msg));
    }
    if stdout.len() > BINDS_JSON_MAX_BYTES {
        return Err(HyprctlIpcError::ValueTooLong);
    }
    Ok(stdout)
}

const MONITORS_JSON_MAX_BYTES: usize = 4 * 1024 * 1024;

const VERSION_JSON_MAX_BYTES: usize = 256 * 1024;

/// Metadatos del compositor: `hyprctl -j version` (JSON; requiere Hyprland en ejecución).
pub fn version_json() -> Result<String, HyprctlIpcError> {
    let out = Command::new("hyprctl")
        .args(["-j", "version"])
        .output()
        .map_err(|e| HyprctlIpcError::Spawn(e.to_string()))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if !out.status.success() {
        let msg = if stderr.is_empty() {
            stdout
        } else {
            format!("{stdout}\n{stderr}")
        };
        return Err(HyprctlIpcError::Failed(msg));
    }
    if stdout.len() > VERSION_JSON_MAX_BYTES {
        return Err(HyprctlIpcError::ValueTooLong);
    }
    Ok(stdout)
}

/// Estado de monitores: `hyprctl monitors -j`.
pub fn monitors_json() -> Result<String, HyprctlIpcError> {
    let out = Command::new("hyprctl")
        .args(["monitors", "-j"])
        .output()
        .map_err(|e| HyprctlIpcError::Spawn(e.to_string()))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if !out.status.success() {
        let msg = if stderr.is_empty() {
            stdout
        } else {
            format!("{stdout}\n{stderr}")
        };
        return Err(HyprctlIpcError::Failed(msg));
    }
    if stdout.len() > MONITORS_JSON_MAX_BYTES {
        return Err(HyprctlIpcError::ValueTooLong);
    }
    Ok(stdout)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_option_rejects_injection() {
        assert!(validate_option("general;rm").is_err());
        assert!(validate_option("general:gaps_in").is_ok());
    }
}
