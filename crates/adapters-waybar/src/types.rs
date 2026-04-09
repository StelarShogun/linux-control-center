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

/// Resultado de pedir a Waybar que recargue la configuración (`SIGUSR2`).
#[derive(Debug, Clone)]
pub struct ReloadOutput {
    /// `true` si `pkill -USR2 waybar` devolvió exit code 0 (al menos un proceso recibió la señal).
    pub ok: bool,
    /// stdout + stderr combinados, útil si falla o no hay proceso `waybar`.
    pub output: String,
}
