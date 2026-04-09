pub mod diff;
pub mod error;
pub mod fixture;
pub mod profile;
pub mod settings;
pub mod snapshot;
pub mod validate;

pub use diff::{compute_diff, DiffEntry, SettingsDiff};
pub use fixture::FixtureSource;
pub use error::CoreError;
pub use profile::{ProfileId, ProfileMetadata, SettingsProfile};
pub use settings::{AppearanceSettings, AppSettings, HyprlandSettings, RofiSettings, WaybarSettings};
pub use snapshot::{create_snapshot, SettingsSnapshot, SnapshotId, SnapshotInfo};
pub use validate::validate_settings;

#[cfg(test)]
mod tests {
    use super::*;

    fn default_settings() -> AppSettings {
        AppSettings::default()
    }

    #[test]
    fn default_settings_are_valid() {
        let s = default_settings();
        assert!(validate_settings(&s).is_ok());
    }

    #[test]
    fn empty_theme_fails_validation() {
        let mut s = default_settings();
        s.appearance.theme = String::new();
        assert!(validate_settings(&s).is_err());
    }

    #[test]
    fn invalid_accent_color_fails_validation() {
        let mut s = default_settings();
        s.appearance.accent_color = "not-a-color".into();
        assert!(validate_settings(&s).is_err());
    }

    #[test]
    fn invalid_waybar_position_fails_validation() {
        let mut s = default_settings();
        s.waybar.position = "diagonal".into();
        assert!(validate_settings(&s).is_err());
    }

    #[test]
    fn diff_identical_settings_is_empty() {
        let s = default_settings();
        let diff = compute_diff(&s, &s);
        assert!(diff.is_empty());
    }

    #[test]
    fn diff_detects_hyprland_change() {
        let old = default_settings();
        let mut new = old.clone();
        new.hyprland.gaps_in = 10;
        let diff = compute_diff(&old, &new);
        assert!(!diff.is_empty());
        assert!(diff.entries.iter().any(|e| e.field == "hyprland"));
    }

    #[test]
    fn snapshot_roundtrip() {
        let s = default_settings();
        let snap = create_snapshot("test-id", "2026-04-09T00:00:00Z", None, None, s.clone());
        assert_eq!(snap.id, "test-id");
        assert_eq!(snap.settings, s);
    }

    #[test]
    fn profile_toml_roundtrip() {
        let profile = SettingsProfile::new("p1", "Test", default_settings());
        let toml_str = profile.to_toml_str().expect("serialization failed");
        let restored = SettingsProfile::from_toml_str(&toml_str).expect("deserialization failed");
        assert_eq!(restored.metadata.name, "Test");
    }
}
