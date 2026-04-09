pub use core_model::FixtureSource;

/// Resultado de cargar el fixture de Hyprland.
///
/// En fase 1 el contenido es siempre texto plano del fixture embebido.
/// En fase 2 se añadirá la ruta del archivo de origen.
#[derive(Debug, Clone)]
pub struct HyprlandFixtureResult {
    /// Contenido del archivo hyprland.conf del fixture.
    pub content: String,
    /// Origen del contenido (siempre `Embedded` en fase 1).
    pub source: FixtureSource,
}

/// Resultado de exportar settings a formato Hyprland.
#[derive(Debug, Clone)]
pub struct HyprlandExportResult {
    /// Contenido generado para hyprland.conf.
    pub content: String,
}

/// Resultado de ejecutar `hyprctl reload`.
#[derive(Debug, Clone)]
pub struct ReloadOutput {
    /// `true` si `hyprctl reload` devolvió exit code 0.
    pub ok: bool,
    /// stdout + stderr combinados, útil para mostrar al usuario en caso de fallo.
    pub output: String,
}
