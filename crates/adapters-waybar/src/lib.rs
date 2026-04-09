pub mod adapter;
pub mod reader;
pub mod reload;
pub mod types;

pub use adapter::{export_from_settings, export_style_from_settings, load_fixture};
pub use reader::read_from_system;
pub use reload::reload_waybar;
pub use types::{FixtureSource, ReloadOutput, WaybarExportResult, WaybarFixtureResult};

#[cfg(test)]
mod tests {
    use core_model::settings::WaybarSettings;

    use super::*;

    #[test]
    fn load_fixture_returns_embedded_content() {
        let result = load_fixture();
        assert_eq!(result.source, FixtureSource::Embedded);
        assert!(!result.content.is_empty());
        assert!(result.content.contains("modules-left"));
    }

    #[test]
    fn export_from_default_settings_produces_valid_json_structure() {
        let settings = WaybarSettings::default();
        let result = export_from_settings(&settings);
        assert!(result.content.contains("\"position\": \"top\""));
        assert!(result.content.contains("\"height\": 32"));
        assert!(result.content.contains("clock"));
    }

    #[test]
    fn export_style_contains_theme_colors() {
        let settings = WaybarSettings::default();
        let css = export_style_from_settings(&settings);
        assert!(css.content.contains(&settings.bar_background));
        assert!(css.content.contains(&settings.accent));
    }
}
