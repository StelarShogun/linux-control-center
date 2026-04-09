//! # adapters-rofi
//!
//! Adapter para el launcher Rofi.
//!
//! ## Estado: Fase mínima útil
//!
//! Soporta:
//! - Carga del fixture embebido (`load_fixture`)
//! - Generación de `config.rasi` desde `RofiSettings` (`export_from_settings`)
//!
//! ## Limitaciones explícitas
//! - No lee ni escribe archivos de configuración del sistema real.
//! - No lanza ni recarga Rofi.
//! - El campo `theme` de `RofiSettings` está reservado para una fase futura (`@theme`).
//! - Los colores del bloque visual son fijos (paleta Nord); no derivan de `AppearanceSettings`.
//! - `modi` es hardcoded (`"drun,run,window"`); no es aún campo de `RofiSettings`.

pub mod adapter;
pub mod reader;
pub mod types;

pub use adapter::{export_from_settings, load_fixture};
pub use reader::read_from_system;
pub use types::{FixtureSource, RofiExportResult, RofiFixtureResult};

#[cfg(test)]
mod tests {
    use core_model::settings::RofiSettings;

    use super::*;

    #[test]
    fn load_fixture_returns_embedded_content() {
        let result = load_fixture();
        assert_eq!(result.source, FixtureSource::Embedded);
        assert!(!result.content.is_empty());
        assert!(result.content.contains("configuration"));
    }

    #[test]
    fn export_contains_font() {
        let settings = RofiSettings::default();
        let result = export_from_settings(&settings);
        assert!(result.content.contains("Inter 11"));
    }

    #[test]
    fn export_show_icons_true() {
        let settings = RofiSettings::default();
        let result = export_from_settings(&settings);
        assert!(result.content.contains("show-icons:     true"));
    }

    #[test]
    fn export_show_icons_false_when_disabled() {
        let settings = RofiSettings { show_icons: false, ..RofiSettings::default() };
        let result = export_from_settings(&settings);
        assert!(result.content.contains("show-icons:     false"));
    }

    #[test]
    fn export_contains_icon_theme() {
        let settings = RofiSettings::default();
        let result = export_from_settings(&settings);
        assert!(result.content.contains("Papirus"));
    }

    #[test]
    fn export_has_complete_configuration_block() {
        let settings = RofiSettings::default();
        let result = export_from_settings(&settings);
        assert!(result.content.contains("configuration {"));
        assert!(result.content.contains('}'));
    }
}
