//! Operaciones con efectos secundarios (I/O).

use std::fs;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::{
    allowlist::resolve_target_path,
    types::{HelperError, SandboxTarget, WriteRequest, WriteResult},
    validate::{check_path_confinement, validate_write_request},
};

const HYPRLAND_LCC_INCLUDE_REL: &str = "generated/linux-control-center.conf";

/// Nombre máximo para un `backup_file_name` (basename sin ruta).
pub const MAX_BACKUP_NAME_LEN: usize = 256;

/// Genera un sufijo de backup único: `YYYYMMDDTHHMMSS{micros}Z-{uuid4}`.
///
/// Ejemplo: `20260409T051230123456Z-550e8400-e29b-41d4-a716-446655440000`
fn backup_suffix() -> String {
    use time::format_description::FormatItem;
    use time::macros::format_description;

    const FMT: &[FormatItem<'_>] =
        format_description!("[year][month][day]T[hour][minute][second]");

    let now = time::OffsetDateTime::now_utc();
    let micros = now.microsecond();
    let date_part = now.format(FMT).unwrap_or_else(|_| "19700101T000000".to_string());
    format!("{}{:06}Z-{}", date_part, micros, Uuid::new_v4())
}

/// Copia el archivo existente a `{path}.bak.{suffix}` antes de sobrescribirlo.
///
/// - Si el archivo no existe devuelve `Ok(None)`.
/// - Usa `fs::copy` (no `rename`) para no dejar el destino vacío si falla.
/// - La copia se hace a un `.bak.{suffix}.tmp` primero para evitar backups parciales.
/// - El sufijo incluye timestamp de microsegundos + UUID v4 para garantizar unicidad.
pub fn backup_existing(path: &Path) -> Result<Option<PathBuf>, HelperError> {
    if !path.exists() {
        return Ok(None);
    }
    let suffix = backup_suffix();
    let backup = PathBuf::from(format!("{}.bak.{}", path.display(), suffix));
    let tmp = PathBuf::from(format!("{}.bak.{}.tmp", path.display(), suffix));
    fs::copy(path, &tmp)?;
    fs::rename(&tmp, &backup)?;
    Ok(Some(backup))
}

/// Valida que `backup_file_name` sea un basename seguro derivado del `target_file_name`.
///
/// Reglas:
/// - Solo basename (sin `/` ni `\`).
/// - Debe empezar exactamente con `"{target_file_name}.bak."`.
/// - No puede ser igual al propio `target_file_name`.
/// - No puede terminar en `.tmp`.
/// - Longitud ≤ `MAX_BACKUP_NAME_LEN`.
pub fn validate_backup_file_name(
    backup_file_name: &str,
    target_file_name: &str,
) -> Result<(), HelperError> {
    if backup_file_name.len() > MAX_BACKUP_NAME_LEN {
        return Err(HelperError::InvalidBackupName(
            "name exceeds maximum length".into(),
        ));
    }
    if backup_file_name.contains('/') || backup_file_name.contains('\\') {
        return Err(HelperError::InvalidBackupName(
            "name must be a plain filename without path separators".into(),
        ));
    }
    if backup_file_name.contains('\0') {
        return Err(HelperError::InvalidBackupName("null byte in name".into()));
    }
    let required_prefix = format!("{}.bak.", target_file_name);
    if !backup_file_name.starts_with(&required_prefix) {
        return Err(HelperError::InvalidBackupName(format!(
            "name must start with '{required_prefix}'"
        )));
    }
    if backup_file_name == target_file_name {
        return Err(HelperError::InvalidBackupName(
            "backup name cannot equal target name".into(),
        ));
    }
    if backup_file_name.ends_with(".tmp") {
        return Err(HelperError::InvalidBackupName(
            "name must not end with .tmp".into(),
        ));
    }
    Ok(())
}


/// Ejecuta una escritura real a la ruta destino ya resuelta y verificada.
///
/// Esta función es separada de `execute_write` para permitir tests con `tempdir`
/// sin depender de `dirs::home_dir()`.
pub fn execute_write_inner(
    target_path: &Path,
    content: &str,
) -> Result<WriteResult, HelperError> {
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let backup = backup_existing(target_path)?;
    atomic_write(target_path, content)?;
    Ok(WriteResult {
        target_path: target_path.to_string_lossy().into_owned(),
        backup_path: backup.map(|p| p.to_string_lossy().into_owned()),
    })
}

/// Punto de entrada público: valida, resuelve allowlist, confina y escribe.
pub fn execute_write(req: WriteRequest) -> Result<WriteResult, HelperError> {
    validate_write_request(&req)?;
    let target_path = resolve_target_path(req.target)?;
    check_path_confinement(&target_path)?;
    execute_write_inner(&target_path, &req.content)
}

/// Restaura un archivo desde su backup identificado por **basename** (`backup_file_name`).
///
/// # Contrato de seguridad
/// - El frontend solo envía `backup_file_name` (basename sin `/`), nunca una ruta completa.
/// - El backend reconstruye la ruta como `target_path.parent() / backup_file_name`.
/// - Se valida que el nombre pertenezca al target (`starts_with "{target_file}.bak."`).
/// - Ambas rutas finales se comprueban bajo HOME.
pub fn restore_from_backup(
    target_path: &Path,
    backup_file_name: &str,
) -> Result<(), HelperError> {
    // Validar que el basename sea seguro y corresponda al target.
    let target_file_name = target_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| HelperError::InvalidBackupName("target has no file name".into()))?;

    validate_backup_file_name(backup_file_name, target_file_name)?;

    // Reconstruir la ruta del backup como sibling del target.
    let parent = target_path
        .parent()
        .ok_or_else(|| HelperError::InvalidBackupName("target has no parent directory".into()))?;
    let backup_path = parent.join(backup_file_name);

    // Ambas rutas deben estar bajo HOME.
    check_path_confinement(target_path)?;
    check_path_confinement(&backup_path)?;

    // El backup debe existir y ser archivo regular.
    if !backup_path.is_file() {
        return Err(HelperError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("backup not found or is not a regular file: {}", backup_path.display()),
        )));
    }

    let content = fs::read_to_string(&backup_path)?;
    if let Some(p) = target_path.parent() {
        fs::create_dir_all(p)?;
    }
    atomic_write(target_path, &content)?;
    Ok(())
}

fn atomic_write(path: &Path, content: &str) -> Result<(), HelperError> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

/// Returns true if `hyprland.conf` already sources our managed include.
///
/// No parser and no regex: we treat any non-comment line containing the relative include path
/// as a match (covers `source = ./generated/...`, `source = ~/.config/hypr/generated/...`, etc).
fn hyprland_main_contains_lcc_source(content: &str) -> bool {
    content.lines().any(|line| {
        let t = line.trim();
        if t.is_empty() || t.starts_with('#') {
            return false;
        }
        t.contains(HYPRLAND_LCC_INCLUDE_REL)
    })
}

/// Ensures `~/.config/hypr/hyprland.conf` sources `generated/linux-control-center.conf`.
///
/// - Never replaces the file with generated content. If insertion is needed, appends lines to
///   the end (idempotent, avoids touching existing includes like HyDE/JaKooLit).
/// - Creates a backup of the main file before modifying it (same mechanism as other writes).
pub fn ensure_hyprland_main_sources_lcc_include() -> Result<bool, HelperError> {
    use crate::types::WriteTarget;

    let main_path = resolve_target_path(WriteTarget::HyprlandMainConfig)?;
    check_path_confinement(&main_path)?;

    if !main_path.exists() {
        return Err(HelperError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("hyprland main config not found: {}", main_path.display()),
        )));
    }

    let existing = fs::read_to_string(&main_path)?;
    if hyprland_main_contains_lcc_source(&existing) {
        return Ok(false);
    }

    // Use a path relative to the hyprland config directory so the config
    // remains portable if the user's home is renamed or moved.
    let source_line = format!("source = ./{}\n", HYPRLAND_LCC_INCLUDE_REL);

    let mut next = existing;
    if !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str("\n# Added by Linux Control Center — managed include\n");
    next.push_str(&source_line);

    // Backup then atomic write full content (preserves all existing includes & structure).
    let _backup = backup_existing(&main_path)?;
    atomic_write(&main_path, &next)?;
    Ok(true)
}

fn sandbox_filename(target: SandboxTarget) -> &'static str {
    match target {
        SandboxTarget::Hyprland => "hyprland.conf",
        SandboxTarget::Waybar => "config.jsonc",
        SandboxTarget::Rofi => "config.rasi",
    }
}

/// Ejecuta una escritura **real** pero **solo en sandbox**:
/// `{app_data_dir}/exported/{target_file}`.
///
/// - No toca `~/.config`
/// - Sin backups en esta fase
pub fn execute_write_sandbox(
    data_dir: &Path,
    target: SandboxTarget,
    content: String,
) -> Result<WriteResult, HelperError> {
    // Reutilizamos límites del helper (no permite contenido vacío / enorme).
    if content.is_empty() {
        return Err(HelperError::EmptyContent);
    }
    let size = content.as_bytes().len();
    if size > crate::allowlist::MAX_CONTENT_BYTES {
        return Err(HelperError::ContentTooLarge(size, crate::allowlist::MAX_CONTENT_BYTES));
    }

    let exported_dir = data_dir.join("exported");
    fs::create_dir_all(&exported_dir)?;
    let target_path = exported_dir.join(sandbox_filename(target));
    atomic_write(&target_path, &content)?;

    Ok(WriteResult {
        target_path: target_path.to_string_lossy().to_string(),
        backup_path: None,
    })
}

