pub use core_model::FixtureSource;

/// Resultado de cargar el fixture de Waybar.
#[derive(Debug, Clone)]
pub struct WaybarFixtureResult {
    /// Contenido del archivo config.jsonc del fixture.
    pub content: String,
    /// Origen del contenido (siempre `Embedded` en fase 1).
    pub source: FixtureSource,
}

/// Resultado de exportar settings a formato Waybar (JSON).
#[derive(Debug, Clone)]
pub struct WaybarExportResult {
    /// Contenido generado para config.jsonc.
    pub content: String,
}
