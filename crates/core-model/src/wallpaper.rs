//! Dominio wallpapers (Fase E) — tipos compartidos y export TS.
//!
//! Theme sync futuro: campos opcionales en `WallpaperMetadata` + trait `WallpaperThemeHints`.

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use ts_rs::TS;

/// Identificador opaco generado solo en backend; el frontend nunca construye rutas.
#[derive(Debug, Clone, PartialEq, Eq, Hash, TS)]
#[ts(type = "string", export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperId(pub String);

impl Serialize for WallpaperId {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.0.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for WallpaperId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        String::deserialize(deserializer).map(WallpaperId)
    }
}

impl WallpaperId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Valida prefijo permitido (`loc:` archivo bajo raíz allowlist, `we:` proyecto WE).
pub fn validate_wallpaper_id(id: &str) -> Result<(), &'static str> {
    if id.is_empty() {
        return Err("empty wallpaper id");
    }
    if id.len() > 256 {
        return Err("wallpaper id too long");
    }
    if id.contains("..") || id.contains('/') || id.contains('\\') {
        return Err("wallpaper id must not contain path separators");
    }
    if id.starts_with("loc:") || id.starts_with("we:") {
        return Ok(());
    }
    Err("wallpaper id must start with loc: or we:")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(rename_all = "lowercase", export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum WallpaperSource {
    LocalAllowlistedRoot,
    WallpaperEngineLibrary,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(rename_all = "lowercase", export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum WallpaperKind {
    Image,
    Video,
    WallpaperEngineProject,
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperEntryFlags {
    pub missing_file: bool,
    pub thumbnail_missing: bool,
    pub parse_error: bool,
}

impl Default for WallpaperEntryFlags {
    fn default() -> Self {
        Self {
            missing_file: false,
            thumbnail_missing: true,
            parse_error: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperMetadata {
    pub title: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_ms: Option<u64>,
    /// Reservado para theme sync (Fase futura).
    pub dominant_color: Option<String>,
    /// Reservado para theme sync (Fase futura).
    pub palette_preview: Option<Vec<String>>,
    pub engine_project_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum WallpaperPreview {
    /// Imagen inline base64 (solo si tamaño acotado en el comando).
    StaticImage {
        mime: String,
        data_base64: String,
    },
    Unavailable {
        reason: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperCatalogEntry {
    pub id: WallpaperId,
    pub source: WallpaperSource,
    pub kind: WallpaperKind,
    pub metadata: WallpaperMetadata,
    pub flags: WallpaperEntryFlags,
    /// Orden: mtime desc (unix sec) como i64 para JSON estable.
    pub sort_key_mtime: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(rename_all = "lowercase", export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum WallpaperApplyMode {
    SetDesktop,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperApplyPlan {
    pub wallpaper_id: WallpaperId,
    pub mode: WallpaperApplyMode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperApplyResult {
    pub ok: bool,
    pub applied_id: Option<WallpaperId>,
    pub backend_message: Option<String>,
    pub already_active: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum WallpaperBackendStatus {
    Ready { detail: String },
    NotInstalled,
    Misconfigured { reason: String },
    Error { message: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(rename_all = "lowercase", export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum WallpaperConfidence {
    KnownFromApp,
    ReportedByBackend,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct CurrentWallpaperState {
    pub last_applied_by_app: Option<WallpaperId>,
    pub reported_by_backend: Option<String>,
    pub checked_at: String,
    pub confidence: WallpaperConfidence,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperFilter {
    pub kind: Option<WallpaperKind>,
    pub source: Option<WallpaperSource>,
}

impl Default for WallpaperFilter {
    fn default() -> Self {
        Self {
            kind: None,
            source: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperScanStats {
    pub entry_count: usize,
    pub truncated: bool,
    pub max_entries: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperCollection {
    pub entries: Vec<WallpaperCatalogEntry>,
    pub generated_at: String,
    pub scan_stats: WallpaperScanStats,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperCatalogCacheMeta {
    pub version: u32,
    pub roots_fingerprint: String,
    pub entry_count: usize,
}

/// Hook vacío para extracción de paleta / theme sync (sin implementación en v1).
pub trait WallpaperThemeHints {
    fn dominant_hint(&self) -> Option<String> {
        None
    }
}

impl WallpaperThemeHints for WallpaperCatalogEntry {}
