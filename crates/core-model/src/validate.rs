use crate::{error::CoreError, settings::AppSettings};

/// Valida los campos clave de `AppSettings`.
///
/// Retorna `Ok(())` si los settings son válidos, o `Err(CoreError::Validation)` con
/// una descripción del primer problema encontrado.
///
/// LIMITATION (fase 1): Solo valida rangos numéricos básicos y strings no vacíos.
/// No valida que los colores sean CSS válidos más allá de un prefijo `#`.
pub fn validate_settings(settings: &AppSettings) -> Result<(), CoreError> {
    validate_appearance(settings)?;
    validate_hyprland(settings)?;
    validate_waybar(settings)?;
    validate_rofi(settings)?;
    Ok(())
}

fn validate_appearance(settings: &AppSettings) -> Result<(), CoreError> {
    let a = &settings.appearance;

    if a.theme.is_empty() {
        return Err(CoreError::Validation("appearance.theme cannot be empty".into()));
    }
    if !a.accent_color.starts_with('#') {
        return Err(CoreError::Validation(
            "appearance.accent_color must start with '#'".into(),
        ));
    }
    if a.font_family.is_empty() {
        return Err(CoreError::Validation(
            "appearance.font_family cannot be empty".into(),
        ));
    }
    if a.font_size == 0 {
        return Err(CoreError::Validation(
            "appearance.font_size must be > 0".into(),
        ));
    }
    if a.cursor_size == 0 {
        return Err(CoreError::Validation(
            "appearance.cursor_size must be > 0".into(),
        ));
    }
    Ok(())
}

fn validate_hyprland(settings: &AppSettings) -> Result<(), CoreError> {
    let h = &settings.hyprland;

    if !h.active_border_color.starts_with('#') {
        return Err(CoreError::Validation(
            "hyprland.active_border_color must start with '#'".into(),
        ));
    }
    if !h.inactive_border_color.starts_with('#') {
        return Err(CoreError::Validation(
            "hyprland.inactive_border_color must start with '#'".into(),
        ));
    }
    if h.blur_passes == 0 && h.blur_enabled {
        return Err(CoreError::Validation(
            "hyprland.blur_passes must be > 0 when blur is enabled".into(),
        ));
    }
    Ok(())
}

fn validate_waybar(settings: &AppSettings) -> Result<(), CoreError> {
    let w = &settings.waybar;

    let valid_positions = ["top", "bottom", "left", "right"];
    if !valid_positions.contains(&w.position.as_str()) {
        return Err(CoreError::Validation(format!(
            "waybar.position must be one of {:?}",
            valid_positions
        )));
    }
    if w.height == 0 {
        return Err(CoreError::Validation("waybar.height must be > 0".into()));
    }
    Ok(())
}

fn validate_rofi(settings: &AppSettings) -> Result<(), CoreError> {
    let r = &settings.rofi;
    if r.theme.is_empty() {
        return Err(CoreError::Validation("rofi.theme cannot be empty".into()));
    }
    if r.modi.is_empty() {
        return Err(CoreError::Validation("rofi.modi cannot be empty".into()));
    }
    if r.font.is_empty() {
        return Err(CoreError::Validation("rofi.font cannot be empty".into()));
    }
    if r.icon_theme.is_empty() {
        return Err(CoreError::Validation("rofi.icon_theme cannot be empty".into()));
    }
    if r.display_drun.is_empty() {
        return Err(CoreError::Validation(
            "rofi.display_drun cannot be empty".into(),
        ));
    }
    if r.display_run.is_empty() {
        return Err(CoreError::Validation("rofi.display_run cannot be empty".into()));
    }
    if r.display_window.is_empty() {
        return Err(CoreError::Validation(
            "rofi.display_window cannot be empty".into(),
        ));
    }
    if r.drun_display_format.is_empty() {
        return Err(CoreError::Validation(
            "rofi.drun_display_format cannot be empty".into(),
        ));
    }
    Ok(())
}
