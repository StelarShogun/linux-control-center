use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::settings::AppSettings;

/// Identificador de snapshot (UUID v4 como string).
pub type SnapshotId = String;

/// Metadata visible de un snapshot, sin los `AppSettings` completos.
///
/// Devuelto por `list_snapshots` y `create_snapshot` para que la capa de
/// presentación no necesite deserializar el snapshot entero.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct SnapshotInfo {
    pub id: SnapshotId,
    pub timestamp: String,
    pub label: Option<String>,
    /// Basename del backup de archivo asociado a este snapshot, si se creó junto a
    /// un `apply_config_to_real_path`. Permite el rollback completo en un solo paso.
    pub backup_file_name: Option<String>,
}

/// Snapshot inmutable de `AppSettings` en un instante dado.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsSnapshot {
    pub id: SnapshotId,
    /// Timestamp ISO 8601 (proporcionado externamente; el core no depende de tiempo).
    pub timestamp: String,
    /// Descripción opcional del snapshot (e.g., "Antes de cambiar tema").
    pub label: Option<String>,
    /// Basename del backup de archivo asociado (ver `SnapshotInfo::backup_file_name`).
    pub backup_file_name: Option<String>,
    pub settings: AppSettings,
}

/// Crea un nuevo snapshot a partir de los settings actuales.
///
/// `id` y `timestamp` se proporcionan externamente para mantener el core sin dependencias de I/O.
pub fn create_snapshot(
    id: impl Into<SnapshotId>,
    timestamp: impl Into<String>,
    label: Option<String>,
    backup_file_name: Option<String>,
    settings: AppSettings,
) -> SettingsSnapshot {
    SettingsSnapshot {
        id: id.into(),
        timestamp: timestamp.into(),
        label,
        backup_file_name,
        settings,
    }
}
