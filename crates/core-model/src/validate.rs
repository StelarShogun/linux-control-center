use crate::{
    error::CoreError,
    settings::AppSettings,
    wallpaper::validate_wallpaper_id,
};

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
    validate_wallpaper_prefs(settings)?;
    Ok(())
}

fn validate_wallpaper_prefs(settings: &AppSettings) -> Result<(), CoreError> {
    if let Some(ref id) = settings.wallpaper.last_applied_wallpaper_id {
        validate_wallpaper_id(id).map_err(|e| CoreError::Validation(format!("wallpaper: {e}")))?;
    }
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
    if !(-1.0..=1.0).contains(&h.input.mouse_sensitivity) {
        return Err(CoreError::Validation(
            "hyprland.input.mouse_sensitivity must be between -1.0 and 1.0".into(),
        ));
    }
    let mut seen_bezier: std::collections::HashSet<&str> = std::collections::HashSet::new();
    for (i, c) in h.bezier_curves.iter().enumerate() {
        let n = c.name.trim();
        if n.is_empty() {
            return Err(CoreError::Validation(format!(
                "hyprland.bezier_curves[{i}].name cannot be empty"
            )));
        }
        if n.contains('\n') || n.contains('\r') {
            return Err(CoreError::Validation(
                "hyprland bezier curve name must not contain newlines".into(),
            ));
        }
        if !seen_bezier.insert(n) {
            return Err(CoreError::Validation(format!(
                "duplicate hyprland bezier curve name: {n}"
            )));
        }
        for (label, v) in [("x1", c.x1), ("y1", c.y1), ("x2", c.x2), ("y2", c.y2)] {
            if !(-10.0..=10.0).contains(&v) {
                return Err(CoreError::Validation(format!(
                    "hyprland.bezier_curves[{i}].{label} out of supported range"
                )));
            }
        }
    }
    const ALLOWED_BIND_TYPES: &[&str] = &[
        "bind", "bindl", "binde", "bindm", "bindle", "bindlr", "bindlte", "bindp", "bindpt",
        "bindd", "binddr",
    ];
    for (i, b) in h.keyboard.binds.iter().enumerate() {
        let bt = b.bind_type.trim();
        if !bt.is_empty() && !ALLOWED_BIND_TYPES.contains(&bt) {
            return Err(CoreError::Validation(format!(
                "hyprland.keyboard.binds[{i}].bind_type is not a known Hyprland bind keyword"
            )));
        }
        if b.enabled {
            if b.key.trim().is_empty() {
                return Err(CoreError::Validation(format!(
                    "hyprland.keyboard.binds[{i}].key cannot be empty when enabled"
                )));
            }
            if b.dispatcher.trim().is_empty() {
                return Err(CoreError::Validation(format!(
                    "hyprland.keyboard.binds[{i}].dispatcher cannot be empty when enabled"
                )));
            }
        }
        for field in [&b.key, &b.dispatcher, &b.args] {
            if field.contains('\n') || field.contains('\r') {
                return Err(CoreError::Validation(
                    "hyprland keyboard bind fields must not contain newlines".into(),
                ));
            }
        }
    }
    for (i, r) in h.windows.rules.iter().enumerate() {
        if r.enabled && r.rule.trim().is_empty() {
            return Err(CoreError::Validation(format!(
                "hyprland.windows.rules[{i}].rule cannot be empty when enabled"
            )));
        }
        if r.rule.contains('\n') || r.class.contains('\n') || r.title.contains('\n') {
            return Err(CoreError::Validation(
                "hyprland window rule fields must not contain newlines".into(),
            ));
        }
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
    for (label, c) in [
        ("waybar.bar_background", &w.bar_background),
        ("waybar.bar_foreground", &w.bar_foreground),
        ("waybar.module_background", &w.module_background),
        ("waybar.accent", &w.accent),
    ] {
        if !c.starts_with('#') {
            return Err(CoreError::Validation(format!("{label} must start with '#'")));
        }
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
    for (label, c) in [
        ("rofi.vis_bg", &r.vis_bg),
        ("rofi.vis_fg", &r.vis_fg),
        ("rofi.vis_accent", &r.vis_accent),
        ("rofi.vis_border", &r.vis_border),
        ("rofi.vis_input_bg", &r.vis_input_bg),
    ] {
        if !c.starts_with('#') {
            return Err(CoreError::Validation(format!("{label} must start with '#'")));
        }
    }
    if r.border_radius == 0 {
        return Err(CoreError::Validation(
            "rofi.border_radius must be > 0".into(),
        ));
    }
    Ok(())
}
