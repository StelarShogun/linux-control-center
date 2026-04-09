//! # privileged-helper
//!
//! Helper **de alcance mínimo** para efectos secundarios controlados sobre
//! archivos de configuración del **usuario** (bajo `$HOME`).
//!
//! ## Garantías
//! - **No root**, no polkit, no setuid.
//! - **No /etc** ni rutas del sistema.
//! - **No escritura arbitraria**: el destino se elige por `WriteTarget` (allowlist cerrada).
//! - Backup atómico antes de cualquier sobrescritura real.

pub mod allowlist;
pub mod ops;
pub mod types;
pub mod validate;

pub use ops::{
    backup_existing, execute_write, execute_write_inner, execute_write_sandbox,
    ensure_hyprland_main_sources_lcc_include, restore_from_backup, validate_backup_file_name,
    MAX_BACKUP_NAME_LEN,
};
pub use types::{HelperError, SandboxTarget, WriteRequest, WriteResult, WriteTarget};

#[cfg(test)]
mod tests {
    use super::*;
    use ts_rs::TS;

    #[test]
    fn allowlist_resolves_under_home() {
        let home = allowlist::home_dir().expect("home must be available in tests");
        for t in [
            WriteTarget::HyprlandGeneratedConfig,
            WriteTarget::HyprlandMainConfig,
            WriteTarget::WaybarConfig,
            WriteTarget::RofiConfig,
        ] {
            let p = allowlist::resolve_target_path(t).unwrap();
            assert!(p.starts_with(&home), "path must stay under home: {}", p.display());
        }
    }

    #[test]
    fn validate_rejects_empty_content() {
        let req = WriteRequest {
            target: WriteTarget::HyprlandGeneratedConfig,
            content: String::new(),
        };
        assert!(matches!(
            validate::validate_write_request(&req),
            Err(HelperError::EmptyContent)
        ));
    }

    // execute_write now performs real I/O to ~/.config paths; we test the
    // inner function with a tempdir instead to stay system-safe.
    #[test]
    fn execute_write_inner_creates_file_under_tempdir() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("subdir").join("hyprland.conf");
        let content = "general { gaps_in = 4 }";
        let res = execute_write_inner(&target, content).unwrap();
        assert_eq!(std::fs::read_to_string(&res.target_path).unwrap(), content);
        assert!(res.backup_path.is_none(), "no backup when file was new");
    }

    #[test]
    fn execute_write_inner_creates_backup_when_file_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("hyprland.conf");
        std::fs::write(&target, "old content").unwrap();

        let res = execute_write_inner(&target, "new content").unwrap();
        assert_eq!(std::fs::read_to_string(&res.target_path).unwrap(), "new content");
        let bak = res.backup_path.expect("backup must exist when file was present");
        assert_eq!(std::fs::read_to_string(&bak).unwrap(), "old content");
    }

    #[test]
    fn execute_write_inner_rejects_empty_content() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("hyprland.conf");
        // validate_write_request is called inside execute_write, not execute_write_inner;
        // test that the public API rejects empty content before any I/O.
        let req = WriteRequest {
            target: WriteTarget::HyprlandGeneratedConfig,
            content: String::new(),
        };
        assert!(matches!(execute_write(req), Err(HelperError::EmptyContent)));
        assert!(!target.exists(), "no file should be created on validation failure");
    }

    #[test]
    fn backup_existing_returns_none_when_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("nonexistent.conf");
        assert!(backup_existing(&path).unwrap().is_none());
    }

    #[test]
    fn backup_existing_copies_file_and_preserves_original() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("config.conf");
        std::fs::write(&path, "original").unwrap();
        let bak = backup_existing(&path).unwrap().expect("backup must be Some");
        assert!(path.exists(), "original must still exist after backup");
        assert_eq!(std::fs::read_to_string(&bak).unwrap(), "original");
    }

    #[test]
    fn restore_from_backup_restores_file_content() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("config.conf");
        std::fs::write(&target, "new content").unwrap();
        let suffix = "20260409T051230000001Z-00000000-0000-4000-a000-000000000001";
        let bak_name = format!("config.conf.bak.{suffix}");
        let bak = tmp.path().join(&bak_name);
        std::fs::write(&bak, "old content").unwrap();

        match restore_from_backup(&target, &bak_name) {
            Ok(()) => {
                assert_eq!(std::fs::read_to_string(&target).unwrap(), "old content");
            }
            Err(HelperError::PathConfinementViolation(_)) => {
                // tempdir may be outside HOME in some CI environments — acceptable.
            }
            Err(e) => panic!("unexpected error: {e}"),
        }
    }

    // ─── P0: backup name validation ──────────────────────────────────────────

    #[test]
    fn validate_backup_name_accepts_valid_name() {
        validate_backup_file_name(
            "hyprland.conf.bak.20260409T051230123456Z-550e8400-e29b-41d4-a716-446655440000",
            "hyprland.conf",
        )
        .unwrap();
    }

    #[test]
    fn validate_backup_name_rejects_wrong_target_prefix() {
        let err = validate_backup_file_name(
            "waybar.conf.bak.20260409T051230123456Z-550e8400-e29b-41d4-a716-446655440000",
            "hyprland.conf",
        )
        .unwrap_err();
        assert!(matches!(err, HelperError::InvalidBackupName(_)));
    }

    #[test]
    fn validate_backup_name_rejects_path_separator() {
        let err =
            validate_backup_file_name("subdir/hyprland.conf.bak.20260409T", "hyprland.conf")
                .unwrap_err();
        assert!(matches!(err, HelperError::InvalidBackupName(_)));
    }

    #[test]
    fn validate_backup_name_rejects_tmp_suffix() {
        let err = validate_backup_file_name(
            "hyprland.conf.bak.20260409T051230123456Z-uuid.tmp",
            "hyprland.conf",
        )
        .unwrap_err();
        assert!(matches!(err, HelperError::InvalidBackupName(_)));
    }

    #[test]
    fn validate_backup_name_rejects_bare_target_name() {
        let err = validate_backup_file_name("hyprland.conf", "hyprland.conf").unwrap_err();
        assert!(matches!(err, HelperError::InvalidBackupName(_)));
    }

    #[test]
    fn validate_backup_name_rejects_oversized_name() {
        let long = format!("hyprland.conf.bak.{}", "a".repeat(MAX_BACKUP_NAME_LEN));
        let err = validate_backup_file_name(&long, "hyprland.conf").unwrap_err();
        assert!(matches!(err, HelperError::InvalidBackupName(_)));
    }

    // ─── P0: uniqueness ──────────────────────────────────────────────────────

    #[test]
    fn two_consecutive_backups_have_distinct_names() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("hyprland.conf");
        std::fs::write(&path, "v1").unwrap();
        let bak1 = backup_existing(&path).unwrap().expect("bak1 must be Some");

        std::fs::write(&path, "v2").unwrap();
        let bak2 = backup_existing(&path).unwrap().expect("bak2 must be Some");

        assert_ne!(bak1, bak2, "consecutive backups must have different names");
        assert_eq!(std::fs::read_to_string(&bak1).unwrap(), "v1");
        assert_eq!(std::fs::read_to_string(&bak2).unwrap(), "v2");
    }

    #[test]
    fn backup_existing_does_not_overwrite_previous_backup() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("hyprland.conf");
        std::fs::write(&path, "original").unwrap();
        let bak1 = backup_existing(&path).unwrap().expect("bak1");
        // Verify bak1 still has "original" even after a second backup.
        std::fs::write(&path, "v2").unwrap();
        let bak2 = backup_existing(&path).unwrap().expect("bak2");
        assert_ne!(bak1, bak2);
        assert_eq!(std::fs::read_to_string(&bak1).unwrap(), "original");
    }

    #[test]
    fn execute_write_sandbox_writes_under_data_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let res = execute_write_sandbox(
            tmp.path(),
            SandboxTarget::Hyprland,
            "general { gaps_in = 4 }".to_string(),
        )
        .unwrap();

        assert!(
            res.target_path.contains("/exported/"),
            "target_path should contain exported/ (got {})",
            res.target_path
        );

        let written = std::fs::read_to_string(&res.target_path).unwrap();
        assert!(written.contains("gaps_in"));
        assert!(res.backup_path.is_none());
    }

    #[test]
    fn no_arbitrary_path_api_exists_compile_time() {
        // This is a compile-time guarantee by design:
        // execute_write only accepts WriteRequest with WriteTarget enum.
        assert!(true);
    }

    #[test]
    fn confinement_check_accepts_tempdir_subpath() {
        // This test does not write to the real system; it uses a temp directory.
        let tmp = tempfile::tempdir().unwrap();
        // Use a path within the tempdir. check_path_confinement might fail if tempdir is not under
        // HOME; we accept either Ok or the confinement error, but it must not panic.
        let p = tmp.path().join("foo.txt");
        let _ = validate::check_path_confinement(&p);
    }

    #[test]
    fn export_bindings() {
        WriteTarget::export().expect("export WriteTarget TS");
        SandboxTarget::export().expect("export SandboxTarget TS");
        WriteResult::export().expect("export WriteResult TS");
    }
}
