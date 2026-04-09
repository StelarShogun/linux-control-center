use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Configuración de apariencia global del sistema.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct AppearanceSettings {
    pub theme: String,
    pub accent_color: String,
    pub font_family: String,
    pub font_size: u8,
    pub icon_theme: String,
    pub cursor_theme: String,
    pub cursor_size: u8,
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            accent_color: "#88c0d0".into(),
            font_family: "Inter".into(),
            font_size: 11,
            icon_theme: "Papirus".into(),
            cursor_theme: "Adwaita".into(),
            cursor_size: 24,
        }
    }
}

/// Configuración del compositor Hyprland.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct HyprlandSettings {
    pub gaps_in: u8,
    pub gaps_out: u8,
    pub border_size: u8,
    pub active_border_color: String,
    pub inactive_border_color: String,
    pub rounding: u8,
    pub animations_enabled: bool,
    pub blur_enabled: bool,
    pub blur_size: u8,
    pub blur_passes: u8,
}

impl Default for HyprlandSettings {
    fn default() -> Self {
        Self {
            gaps_in: 4,
            gaps_out: 8,
            border_size: 2,
            active_border_color: "#88c0d0".into(),
            inactive_border_color: "#4c566a".into(),
            rounding: 8,
            animations_enabled: true,
            blur_enabled: true,
            blur_size: 4,
            blur_passes: 2,
        }
    }
}

/// Configuración de la barra Waybar.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WaybarSettings {
    pub position: String,
    pub height: u8,
    pub modules_left: Vec<String>,
    pub modules_center: Vec<String>,
    pub modules_right: Vec<String>,
}

impl Default for WaybarSettings {
    fn default() -> Self {
        Self {
            position: "top".into(),
            height: 32,
            modules_left: vec!["hyprland/workspaces".into(), "hyprland/window".into()],
            modules_center: vec!["clock".into()],
            modules_right: vec![
                "network".into(),
                "cpu".into(),
                "memory".into(),
                "battery".into(),
                "tray".into(),
            ],
        }
    }
}

/// Configuración del launcher Rofi.
/// NOTE: El adapter de Rofi no está implementado en fase 1.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct RofiSettings {
    pub theme: String,
    /// Lista de modos habilitados. Ejemplo: "drun,run,window".
    pub modi: String,
    pub font: String,
    pub show_icons: bool,
    pub icon_theme: String,
    pub display_drun: String,
    pub display_run: String,
    pub display_window: String,
    pub drun_display_format: String,
}

impl Default for RofiSettings {
    fn default() -> Self {
        Self {
            theme: "nord".into(),
            modi: "drun,run,window".into(),
            font: "Inter 11".into(),
            show_icons: true,
            icon_theme: "Papirus".into(),
            display_drun: "Apps".into(),
            display_run: "Run".into(),
            display_window: "Windows".into(),
            drun_display_format: "{name}".into(),
        }
    }
}

/// Configuración completa de la aplicación.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct AppSettings {
    pub appearance: AppearanceSettings,
    pub hyprland: HyprlandSettings,
    pub waybar: WaybarSettings,
    pub rofi: RofiSettings,
}
