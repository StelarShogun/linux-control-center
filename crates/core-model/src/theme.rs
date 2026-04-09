//! Theme Manager (Fase D): tokens compartidos y presets builtin.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::settings::AppSettings;

/// Variante cromática del preset.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(rename_all = "lowercase", export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum ThemeVariant {
    Dark,
    Light,
}

/// Tokens visuales compartidos (v1 acotado).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct ThemeTokenSet {
    pub accent: String,
    pub background: String,
    pub surface: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub border: String,
    pub radius_base: u8,
    pub blur_enabled: bool,
    pub blur_size: u8,
    pub blur_passes: u8,
    pub font_family: String,
    pub font_size: u8,
}

/// Preset completo (builtin embebido o futuro usuario).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct ThemePreset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub builtin: bool,
    pub dark: ThemeTokenSet,
    pub light: ThemeTokenSet,
}

/// Resumen para listados en UI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct ThemePresetSummary {
    pub id: String,
    pub name: String,
    pub builtin: bool,
    pub variants: Vec<ThemeVariant>,
}

impl ThemePreset {
    pub fn summary(&self) -> ThemePresetSummary {
        ThemePresetSummary {
            id: self.id.clone(),
            name: self.name.clone(),
            builtin: self.builtin,
            variants: vec![ThemeVariant::Dark, ThemeVariant::Light],
        }
    }

    pub fn tokens(&self, variant: ThemeVariant) -> &ThemeTokenSet {
        match variant {
            ThemeVariant::Dark => &self.dark,
            ThemeVariant::Light => &self.light,
        }
    }
}

/// Fusiona tokens de tema sobre una copia de `base`, conservando layout (gaps, módulos, modi).
///
/// No modifica `appearance.theme` (el llamador suele fijarlo al id del preset tras aplicar).
pub fn apply_tokens_to_settings(base: &AppSettings, tokens: &ThemeTokenSet) -> AppSettings {
    let mut s = base.clone();

    s.appearance.accent_color = tokens.accent.clone();
    s.appearance.font_family = tokens.font_family.clone();
    s.appearance.font_size = tokens.font_size;

    s.hyprland.active_border_color = tokens.accent.clone();
    s.hyprland.inactive_border_color = tokens.border.clone();
    s.hyprland.rounding = tokens.radius_base.min(32);
    s.hyprland.blur_enabled = tokens.blur_enabled;
    s.hyprland.blur_size = tokens.blur_size.min(16);
    s.hyprland.blur_passes = tokens.blur_passes.clamp(1, 8);

    s.waybar.bar_background = tokens.background.clone();
    s.waybar.bar_foreground = tokens.text_primary.clone();
    s.waybar.module_background = tokens.surface.clone();
    s.waybar.accent = tokens.accent.clone();

    s.rofi.vis_bg = tokens.surface.clone();
    s.rofi.vis_fg = tokens.text_primary.clone();
    s.rofi.vis_accent = tokens.accent.clone();
    s.rofi.vis_border = tokens.border.clone();
    s.rofi.vis_input_bg = tokens.background.clone();
    s.rofi.border_radius = tokens.radius_base.min(24);
    s.rofi.font = format!("{} {}", tokens.font_family, tokens.font_size);

    s
}

/// Presets builtin mínimos (Nord-inspired).
pub fn builtin_presets() -> Vec<ThemePreset> {
    vec![
        ThemePreset {
            id: "nord".into(),
            name: "Nord".into(),
            description: "Paleta Nord clásica (dark / light).".into(),
            builtin: true,
            dark: ThemeTokenSet {
                accent: "#88c0d0".into(),
                background: "#2e3440".into(),
                surface: "#3b4252".into(),
                text_primary: "#eceff4".into(),
                text_secondary: "#d8dee9".into(),
                border: "#4c566a".into(),
                radius_base: 8,
                blur_enabled: true,
                blur_size: 4,
                blur_passes: 2,
                font_family: "Inter".into(),
                font_size: 11,
            },
            light: ThemeTokenSet {
                accent: "#5e81ac".into(),
                background: "#eceff4".into(),
                surface: "#e5e9f0".into(),
                text_primary: "#2e3440".into(),
                text_secondary: "#3b4252".into(),
                border: "#d8dee9".into(),
                radius_base: 8,
                blur_enabled: false,
                blur_size: 3,
                blur_passes: 2,
                font_family: "Inter".into(),
                font_size: 11,
            },
        },
        ThemePreset {
            id: "graphite".into(),
            name: "Graphite".into(),
            description: "Grises neutros con acento teal.".into(),
            builtin: true,
            dark: ThemeTokenSet {
                accent: "#2dd4bf".into(),
                background: "#1a1a1e".into(),
                surface: "#27272a".into(),
                text_primary: "#fafafa".into(),
                text_secondary: "#a1a1aa".into(),
                border: "#3f3f46".into(),
                radius_base: 6,
                blur_enabled: true,
                blur_size: 5,
                blur_passes: 2,
                font_family: "Inter".into(),
                font_size: 11,
            },
            light: ThemeTokenSet {
                accent: "#0d9488".into(),
                background: "#f4f4f5".into(),
                surface: "#e4e4e7".into(),
                text_primary: "#18181b".into(),
                text_secondary: "#52525b".into(),
                border: "#d4d4d8".into(),
                radius_base: 6,
                blur_enabled: false,
                blur_size: 3,
                blur_passes: 2,
                font_family: "Inter".into(),
                font_size: 11,
            },
        },
    ]
}

pub fn find_builtin_preset(id: &str) -> Option<ThemePreset> {
    builtin_presets().into_iter().find(|p| p.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_tokens_preserves_gaps_and_modules() {
        let mut base = AppSettings::default();
        base.hyprland.gaps_in = 99;
        base.waybar.modules_left = vec!["custom/foo".into()];
        let tokens = nord().dark.clone();
        let out = apply_tokens_to_settings(&base, &tokens);
        assert_eq!(out.hyprland.gaps_in, 99);
        assert_eq!(out.waybar.modules_left, vec!["custom/foo".to_string()]);
        assert_eq!(out.hyprland.active_border_color, tokens.accent);
    }

    fn nord() -> ThemePreset {
        find_builtin_preset("nord").expect("nord")
    }
}
