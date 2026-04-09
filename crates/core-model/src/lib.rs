pub mod diff;
pub mod error;
pub mod fixture;
pub mod journal;
pub mod profile;
pub mod settings;
pub mod snapshot;
pub mod theme;
pub mod validate;
pub mod wallpaper;

pub use diff::{compute_diff, DiffEntry, SettingsDiff};
pub use fixture::FixtureSource;
pub use error::CoreError;
pub use profile::{ProfileId, ProfileMetadata, SettingsProfile};
pub use settings::{
    AppearanceSettings, AppSettings, HyprlandBind, HyprlandInputSettings, HyprlandKeyboardSettings,
    HyprlandSettings, HyprlandWindowRule, HyprlandWindowSettings, RofiSettings,
    WallpaperAppPreferences, WaybarSettings,
};
pub use wallpaper::{
    validate_wallpaper_id, CurrentWallpaperState, WallpaperApplyMode, WallpaperApplyPlan,
    WallpaperApplyResult, WallpaperBackendStatus, WallpaperCatalogCacheMeta, WallpaperCatalogEntry,
    WallpaperCollection, WallpaperConfidence, WallpaperEntryFlags, WallpaperFilter, WallpaperId,
    WallpaperKind, WallpaperMetadata, WallpaperPreview, WallpaperScanStats, WallpaperSource,
    WallpaperThemeHints,
};
pub use theme::{
    apply_tokens_to_settings, builtin_presets, find_builtin_preset, ThemePreset, ThemePresetSummary,
    ThemeTokenSet, ThemeVariant,
};
pub use journal::{
    truncate_journal_error, JournalOperationAction, OperationJournalEntry,
};
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

#[cfg(test)]
mod ts_export {
    use ts_rs::TS;

    use crate::journal::{JournalOperationAction, OperationJournalEntry};
    use crate::settings::{
        AppearanceSettings, AppSettings, HyprlandBind, HyprlandInputSettings, HyprlandKeyboardSettings,
        HyprlandSettings, HyprlandWindowRule, HyprlandWindowSettings, RofiSettings,
        WallpaperAppPreferences, WaybarSettings,
    };
    use crate::theme::{ThemePreset, ThemePresetSummary, ThemeTokenSet, ThemeVariant};
    use crate::wallpaper::{
        CurrentWallpaperState, WallpaperApplyMode, WallpaperApplyPlan, WallpaperApplyResult,
        WallpaperBackendStatus, WallpaperCatalogCacheMeta, WallpaperCatalogEntry, WallpaperCollection,
        WallpaperConfidence, WallpaperEntryFlags, WallpaperFilter, WallpaperId, WallpaperKind,
        WallpaperMetadata, WallpaperPreview, WallpaperScanStats, WallpaperSource,
    };

    #[test]
    fn export_bindings() {
        AppearanceSettings::export().expect("AppearanceSettings");
        HyprlandBind::export().expect("HyprlandBind");
        HyprlandKeyboardSettings::export().expect("HyprlandKeyboardSettings");
        HyprlandWindowRule::export().expect("HyprlandWindowRule");
        HyprlandWindowSettings::export().expect("HyprlandWindowSettings");
        HyprlandInputSettings::export().expect("HyprlandInputSettings");
        HyprlandSettings::export().expect("HyprlandSettings");
        WaybarSettings::export().expect("WaybarSettings");
        RofiSettings::export().expect("RofiSettings");
        WallpaperAppPreferences::export().expect("WallpaperAppPreferences");
        AppSettings::export().expect("AppSettings");
        JournalOperationAction::export().expect("JournalOperationAction");
        OperationJournalEntry::export().expect("OperationJournalEntry");
        ThemeVariant::export().expect("ThemeVariant");
        ThemeTokenSet::export().expect("ThemeTokenSet");
        ThemePreset::export().expect("ThemePreset");
        ThemePresetSummary::export().expect("ThemePresetSummary");
        WallpaperId::export().expect("WallpaperId");
        WallpaperSource::export().expect("WallpaperSource");
        WallpaperKind::export().expect("WallpaperKind");
        WallpaperEntryFlags::export().expect("WallpaperEntryFlags");
        WallpaperMetadata::export().expect("WallpaperMetadata");
        WallpaperPreview::export().expect("WallpaperPreview");
        WallpaperCatalogEntry::export().expect("WallpaperCatalogEntry");
        WallpaperApplyMode::export().expect("WallpaperApplyMode");
        WallpaperApplyPlan::export().expect("WallpaperApplyPlan");
        WallpaperApplyResult::export().expect("WallpaperApplyResult");
        WallpaperBackendStatus::export().expect("WallpaperBackendStatus");
        WallpaperConfidence::export().expect("WallpaperConfidence");
        CurrentWallpaperState::export().expect("CurrentWallpaperState");
        WallpaperFilter::export().expect("WallpaperFilter");
        WallpaperScanStats::export().expect("WallpaperScanStats");
        WallpaperCollection::export().expect("WallpaperCollection");
        WallpaperCatalogCacheMeta::export().expect("WallpaperCatalogCacheMeta");
    }
}
