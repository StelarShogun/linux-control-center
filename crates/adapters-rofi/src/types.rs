pub use core_model::FixtureSource;

/// Resultado de cargar el fixture de Rofi.
///
/// En esta fase el contenido es siempre el fixture embebido.
/// En una fase futura se añadirá la ruta del archivo de origen.
#[derive(Debug, Clone)]
pub struct RofiFixtureResult {
    /// Contenido del archivo config.rasi del fixture.
    pub content: String,
    /// Origen del contenido (siempre `Embedded` en esta fase).
    pub source: FixtureSource,
}

/// Resultado de exportar settings a formato Rofi (.rasi).
#[derive(Debug, Clone)]
pub struct RofiExportResult {
    /// Contenido generado para config.rasi.
    pub content: String,
}
