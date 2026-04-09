pub mod adapter;
pub mod types;

pub use adapter::{export_from_settings, load_fixture, reload_compositor};
pub use types::{FixtureSource, HyprlandExportResult, HyprlandFixtureResult, ReloadOutput};

#[cfg(test)]
mod tests {
    use core_model::settings::HyprlandSettings;

    use super::*;

    #[test]
    fn load_fixture_returns_embedded_content() {
        let result = load_fixture();
        assert_eq!(result.source, FixtureSource::Embedded);
        assert!(!result.content.is_empty());
        assert!(result.content.contains("general"));
    }

    #[test]
    fn export_from_default_settings_produces_valid_output() {
        let settings = HyprlandSettings::default();
        let result = export_from_settings(&settings);
        assert!(result.content.contains("gaps_in = 4"));
        assert!(result.content.contains("rounding = 8"));
        assert!(result.content.contains("enabled = true"));
    }
}
