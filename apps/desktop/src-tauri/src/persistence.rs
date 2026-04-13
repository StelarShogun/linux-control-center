use std::{
    collections::HashSet,
    fs,
    io::{self, BufRead, Write},
    path::{Path, PathBuf},
};

use core_model::{
    journal::OperationJournalEntry,
    profile::{ProfileId, SettingsProfile},
    settings::AppSettings,
    snapshot::{SnapshotId, SettingsSnapshot},
};
use journal_store::JournalStoreError;
use privileged_helper::WriteTarget;
use privileged_helper::write_target_for_backup_basename;
use thiserror::Error;
use time::format_description::well_known::Rfc3339;
use uuid::Uuid;

use crate::types::SnapshotInfo;

impl From<JournalStoreError> for PersistenceError {
    fn from(e: JournalStoreError) -> Self {
        match e {
            JournalStoreError::Io(e) => PersistenceError::Io(e),
            JournalStoreError::TomlSerialize(s) => PersistenceError::TomlSerialize(s),
            JournalStoreError::TomlDeserialize(s) => PersistenceError::TomlDeserialize(s),
            JournalStoreError::InvalidId(s) => PersistenceError::InvalidId(s),
        }
    }
}

#[derive(Debug, Error)]
pub enum PersistenceError {
    #[error("io error: {0}")]
    Io(#[from] io::Error),

    #[error("toml serialize error: {0}")]
    TomlSerialize(String),

    #[error("toml deserialize error: {0}")]
    TomlDeserialize(String),

    #[error("profile not found: {0}")]
    ProfileNotFound(ProfileId),

    #[error("snapshot not found: {0}")]
    SnapshotNotFound(SnapshotId),

    #[error("invalid id (must be lowercase hex and hyphens only): {0}")]
    InvalidId(String),

    #[error("json error: {0}")]
    Json(String),
}

/// Validates that an ID only contains characters safe for use as a path component.
/// Accepts UUID v4 format: lowercase hex digits and hyphens, max 64 chars.
fn validate_id(id: &str) -> Result<(), PersistenceError> {
    if id.is_empty()
        || id.len() > 64
        || !id
            .chars()
            .all(|c| matches!(c, '0'..='9' | 'a'..='f' | 'A'..='F' | '-'))
    {
        return Err(PersistenceError::InvalidId(id.to_string()));
    }
    Ok(())
}

/// Subset de campos de un snapshot para deserialización parcial.
/// Serde ignora los campos desconocidos por defecto, por lo que no se
/// construye `AppSettings` al listar — solo se extraen los metadatos.
#[derive(serde::Deserialize)]
struct SnapshotHeader {
    id: SnapshotId,
    timestamp: String,
    label: Option<String>,
    backup_file_name: Option<String>,
}

/// Writes `content` to `path` atomically using a write-then-rename pattern.
///
/// On POSIX, `rename(2)` is atomic as long as both the temporary file and the
/// destination are on the same filesystem, which is guaranteed here since both
/// live under `base_dir`.
fn atomic_write(path: &Path, content: &str) -> io::Result<()> {
    let tmp = path.with_extension("toml.tmp");
    fs::write(&tmp, content)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

fn profiles_dir(base_dir: &Path) -> PathBuf {
    base_dir.join("profiles")
}

fn snapshots_dir(base_dir: &Path) -> PathBuf {
    base_dir.join("snapshots")
}

fn profile_path(base_dir: &Path, id: &ProfileId) -> PathBuf {
    profiles_dir(base_dir).join(format!("{id}.toml"))
}

fn snapshot_path(base_dir: &Path, id: &SnapshotId) -> PathBuf {
    snapshots_dir(base_dir).join(format!("{id}.toml"))
}

fn current_settings_path(base_dir: &Path) -> PathBuf {
    base_dir.join("settings.toml")
}

pub fn save_profile(base_dir: &Path, profile: &SettingsProfile) -> Result<(), PersistenceError> {
    validate_id(&profile.metadata.id)?;
    let dir = profiles_dir(base_dir);
    fs::create_dir_all(&dir)?;

    let content = profile.to_toml_str().map_err(|e| match e {
        core_model::CoreError::ProfileSerialization(msg) => PersistenceError::TomlSerialize(msg),
        other => PersistenceError::TomlSerialize(other.to_string()),
    })?;

    atomic_write(&profile_path(base_dir, &profile.metadata.id), &content)?;
    Ok(())
}

pub fn load_profile(base_dir: &Path, id: &ProfileId) -> Result<SettingsProfile, PersistenceError> {
    validate_id(id)?;
    let path = profile_path(base_dir, id);
    if !path.exists() {
        return Err(PersistenceError::ProfileNotFound(id.clone()));
    }
    let content = fs::read_to_string(&path)?;
    SettingsProfile::from_toml_str(&content).map_err(|e| match e {
        core_model::CoreError::ProfileDeserialization(msg) => PersistenceError::TomlDeserialize(msg),
        other => PersistenceError::TomlDeserialize(other.to_string()),
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProfileListItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
}

/// Lista perfiles guardados (metadatos), más recientes primero por `created_at`.
pub fn list_profiles(base_dir: &Path) -> Result<Vec<ProfileListItem>, PersistenceError> {
    let dir = profiles_dir(base_dir);
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut out: Vec<ProfileListItem> = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|e| e.to_str()) != Some("toml") {
            continue;
        }
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let p: SettingsProfile = match SettingsProfile::from_toml_str(&content) {
            Ok(p) => p,
            Err(_) => continue,
        };
        out.push(ProfileListItem {
            id: p.metadata.id,
            name: p.metadata.name,
            description: p.metadata.description,
            created_at: p.metadata.created_at,
        });
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

pub fn delete_profile_file(base_dir: &Path, id: &ProfileId) -> Result<(), PersistenceError> {
    validate_id(id)?;
    let path = profile_path(base_dir, id);
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}

pub fn update_profile_disk(base_dir: &Path, profile: &SettingsProfile) -> Result<(), PersistenceError> {
    validate_id(&profile.metadata.id)?;
    save_profile(base_dir, profile)
}

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct ActiveProfilePointer {
    pub profile_id: Option<String>,
    pub profile_name: Option<String>,
}

fn active_profile_json_path(base_dir: &Path) -> PathBuf {
    base_dir.join("active_profile.json")
}

pub fn read_active_profile(base_dir: &Path) -> Result<ActiveProfilePointer, PersistenceError> {
    let p = active_profile_json_path(base_dir);
    if !p.exists() {
        return Ok(ActiveProfilePointer::default());
    }
    let s = fs::read_to_string(&p)?;
    serde_json::from_str(&s).map_err(|e| PersistenceError::Json(e.to_string()))
}

pub fn write_active_profile(
    base_dir: &Path,
    profile_id: Option<&str>,
    profile_name: Option<&str>,
) -> Result<(), PersistenceError> {
    fs::create_dir_all(base_dir)?;
    let v = ActiveProfilePointer {
        profile_id: profile_id.map(str::to_string),
        profile_name: profile_name.map(str::to_string),
    };
    let s =
        serde_json::to_string_pretty(&v).map_err(|e| PersistenceError::Json(e.to_string()))?;
    atomic_write(&active_profile_json_path(base_dir), &s)?;
    Ok(())
}

pub fn load_current_settings(base_dir: &Path) -> Result<Option<AppSettings>, PersistenceError> {
    let path = current_settings_path(base_dir);
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)?;
    let settings: AppSettings =
        toml::from_str(&content).map_err(|e| PersistenceError::TomlDeserialize(e.to_string()))?;
    Ok(Some(settings))
}

pub fn save_current_settings(base_dir: &Path, settings: &AppSettings) -> Result<(), PersistenceError> {
    fs::create_dir_all(base_dir)?;
    let content = toml::to_string_pretty(settings)
        .map_err(|e| PersistenceError::TomlSerialize(e.to_string()))?;
    atomic_write(&current_settings_path(base_dir), &content)?;
    Ok(())
}

pub fn new_profile_id() -> ProfileId {
    Uuid::new_v4().to_string()
}

pub fn new_snapshot_id() -> SnapshotId {
    Uuid::new_v4().to_string()
}

/// Identificador único para una entrada del Operation Journal (UUID v4).
pub fn new_journal_operation_id() -> String {
    journal_store::new_operation_id()
}

/// Persiste una entrada del journal en `{base_dir}/journal/{operation_id}.toml`.
pub fn save_journal_entry(base_dir: &Path, entry: &OperationJournalEntry) -> Result<(), PersistenceError> {
    journal_store::save_entry(base_dir, entry)?;
    Ok(())
}

/// Lista entradas del journal ordenadas por `finished_at` descendente (más recientes primero).
pub fn list_recent_journal_entries(
    base_dir: &Path,
    limit: usize,
) -> Result<Vec<OperationJournalEntry>, PersistenceError> {
    Ok(journal_store::list_recent(base_dir, limit)?)
}

fn backup_registry_path(base_dir: &Path) -> PathBuf {
    base_dir.join("backup_registry.jsonl")
}

fn registry_timestamp_utc() -> String {
    time::OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct BackupRegistryRecord {
    backup_file_name: String,
    target: WriteTarget,
    #[serde(default)]
    operation_id: Option<String>,
    registered_at: String,
    /// `write` | `migration_journal` | `migration_snapshot`
    source: String,
}

/// Nombres de backup registrados por LCC (append-only JSONL). Sobrevive a entradas de journal borradas.
pub fn read_registry_backup_names(base_dir: &Path) -> Result<HashSet<String>, PersistenceError> {
    let path = backup_registry_path(base_dir);
    if !path.exists() {
        return Ok(HashSet::new());
    }
    let file = fs::File::open(&path).map_err(PersistenceError::Io)?;
    let reader = io::BufReader::new(file);
    let mut out = HashSet::new();
    for line in reader.lines() {
        let line = line.map_err(PersistenceError::Io)?;
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        let rec: BackupRegistryRecord =
            serde_json::from_str(t).map_err(|e| PersistenceError::Json(e.to_string()))?;
        out.insert(rec.backup_file_name);
    }
    Ok(out)
}

fn append_backup_registry_record(
    base_dir: &Path,
    backup_file_name: &str,
    target: WriteTarget,
    operation_id: Option<&str>,
    source: &str,
) -> Result<(), PersistenceError> {
    fs::create_dir_all(base_dir)?;
    let path = backup_registry_path(base_dir);
    let rec = BackupRegistryRecord {
        backup_file_name: backup_file_name.to_string(),
        target,
        operation_id: operation_id.map(|s| s.to_string()),
        registered_at: registry_timestamp_utc(),
        source: source.to_string(),
    };
    let mut f = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(PersistenceError::Io)?;
    let line = serde_json::to_string(&rec).map_err(|e| PersistenceError::Json(e.to_string()))?;
    writeln!(f, "{line}").map_err(PersistenceError::Io)?;
    Ok(())
}

/// Añade al registro persistente un backup creado por LCC (idempotente por nombre).
pub fn register_lcc_backup_if_new(
    base_dir: &Path,
    backup_file_name: &str,
    target: WriteTarget,
    operation_id: Option<&str>,
) -> Result<(), PersistenceError> {
    let known = read_registry_backup_names(base_dir)?;
    if known.contains(backup_file_name) {
        return Ok(());
    }
    append_backup_registry_record(base_dir, backup_file_name, target, operation_id, "write")
}

/// Migra a `backup_registry.jsonl` nombres que ya figuran en journal/snapshots (convención LCC).
pub fn sync_backup_registry_from_metadata(base_dir: &Path) -> Result<(), PersistenceError> {
    let mut known = read_registry_backup_names(base_dir)?;
    for row in journal_store::list_all_entries(base_dir)? {
        if let Some(b) = row.backup_file_name.filter(|s| !s.is_empty()) {
            if known.contains(&b) {
                continue;
            }
            let Some(t) = write_target_for_backup_basename(&b) else {
                continue;
            };
            append_backup_registry_record(
                base_dir,
                &b,
                t,
                Some(row.operation_id.as_str()),
                "migration_journal",
            )?;
            known.insert(b);
        }
    }
    for s in list_snapshots(base_dir)? {
        if let Some(b) = s.backup_file_name.filter(|s| !s.is_empty()) {
            if known.contains(&b) {
                continue;
            }
            let Some(t) = write_target_for_backup_basename(&b) else {
                continue;
            };
            append_backup_registry_record(base_dir, &b, t, None, "migration_snapshot")?;
            known.insert(b);
        }
    }
    Ok(())
}

/// Conjuntos disjuntos para la UI de auditoría (tras sincronizar registro).
#[derive(Debug, Clone)]
pub struct BackupTrackingSets {
    pub journal: HashSet<String>,
    pub snapshot: HashSet<String>,
    pub registry: HashSet<String>,
}

impl BackupTrackingSets {
    pub fn tracked_union(&self) -> HashSet<String> {
        let mut u = HashSet::new();
        u.extend(self.journal.iter().cloned());
        u.extend(self.snapshot.iter().cloned());
        u.extend(self.registry.iter().cloned());
        u
    }
}

pub fn load_backup_tracking_sets(base_dir: &Path) -> Result<BackupTrackingSets, PersistenceError> {
    sync_backup_registry_from_metadata(base_dir)?;
    let mut journal = HashSet::new();
    for row in journal_store::list_all_entries(base_dir)? {
        if let Some(b) = row.backup_file_name.filter(|s| !s.is_empty()) {
            journal.insert(b);
        }
    }
    let mut snapshot = HashSet::new();
    for s in list_snapshots(base_dir)? {
        if let Some(b) = s.backup_file_name.filter(|s| !s.is_empty()) {
            snapshot.insert(b);
        }
    }
    let registry = read_registry_backup_names(base_dir)?;
    Ok(BackupTrackingSets {
        journal,
        snapshot,
        registry,
    })
}

/// Unión journal + snapshots + registro (para validar borrado de huérfanos).
pub fn load_tracked_backup_union(base_dir: &Path) -> Result<HashSet<String>, PersistenceError> {
    Ok(load_backup_tracking_sets(base_dir)?.tracked_union())
}

pub fn save_snapshot(
    base_dir: &Path,
    snapshot: &SettingsSnapshot,
) -> Result<(), PersistenceError> {
    validate_id(&snapshot.id)?;
    let dir = snapshots_dir(base_dir);
    fs::create_dir_all(&dir)?;

    let content = toml::to_string_pretty(snapshot)
        .map_err(|e| PersistenceError::TomlSerialize(e.to_string()))?;
    atomic_write(&snapshot_path(base_dir, &snapshot.id), &content)?;

    enforce_snapshot_cap(base_dir, 20)?;
    Ok(())
}

fn enforce_snapshot_cap(base_dir: &Path, max: usize) -> Result<(), PersistenceError> {
    let mut list = list_snapshots(base_dir)?;
    if list.len() <= max {
        return Ok(());
    }

    // list_snapshots devuelve orden descendente por timestamp; borramos desde el final.
    while list.len() > max {
        let last = list
            .pop()
            .expect("len checked above; pop must succeed");
        let path = snapshot_path(base_dir, &last.id);
        if path.exists() {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

pub fn list_snapshots(base_dir: &Path) -> Result<Vec<SnapshotInfo>, PersistenceError> {
    let dir = snapshots_dir(base_dir);
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
        let header: SnapshotHeader =
            toml::from_str(&content).map_err(|e| PersistenceError::TomlDeserialize(e.to_string()))?;
        out.push(SnapshotInfo {
            id: header.id,
            timestamp: header.timestamp,
            label: header.label,
            backup_file_name: header.backup_file_name,
        });
    }

    out.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(out)
}

/// Busca el primer snapshot cuyo `backup_file_name` coincide exactamente.
///
/// Devuelve `None` si no existe ningún snapshot con ese backup.
pub fn find_snapshot_by_backup_file_name(
    base_dir: &Path,
    backup_file_name: &str,
) -> Result<Option<SnapshotInfo>, PersistenceError> {
    let all = list_snapshots(base_dir)?;
    Ok(all.into_iter().find(|s| s.backup_file_name.as_deref() == Some(backup_file_name)))
}

pub fn load_snapshot_settings(
    base_dir: &Path,
    id: &SnapshotId,
) -> Result<AppSettings, PersistenceError> {
    validate_id(id)?;
    let path = snapshot_path(base_dir, id);
    if !path.exists() {
        return Err(PersistenceError::SnapshotNotFound(id.clone()));
    }
    let content = fs::read_to_string(&path)?;
    let snap: SettingsSnapshot =
        toml::from_str(&content).map_err(|e| PersistenceError::TomlDeserialize(e.to_string()))?;
    Ok(snap.settings)
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use core_model::{settings::AppSettings, snapshot::create_snapshot};

    use super::*;

    fn unique_temp_dir() -> PathBuf {
        let mut dir = std::env::temp_dir();
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time went backwards")
            .as_nanos();
        dir.push(format!("linux-control-center-test-{nanos}"));
        fs::create_dir_all(&dir).expect("failed to create temp dir");
        dir
    }

    const PROFILE_ID: &str = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
    const SNAPSHOT_ID: &str = "b2c3d4e5-f6a7-4890-bcde-f01234567891";
    const MISSING_PROFILE_ID: &str = "ffffffff-ffff-4fff-afff-ffffffffffff";
    const MISSING_SNAPSHOT_ID: &str = "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee";

    #[test]
    fn save_and_load_profile_roundtrip() {
        let dir = unique_temp_dir();
        let settings = AppSettings::default();
        let profile = SettingsProfile::new(PROFILE_ID, "Test", settings.clone());

        save_profile(&dir, &profile).expect("save_profile failed");
        let loaded = load_profile(&dir, &profile.metadata.id).expect("load_profile failed");

        assert_eq!(loaded.metadata.id, profile.metadata.id);
        assert_eq!(loaded.metadata.name, "Test");
        assert_eq!(loaded.settings, settings);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn load_profile_missing_returns_typed_error() {
        let dir = unique_temp_dir();
        let err = load_profile(&dir, &MISSING_PROFILE_ID.to_string()).unwrap_err();
        assert!(matches!(err, PersistenceError::ProfileNotFound(_)));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn save_list_and_restore_snapshot_settings() {
        let dir = unique_temp_dir();

        let mut s = AppSettings::default();
        s.hyprland.gaps_in = 10;
        let snap = create_snapshot(
            SNAPSHOT_ID,
            "1970-01-01T00:00:01Z",
            Some("before".into()),
            None,
            s.clone(),
        );

        save_snapshot(&dir, &snap).expect("save_snapshot failed");

        let list = list_snapshots(&dir).expect("list_snapshots failed");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, SNAPSHOT_ID);
        assert_eq!(list[0].label.as_deref(), Some("before"));

        let restored = load_snapshot_settings(&dir, &SNAPSHOT_ID.to_string()).expect("restore failed");
        assert_eq!(restored, s);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn restore_missing_snapshot_returns_typed_error() {
        let dir = unique_temp_dir();
        let err = load_snapshot_settings(&dir, &MISSING_SNAPSHOT_ID.to_string()).unwrap_err();
        assert!(matches!(err, PersistenceError::SnapshotNotFound(_)));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn invalid_id_is_rejected() {
        let dir = unique_temp_dir();
        let err = load_profile(&dir, &"../../etc/passwd".to_string()).unwrap_err();
        assert!(matches!(err, PersistenceError::InvalidId(_)));
        let err2 = load_snapshot_settings(&dir, &"../nope".to_string()).unwrap_err();
        assert!(matches!(err2, PersistenceError::InvalidId(_)));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn save_and_load_current_settings_roundtrip() {
        let dir = unique_temp_dir();
        let mut s = AppSettings::default();
        s.appearance.theme = "light".into();

        save_current_settings(&dir, &s).expect("save_current_settings failed");
        let loaded = load_current_settings(&dir)
            .expect("load_current_settings failed")
            .expect("expected Some");
        assert_eq!(loaded, s);

        fs::remove_dir_all(&dir).ok();
    }

}

