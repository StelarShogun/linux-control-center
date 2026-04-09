//! Invocación fija del binario externo: `apply <abs_path>`, `current`, `--version`.
//!
//! Configuración: variable de entorno `LCC_WALLPAPER_APPLY_BIN` (ruta absoluta o nombre en `PATH`).
//! Si no está definida, se busca `lcc-wallpaper-helper` en `PATH`.

use std::path::{Path, PathBuf};
use std::process::Command;

use core_model::wallpaper::WallpaperBackendStatus;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AdapterError {
    #[error("wallpaper apply binary not found")]
    BinaryNotFound,

    #[error("apply failed (exit {0}): {1}")]
    ApplyFailed(i32, String),

    #[error("query failed: {0}")]
    QueryFailed(String),

    #[error("io: {0}")]
    Io(#[from] std::io::Error),
}

pub const DEFAULT_TIMEOUT_APPLY_MS: u64 = 30_000;
pub const DEFAULT_TIMEOUT_DETECT_MS: u64 = 5_000;

/// Abstrae `std::process::Command` para tests.
pub trait CommandRunner: Send + Sync {
    fn run(&self, bin: &Path, args: &[&str]) -> Result<(i32, String), AdapterError>;
}

/// Implementación por defecto.
pub struct StdCommandRunner;

impl CommandRunner for StdCommandRunner {
    fn run(&self, bin: &Path, args: &[&str]) -> Result<(i32, String), AdapterError> {
        let out = Command::new(bin).args(args).output()?;
        let code = out.status.code().unwrap_or(-1);
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let combined = if stderr.is_empty() {
            stdout
        } else if stdout.is_empty() {
            stderr
        } else {
            format!("{stdout}\n{stderr}")
        };
        Ok((code, combined))
    }
}

fn search_in_path(name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let full = dir.join(name);
        if full.is_file() {
            return Some(full);
        }
    }
    None
}

/// Resuelve el binario a usar.
pub fn resolve_apply_binary() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("LCC_WALLPAPER_APPLY_BIN") {
        let pb = PathBuf::from(p.trim());
        if pb.is_absolute() && pb.is_file() {
            return Some(pb);
        }
        let name = pb.file_name()?.to_str()?;
        return search_in_path(name);
    }
    search_in_path("lcc-wallpaper-helper")
}

/// Rechaza rutas con `..` y exige que exista.
pub fn validate_apply_binary(bin: &Path) -> Result<(), AdapterError> {
    let s = bin.to_string_lossy();
    if s.contains("..") {
        return Err(AdapterError::BinaryNotFound);
    }
    if !bin.is_file() {
        return Err(AdapterError::BinaryNotFound);
    }
    Ok(())
}

pub fn default_apply_bin_candidates() -> Vec<String> {
    vec![
        std::env::var("LCC_WALLPAPER_APPLY_BIN").unwrap_or_default(),
        "lcc-wallpaper-helper".into(),
    ]
    .into_iter()
    .filter(|s| !s.is_empty())
    .collect()
}

pub fn detect_backend(runner: &dyn CommandRunner) -> WallpaperBackendStatus {
    let Some(bin) = resolve_apply_binary() else {
        return WallpaperBackendStatus::NotInstalled;
    };
    if let Err(_) = validate_apply_binary(&bin) {
        return WallpaperBackendStatus::Misconfigured {
            reason: "resolved path is not a readable file".into(),
        };
    }
    match runner.run(&bin, &["--version"]) {
        Ok((0, out)) => WallpaperBackendStatus::Ready {
            detail: format!("{} ({})", bin.display(), out.lines().next().unwrap_or("ok")),
        },
        Ok((code, out)) => WallpaperBackendStatus::Misconfigured {
            reason: format!("--version exited {code}: {out}"),
        },
        Err(e) => WallpaperBackendStatus::Error {
            message: e.to_string(),
        },
    }
}

/// Aplica wallpaper: `apply <ruta_absoluta>`.
pub fn wallpaper_apply(runner: &dyn CommandRunner, abs_path: &Path) -> Result<String, AdapterError> {
    let bin = resolve_apply_binary().ok_or(AdapterError::BinaryNotFound)?;
    validate_apply_binary(&bin)?;
    let p = abs_path
        .to_str()
        .ok_or_else(|| AdapterError::ApplyFailed(-1, "invalid utf-8 path".into()))?;
    if !abs_path.is_absolute() {
        return Err(AdapterError::ApplyFailed(
            -1,
            "internal error: path must be absolute".into(),
        ));
    }
    let (code, msg) = runner.run(&bin, &["apply", p])?;
    if code == 0 {
        Ok(msg)
    } else {
        Err(AdapterError::ApplyFailed(code, msg))
    }
}

/// Lee línea actual del backend si existe subcomando `current`.
pub fn query_current_wallpaper(runner: &dyn CommandRunner) -> Result<Option<String>, AdapterError> {
    let Some(bin) = resolve_apply_binary() else {
        return Ok(None);
    };
    if validate_apply_binary(&bin).is_err() {
        return Ok(None);
    }
    let (code, msg) = runner.run(&bin, &["current"])?;
    if code != 0 {
        return Err(AdapterError::QueryFailed(format!("exit {code}: {msg}")));
    }
    let line = msg.lines().next().map(|s| s.trim().to_string());
    Ok(line.filter(|s| !s.is_empty()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_rejects_dotdot_in_path_string() {
        let p = PathBuf::from("/tmp/../etc/passwd");
        assert!(validate_apply_binary(&p).is_err());
    }
}
