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

/// Atajo de teclado Hyprland (`bind = …`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct HyprlandBind {
    pub modifiers: Vec<String>,
    pub key: String,
    pub dispatcher: String,
    pub args: String,
    pub description: String,
    pub enabled: bool,
}

impl Default for HyprlandBind {
    fn default() -> Self {
        Self {
            modifiers: vec!["SUPER".into()],
            key: String::new(),
            dispatcher: "exec".into(),
            args: String::new(),
            description: String::new(),
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct HyprlandKeyboardSettings {
    pub binds: Vec<HyprlandBind>,
}

impl Default for HyprlandKeyboardSettings {
    fn default() -> Self {
        Self { binds: Vec::new() }
    }
}

/// Regla de ventana (`windowrulev2 = …`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct HyprlandWindowRule {
    pub rule: String,
    pub class: String,
    pub title: String,
    pub description: String,
    pub enabled: bool,
}

impl Default for HyprlandWindowRule {
    fn default() -> Self {
        Self {
            rule: String::new(),
            class: String::new(),
            title: String::new(),
            description: String::new(),
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct HyprlandWindowSettings {
    pub rules: Vec<HyprlandWindowRule>,
}

impl Default for HyprlandWindowSettings {
    fn default() -> Self {
        Self { rules: Vec::new() }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct HyprlandInputSettings {
    pub kb_layout: String,
    pub kb_variant: String,
    pub kb_options: String,
    pub mouse_sensitivity: f32,
    pub natural_scroll: bool,
    pub touchpad_natural_scroll: bool,
}

impl Default for HyprlandInputSettings {
    fn default() -> Self {
        Self {
            kb_layout: "us".into(),
            kb_variant: String::new(),
            kb_options: String::new(),
            mouse_sensitivity: 0.0,
            natural_scroll: false,
            touchpad_natural_scroll: false,
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
    #[serde(default)]
    pub keyboard: HyprlandKeyboardSettings,
    #[serde(default)]
    pub windows: HyprlandWindowSettings,
    #[serde(default)]
    pub input: HyprlandInputSettings,
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
            keyboard: HyprlandKeyboardSettings::default(),
            windows: HyprlandWindowSettings::default(),
            input: HyprlandInputSettings::default(),
        }
    }
}

/// Configuración de la barra Waybar.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WaybarSettings {
    pub position: String,
    pub height: u8,
    /// Color de fondo de la barra (`#rrggbb`).
    pub bar_background: String,
    /// Color de texto/iconos principal en la barra.
    pub bar_foreground: String,
    /// Fondo de módulos (workspace, etc.).
    pub module_background: String,
    /// Acento (workspace activo, estados destacados).
    pub accent: String,
    pub modules_left: Vec<String>,
    pub modules_center: Vec<String>,
    pub modules_right: Vec<String>,
}

impl Default for WaybarSettings {
    fn default() -> Self {
        Self {
            position: "top".into(),
            height: 32,
            bar_background: "#2e3440".into(),
            bar_foreground: "#eceff4".into(),
            module_background: "#3b4252".into(),
            accent: "#88c0d0".into(),
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
    // —— Tema visual (generado en el bloque `* { }` del .rasi)
    pub vis_bg: String,
    pub vis_fg: String,
    pub vis_accent: String,
    pub vis_border: String,
    pub vis_input_bg: String,
    pub border_radius: u8,
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
            vis_bg: "#2e3440".into(),
            vis_fg: "#d8dee9".into(),
            vis_accent: "#88c0d0".into(),
            vis_border: "#4c566a".into(),
            vis_input_bg: "#3b4252".into(),
            border_radius: 8,
        }
    }
}

/// Preferencias de wallpaper persistidas (sin rutas arbitrarias; solo ids emitidos por el backend).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct WallpaperAppPreferences {
    pub last_applied_wallpaper_id: Option<String>,
    pub last_successful_apply_at: Option<String>,
}

impl Default for WallpaperAppPreferences {
    fn default() -> Self {
        Self {
            last_applied_wallpaper_id: None,
            last_successful_apply_at: None,
        }
    }
}

/// Configuración completa de la aplicación.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct AppSettings {
    pub appearance: AppearanceSettings,
    pub hyprland: HyprlandSettings,
    pub waybar: WaybarSettings,
    pub rofi: RofiSettings,
    /// Omisión en `settings.toml` legados → `Default`.
    #[serde(default)]
    pub wallpaper: WallpaperAppPreferences,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            appearance: AppearanceSettings::default(),
            hyprland: HyprlandSettings::default(),
            waybar: WaybarSettings::default(),
            rofi: RofiSettings::default(),
            wallpaper: WallpaperAppPreferences::default(),
        }
    }
}
