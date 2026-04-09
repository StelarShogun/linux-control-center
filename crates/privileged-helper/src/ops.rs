//! Operaciones con efectos secundarios (I/O).

use std::fs;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::{
    allowlist::resolve_target_path,
    types::{HelperError, SandboxTarget, WriteRequest, WriteResult, WriteTarget},
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
    ensure_hyprland_main_sources_lcc_include_in_dir(&main_path)
}

/// Testable inner version: operates on `{hypr_dir}/hyprland.conf` directly.
pub fn ensure_hyprland_main_sources_lcc_include_at(hypr_dir: &Path) -> Result<bool, HelperError> {
    let main_path = hypr_dir.join("hyprland.conf");
    ensure_hyprland_main_sources_lcc_include_in_dir(&main_path)
}

fn ensure_hyprland_main_sources_lcc_include_in_dir(main_path: &Path) -> Result<bool, HelperError> {
    if !main_path.exists() {
        return Err(HelperError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("hyprland main config not found: {}", main_path.display()),
        )));
    }

    let existing = fs::read_to_string(main_path)?;
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
    let _backup = backup_existing(main_path)?;
    atomic_write(main_path, &next)?;
    Ok(true)
}

/// Marcador que indica que la app generó completamente el archivo principal en versiones antiguas.
const LEGACY_GENERATED_MARKER: &str = "Generated by Linux Control Center";

/// Inspecciona el estado del setup de Hyprland respecto al include gestionado.
///
/// Solo lectura, sin I/O destructivo.
pub fn inspect_hyprland_setup() -> Result<crate::types::HyprlandMigrationStatus, HelperError> {
    let main_path = resolve_target_path(crate::types::WriteTarget::HyprlandMainConfig)?;
    inspect_hyprland_setup_from_path(&main_path)
}

/// Testable inner version: operates on `{hypr_dir}/hyprland.conf` directly.
pub fn inspect_hyprland_setup_at(hypr_dir: &Path) -> Result<crate::types::HyprlandMigrationStatus, HelperError> {
    let main_path = hypr_dir.join("hyprland.conf");
    inspect_hyprland_setup_from_path(&main_path)
}

fn inspect_hyprland_setup_from_path(main_path: &Path) -> Result<crate::types::HyprlandMigrationStatus, HelperError> {
    use crate::types::{HyprlandMigrationStatus, HyprlandSetupState};

    let available_backups = list_hyprland_main_backups_inner(main_path);

    if !main_path.exists() {
        return Ok(HyprlandMigrationStatus {
            state: HyprlandSetupState::MainFileNotFound,
            main_config_exists: false,
            available_backups,
            can_auto_repair: false,
            warnings: vec![],
        });
    }

    // Verificar si la ruta es un symlink fuera de HOME.
    if main_path.is_symlink() {
        let resolved = main_path.canonicalize().unwrap_or_else(|_| main_path.to_path_buf());
        let home = crate::allowlist::home_dir().unwrap_or_default();
        if !resolved.starts_with(&home) {
            return Ok(HyprlandMigrationStatus {
                state: HyprlandSetupState::NonStandardSetup {
                    reason: format!(
                        "hyprland.conf is a symlink pointing outside HOME: {}",
                        resolved.display()
                    ),
                },
                main_config_exists: true,
                available_backups,
                can_auto_repair: false,
                warnings: vec![],
            });
        }
    }

    let content = match fs::read_to_string(main_path) {
        Ok(c) => c,
        Err(e) => {
            return Ok(HyprlandMigrationStatus {
                state: HyprlandSetupState::NonStandardSetup {
                    reason: format!("could not read hyprland.conf: {e}"),
                },
                main_config_exists: true,
                available_backups,
                can_auto_repair: false,
                warnings: vec![],
            });
        }
    };

    // M-3: instalación antigua sobrescribió el principal.
    if content.contains(LEGACY_GENERATED_MARKER) {
        return Ok(HyprlandMigrationStatus {
            state: HyprlandSetupState::LegacyGeneratedDetected,
            main_config_exists: true,
            available_backups,
            can_auto_repair: false,
            warnings: vec![
                "hyprland.conf appears to have been fully generated by an older version of Linux Control Center. Manual recovery is required.".into()
            ],
        });
    }

    // M-1: include gestionado ya está presente.
    if hyprland_main_contains_lcc_source(&content) {
        return Ok(HyprlandMigrationStatus {
            state: HyprlandSetupState::ManagedIncludePresent,
            main_config_exists: true,
            available_backups,
            can_auto_repair: false,
            warnings: vec![],
        });
    }

    // M-2: include ausente pero archivo existe y no parece generado por LCC.
    Ok(HyprlandMigrationStatus {
        state: HyprlandSetupState::ManagedIncludeAbsent,
        main_config_exists: true,
        available_backups,
        can_auto_repair: true,
        warnings: vec![],
    })
}

/// Lista los basenames de backups del archivo principal (`hyprland.conf.bak.*`),
/// ordenados por nombre descendente (más reciente primero).
pub fn list_hyprland_main_backups() -> Result<Vec<String>, HelperError> {
    let main_path = resolve_target_path(crate::types::WriteTarget::HyprlandMainConfig)?;
    Ok(list_hyprland_main_backups_inner(&main_path))
}

pub fn list_hyprland_main_backups_inner(main_path: &Path) -> Vec<String> {
    let dir = match main_path.parent() {
        Some(d) => d,
        None => return vec![],
    };
    let prefix = match main_path.file_name().and_then(|n| n.to_str()) {
        Some(n) => format!("{}.bak.", n),
        None => return vec![],
    };
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };
    let mut backups: Vec<String> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().into_string().ok()?;
            if name.starts_with(&prefix) && !name.ends_with(".tmp") {
                Some(name)
            } else {
                None
            }
        })
        .collect();
    backups.sort_by(|a, b| b.cmp(a)); // más reciente primero
    backups
}

/// Nombre del archivo gestionado bajo el directorio del target (prefijo de backups `.bak.`).
pub fn target_managed_file_name(target: WriteTarget) -> &'static str {
    match target {
        WriteTarget::HyprlandGeneratedConfig => "linux-control-center.conf",
        WriteTarget::HyprlandMainConfig => "hyprland.conf",
        WriteTarget::WaybarConfig => "config.jsonc",
        WriteTarget::WaybarStyle => "style.css",
        WriteTarget::RofiConfig => "config.rasi",
    }
}

/// Targets cuya carpeta se escanea en auditorías de backup (allowlist de escritura real).
pub const WRITE_TARGETS_WITH_DISK_BACKUPS: [WriteTarget; 5] = [
    WriteTarget::HyprlandGeneratedConfig,
    WriteTarget::HyprlandMainConfig,
    WriteTarget::WaybarConfig,
    WriteTarget::WaybarStyle,
    WriteTarget::RofiConfig,
];

fn list_backup_basenames_in_parent(
    parent: &Path,
    managed_file_name: &str,
) -> Result<Vec<String>, HelperError> {
    let prefix = format!("{}.bak.", managed_file_name);
    let mut out = Vec::new();
    if !parent.is_dir() {
        return Ok(out);
    }
    for e in fs::read_dir(parent)? {
        let e = e?;
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with(&prefix) && !name.ends_with(".tmp") {
            out.push(name);
        }
    }
    out.sort();
    Ok(out)
}

/// Lista basenames `*.bak.*` junto al archivo gestionado del target (solo lectura).
pub fn list_disk_backups_for_target(target: WriteTarget) -> Result<Vec<String>, HelperError> {
    let path = resolve_target_path(target)?;
    let parent = path.parent().ok_or_else(|| {
        HelperError::InvalidBackupName("resolved target path has no parent directory".into())
    })?;
    list_backup_basenames_in_parent(parent, target_managed_file_name(target))
}

/// Deduce el `WriteTarget` a partir del basename de un backup con convención LCC.
pub fn write_target_for_backup_basename(basename: &str) -> Option<WriteTarget> {
    for t in WRITE_TARGETS_WITH_DISK_BACKUPS {
        let stem = target_managed_file_name(t);
        let prefix = format!("{}.bak.", stem);
        if basename.starts_with(&prefix) {
            return Some(t);
        }
    }
    None
}

/// Si existe un archivo con ese basename como hermano de algún target allowlist, devuelve ese target.
pub fn resolve_target_if_backup_file_exists(basename: &str) -> Option<WriteTarget> {
    for t in WRITE_TARGETS_WITH_DISK_BACKUPS {
        let path = resolve_target_path(t).ok()?;
        let parent = path.parent()?;
        if parent.join(basename).is_file() {
            return Some(t);
        }
    }
    None
}

#[cfg(test)]
mod backup_audit_tests {
    use super::*;

    #[test]
    fn list_backup_basenames_filters_by_prefix() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(
            tmp.path().join("config.jsonc.bak.abc-def"),
            "old",
        )
        .unwrap();
        fs::write(tmp.path().join("config.jsonc"), "new").unwrap();
        fs::write(tmp.path().join("noise.txt"), "x").unwrap();
        let v = list_backup_basenames_in_parent(tmp.path(), "config.jsonc").unwrap();
        assert_eq!(v, vec!["config.jsonc.bak.abc-def".to_string()]);
    }
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

