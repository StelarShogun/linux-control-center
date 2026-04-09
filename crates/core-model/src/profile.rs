use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{error::CoreError, settings::AppSettings};

/// Identificador único de un perfil (UUID v4 como string).
pub type ProfileId = String;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct ProfileMetadata {
    pub id: ProfileId,
    pub name: String,
    pub description: String,
    pub created_at: String,
}

/// Perfil completo: metadatos + settings.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct SettingsProfile {
    pub metadata: ProfileMetadata,
    pub settings: AppSettings,
}

impl SettingsProfile {
    pub fn new(id: impl Into<String>, name: impl Into<String>, settings: AppSettings) -> Self {
        Self {
            metadata: ProfileMetadata {
                id: id.into(),
                name: name.into(),
                description: String::new(),
                // El core-model no obtiene tiempo del sistema; usamos un RFC3339 UTC sentinel.
                // La capa de aplicación (Tauri) debe sobrescribirlo al persistir.
                created_at: "1970-01-01T00:00:00Z".into(),
            },
            settings,
        }
    }

    /// Deserializa un perfil desde contenido TOML.
    ///
    /// LIMITATION: No valida los campos del perfil más allá de la estructura TOML.
    /// La validación semántica debe hacerse con `validate::validate_settings`.
    pub fn from_toml_str(content: &str) -> Result<Self, CoreError> {
        toml::from_str(content).map_err(|e| CoreError::ProfileDeserialization(e.to_string()))
    }

    /// Serializa el perfil a TOML.
    pub fn to_toml_str(&self) -> Result<String, CoreError> {
        toml::to_string_pretty(self)
            .map_err(|e| CoreError::ProfileSerialization(e.to_string()))
    }
}
