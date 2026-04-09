use std::path::{Path, PathBuf};

use crate::{
    allowlist::{home_dir, MAX_CONTENT_BYTES},
    types::{HelperError, WriteRequest, WriteTarget},
};

/// Validación del request (sin I/O).
pub fn validate_write_request(req: &WriteRequest) -> Result<(), HelperError> {
    // HyprlandMainConfig está prohibido para overwrites completos.
    // La única vía permitida sobre el archivo principal es ensure_hyprland_main_sources_lcc_include().
    if matches!(req.target, WriteTarget::HyprlandMainConfig) {
        return Err(HelperError::HyprlandMainConfigWriteForbidden);
    }

    if req.content.is_empty() {
        return Err(HelperError::EmptyContent);
    }
    let size = req.content.as_bytes().len();
    if size > MAX_CONTENT_BYTES {
        return Err(HelperError::ContentTooLarge(size, MAX_CONTENT_BYTES));
    }
    Ok(())
}

/// Verifica que `target_path` esté confinado bajo HOME (mitigación anti-symlink).
///
/// Esta función es conservadora: para el scaffolding nos basta con asegurar
/// que el camino resuelto no escape de HOME.
pub fn check_path_confinement(target_path: &Path) -> Result<(), HelperError> {
    let home = home_dir()?;
    let resolved = resolve_for_confinement_check(target_path)?;
    if !resolved.starts_with(&home) {
        return Err(HelperError::PathConfinementViolation(resolved));
    }
    Ok(())
}

fn resolve_for_confinement_check(path: &Path) -> Result<PathBuf, HelperError> {
    // Si existe, canonicalize resuelve symlinks.
    if path.exists() {
        return Ok(path.canonicalize()?);
    }

    // Si no existe, canonicaliza el padre si existe.
    if let Some(parent) = path.parent() {
        if parent.exists() {
            let canon_parent = parent.canonicalize()?;
            let file = path.file_name().unwrap_or_default();
            return Ok(canon_parent.join(file));
        }
    }

    // Padre no existe: validación nominal.
    Ok(path.to_path_buf())
}

