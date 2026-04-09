//! Persistencia del Operation Journal en `{base_dir}/journal/*.toml`.
//!
//! Crate separado del binario Tauri para poder ejecutar tests de integración
//! sin depender del build script de `tauri-build`.

use std::{
    fs,
    io,
    path::{Path, PathBuf},
};

use core_model::journal::OperationJournalEntry;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum JournalStoreError {
    #[error("io error: {0}")]
    Io(#[from] io::Error),

    #[error("toml serialize error: {0}")]
    TomlSerialize(String),

    #[error("toml deserialize error: {0}")]
    TomlDeserialize(String),

    #[error("invalid operation id: {0}")]
    InvalidId(String),
}

fn validate_id(id: &str) -> Result<(), JournalStoreError> {
    if id.is_empty()
        || id.len() > 64
        || !id
            .chars()
            .all(|c| matches!(c, '0'..='9' | 'a'..='f' | 'A'..='F' | '-'))
    {
        return Err(JournalStoreError::InvalidId(id.to_string()));
    }
    Ok(())
}

fn atomic_write(path: &Path, content: &str) -> io::Result<()> {
    let tmp = path.with_extension("toml.tmp");
    fs::write(&tmp, content)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

fn journal_dir(base_dir: &Path) -> PathBuf {
    base_dir.join("journal")
}

/// Nuevo `operation_id` (UUID v4).
pub fn new_operation_id() -> String {
    Uuid::new_v4().to_string()
}

/// Persiste `{base_dir}/journal/{operation_id}.toml`.
pub fn save_entry(base_dir: &Path, entry: &OperationJournalEntry) -> Result<(), JournalStoreError> {
    validate_id(&entry.operation_id)?;
    let dir = journal_dir(base_dir);
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.toml", entry.operation_id));
    let content = toml::to_string_pretty(entry)
        .map_err(|e| JournalStoreError::TomlSerialize(e.to_string()))?;
    atomic_write(&path, &content)?;
    Ok(())
}

/// Entradas ordenadas por `finished_at` descendente; como máximo `limit` (cap 500).
pub fn list_recent(base_dir: &Path, limit: usize) -> Result<Vec<OperationJournalEntry>, JournalStoreError> {
    let dir = journal_dir(base_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("toml") {
            continue;
        }
        let content = fs::read_to_string(&path)?;
        let row: OperationJournalEntry = toml::from_str(&content)
            .map_err(|e| JournalStoreError::TomlDeserialize(e.to_string()))?;
        out.push(row);
    }

    out.sort_by(|a, b| b.finished_at.cmp(&a.finished_at));
    let cap = limit.min(500);
    out.truncate(cap);
    Ok(out)
}

/// Todas las entradas del journal (sin límite de recientes). Para auditoría / reconciliación.
pub fn list_all_entries(base_dir: &Path) -> Result<Vec<OperationJournalEntry>, JournalStoreError> {
    let dir = journal_dir(base_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("toml") {
            continue;
        }
        let content = fs::read_to_string(&path)?;
        let row: OperationJournalEntry = toml::from_str(&content)
            .map_err(|e| JournalStoreError::TomlDeserialize(e.to_string()))?;
        out.push(row);
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use core_model::journal::JournalOperationAction;

    fn tmp() -> tempfile::TempDir {
        tempfile::tempdir().expect("tempdir")
    }

    #[test]
    fn save_list_order_and_limit() {
        let dir = tmp();
        let base = dir.path();

        let e1 = OperationJournalEntry {
            operation_id: "11111111-1111-4111-8111-111111111111".into(),
            action: JournalOperationAction::ApplySandbox,
            target: "Hyprland".into(),
            started_at: "2026-04-09T10:00:00Z".into(),
            finished_at: "2026-04-09T10:00:01Z".into(),
            success: true,
            snapshot_id: None,
            backup_file_name: None,
            written_path: Some("/tmp/a".into()),
            reload_status: None,
            error_summary: None,
        };
        let e2 = OperationJournalEntry {
            operation_id: "22222222-2222-4222-8222-222222222222".into(),
            action: JournalOperationAction::ApplyReal,
            target: "Waybar".into(),
            started_at: "2026-04-09T11:00:00Z".into(),
            finished_at: "2026-04-09T11:00:01Z".into(),
            success: false,
            snapshot_id: None,
            backup_file_name: None,
            written_path: None,
            reload_status: None,
            error_summary: Some("boom".into()),
        };
        let e3 = OperationJournalEntry {
            operation_id: "33333333-3333-4333-8333-333333333333".into(),
            action: JournalOperationAction::Rollback,
            target: "Rofi".into(),
            started_at: "2026-04-09T12:00:00Z".into(),
            finished_at: "2026-04-09T12:00:01Z".into(),
            success: true,
            snapshot_id: Some("snap".into()),
            backup_file_name: Some("x.bak.y".into()),
            written_path: Some("/tmp/c".into()),
            reload_status: None,
            error_summary: None,
        };

        save_entry(base, &e1).unwrap();
        save_entry(base, &e2).unwrap();
        save_entry(base, &e3).unwrap();

        let all = list_recent(base, 10).unwrap();
        assert_eq!(all.len(), 3);
        assert_eq!(all[0].operation_id, e3.operation_id);

        let two = list_recent(base, 2).unwrap();
        assert_eq!(two.len(), 2);
        assert_eq!(two[0].operation_id, e3.operation_id);
    }

    #[test]
    fn empty_dir_returns_empty() {
        let dir = tmp();
        let list = list_recent(dir.path(), 50).unwrap();
        assert!(list.is_empty());
    }

    #[test]
    fn list_all_entries_reads_every_file() {
        let dir = tmp();
        let base = dir.path();
        let e = OperationJournalEntry {
            operation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa".into(),
            action: JournalOperationAction::ApplySandbox,
            target: "t".into(),
            started_at: "2026-04-09T10:00:00Z".into(),
            finished_at: "2026-04-09T10:00:01Z".into(),
            success: true,
            snapshot_id: None,
            backup_file_name: Some("linux-control-center.conf.bak.test".into()),
            written_path: None,
            reload_status: None,
            error_summary: None,
        };
        save_entry(base, &e).unwrap();
        let all = list_all_entries(base).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].backup_file_name, e.backup_file_name);
    }
}
