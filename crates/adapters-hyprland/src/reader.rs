use core_model::settings::{HyprlandBind, HyprlandSettings, HyprlandWindowRule};

/// Lee `~/.config/hypr/hyprland.conf` y extrae los campos que modela
/// `HyprlandSettings`. Cualquier campo ausente o no parseable queda en `Default`.
/// Nunca propaga errores de I/O al llamador.
pub fn read_from_system() -> HyprlandSettings {
    let path = match dirs_path() {
        Some(p) => p,
        None => return HyprlandSettings::default(),
    };

    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return HyprlandSettings::default(),
    };

    parse_hyprland_conf(&content)
}

fn dirs_path() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(std::path::PathBuf::from(home).join(".config/hypr/hyprland.conf"))
}

/// Parsea el contenido de hyprland.conf y extrae `HyprlandSettings`.
///
/// El formato de Hyprland usa bloques anidados `name { … }` y asignaciones `key = value`.
/// Solo se procesan los bloques y campos que el modelo conoce; el resto se ignora.
pub fn parse_hyprland_conf(content: &str) -> HyprlandSettings {
    let mut s = HyprlandSettings::default();

    // Pila de nombres de bloque activos. Ejemplo: ["decoration", "blur"]
    let mut block_stack: Vec<String> = Vec::new();

    for line in content.lines() {
        let trimmed = strip_comment(line).trim().to_string();

        if trimmed.is_empty() {
            continue;
        }

        if block_stack.is_empty() {
            if let Some(rest) = trimmed
                .strip_prefix("bind =")
                .or_else(|| trimmed.strip_prefix("bind="))
            {
                if let Some(b) = parse_bind_value(rest.trim()) {
                    s.keyboard.binds.push(b);
                }
                continue;
            }
            let wr_key = trimmed
                .split_whitespace()
                .next()
                .unwrap_or("")
                .to_lowercase();
            if wr_key == "windowrulev2" {
                if let Some(eq) = trimmed.find('=') {
                    let rest = trimmed[eq + 1..].trim();
                    if let Some(rule) = parse_windowrulev2(rest) {
                        s.windows.rules.push(rule);
                    }
                }
                continue;
            }
        }

        // Detectar apertura de bloque: "name {" o "name{"
        if trimmed.ends_with('{') {
            let name = trimmed.trim_end_matches('{').trim().to_lowercase();
            block_stack.push(name);
            continue;
        }

        // Detectar cierre de bloque
        if trimmed == "}" {
            block_stack.pop();
            continue;
        }

        // Asignación: "key = value"
        if let Some((key, value)) = split_assignment(&trimmed) {
            apply_field(&mut s, &block_stack, key, value);
        }
    }

    s
}

/// Elimina comentarios `#` de una línea.
fn strip_comment(line: &str) -> &str {
    match line.find('#') {
        Some(pos) => &line[..pos],
        None => line,
    }
}

/// Divide `"key = value"` devolviendo `(key_trimmed, value_trimmed)`.
fn split_assignment(line: &str) -> Option<(&str, &str)> {
    let pos = line.find('=')?;
    let key = line[..pos].trim();
    let value = line[pos + 1..].trim();
    if key.is_empty() {
        return None;
    }
    Some((key, value))
}

fn apply_field(s: &mut HyprlandSettings, stack: &[String], key: &str, value: &str) {
    match stack {
        // general { key = value }
        [block] if block == "general" => match key {
            "gaps_in" => s.gaps_in = parse_u8(value).unwrap_or(s.gaps_in),
            "gaps_out" => s.gaps_out = parse_u8(value).unwrap_or(s.gaps_out),
            "border_size" => s.border_size = parse_u8(value).unwrap_or(s.border_size),
            "col.active_border" => {
                if let Some(hex) = parse_hyprland_color(value) {
                    s.active_border_color = hex;
                }
            }
            "col.inactive_border" => {
                if let Some(hex) = parse_hyprland_color(value) {
                    s.inactive_border_color = hex;
                }
            }
            _ => {}
        },

        // decoration { key = value }
        [block] if block == "decoration" => {
            if key == "rounding" {
                s.rounding = parse_u8(value).unwrap_or(s.rounding);
            }
        }

        // decoration { blur { key = value } }
        [outer, inner] if outer == "decoration" && inner == "blur" => match key {
            "enabled" => s.blur_enabled = parse_bool(value).unwrap_or(s.blur_enabled),
            "size" => s.blur_size = parse_u8(value).unwrap_or(s.blur_size),
            "passes" => s.blur_passes = parse_u8(value).unwrap_or(s.blur_passes),
            _ => {}
        },

        // animations { enabled = … }
        [block] if block == "animations" => {
            if key == "enabled" {
                s.animations_enabled = parse_bool(value).unwrap_or(s.animations_enabled);
            }
        }

        // input { … }
        [block] if block == "input" => match key {
            "kb_layout" => s.input.kb_layout = value.to_string(),
            "kb_variant" => s.input.kb_variant = value.to_string(),
            "kb_options" => s.input.kb_options = value.to_string(),
            "sensitivity" => {
                if let Ok(f) = value.trim().parse::<f32>() {
                    s.input.mouse_sensitivity = f;
                }
            }
            "natural_scroll" => {
                s.input.natural_scroll = parse_bool(value).unwrap_or(s.input.natural_scroll);
            }
            _ => {}
        },

        [outer, inner] if outer == "input" && inner == "touchpad" => {
            if key == "natural_scroll" {
                s.input.touchpad_natural_scroll =
                    parse_bool(value).unwrap_or(s.input.touchpad_natural_scroll);
            }
        }

        _ => {}
    }
}

fn parse_bind_value(v: &str) -> Option<HyprlandBind> {
    let parts: Vec<&str> = v
        .split(',')
        .map(|x| x.trim())
        .filter(|x| !x.is_empty())
        .collect();
    if parts.len() < 3 {
        return None;
    }
    let mods: Vec<String> = parts[0]
        .split_whitespace()
        .filter(|x| !x.is_empty())
        .map(str::to_string)
        .collect();
    Some(HyprlandBind {
        modifiers: mods,
        key: parts[1].to_string(),
        dispatcher: parts[2].to_string(),
        args: if parts.len() > 3 {
            parts[3..].join(", ")
        } else {
            String::new()
        },
        description: String::new(),
        enabled: true,
    })
}

fn parse_windowrulev2(v: &str) -> Option<HyprlandWindowRule> {
    let segments: Vec<&str> = v
        .split(',')
        .map(|x| x.trim())
        .filter(|x| !x.is_empty())
        .collect();
    if segments.is_empty() {
        return None;
    }
    let mut rule = HyprlandWindowRule {
        rule: segments[0].to_string(),
        class: String::new(),
        title: String::new(),
        description: String::new(),
        enabled: true,
    };
    for seg in segments.iter().skip(1) {
        let seg = seg.trim();
        if let Some(rest) = seg.strip_prefix("class:") {
            rule.class = rest.trim().to_string();
        } else if let Some(rest) = seg.strip_prefix("title:") {
            rule.title = rest.trim().to_string();
        }
    }
    Some(rule)
}

/// Convierte valores Hyprland `rgba(HHHHHHff)` o `rgb(HHHHHH)` a `#HHHHHH`.
/// También acepta `0xHHHHHHff` / `0xHHHHHH`.
fn parse_hyprland_color(value: &str) -> Option<String> {
    let v = value.trim();

    // rgba(88c0d0ff) o rgba(88c0d0FF)
    if let Some(inner) = v.strip_prefix("rgba(").and_then(|s| s.strip_suffix(')')) {
        // Tomar los primeros 6 dígitos hex (ignorar alpha)
        if inner.len() >= 6 {
            return Some(format!("#{}", &inner[..6].to_lowercase()));
        }
    }

    // rgb(88c0d0)
    if let Some(inner) = v.strip_prefix("rgb(").and_then(|s| s.strip_suffix(')')) {
        if inner.len() == 6 {
            return Some(format!("#{}", inner.to_lowercase()));
        }
    }

    // 0xHHHHHHff o 0xHHHHHH
    if let Some(hex) = v.strip_prefix("0x").or_else(|| v.strip_prefix("0X")) {
        if hex.len() >= 6 {
            return Some(format!("#{}", &hex[..6].to_lowercase()));
        }
    }

    // #HHHHHH directo
    if v.starts_with('#') && v.len() == 7 {
        return Some(v.to_lowercase());
    }

    None
}

fn parse_u8(value: &str) -> Option<u8> {
    value.trim().parse().ok()
}

fn parse_bool(value: &str) -> Option<bool> {
    match value.trim().to_lowercase().as_str() {
        "true" | "yes" | "1" => Some(true),
        "false" | "no" | "0" => Some(false),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
general {
    gaps_in = 6
    gaps_out = 12
    border_size = 3
    col.active_border = rgba(a3be8cff)
    col.inactive_border = rgba(4c566aff)
    layout = dwindle
}

decoration {
    rounding = 10
    blur {
        enabled = false
        size = 8
        passes = 3
    }
    drop_shadow = true
}

animations {
    enabled = false
    bezier = easeOut, 0.05, 0.9, 0.1, 1.0
}

input {
    kb_layout = es
    sensitivity = -0.25
    natural_scroll = true
    touchpad {
        natural_scroll = false
    }
}

bind = SUPER, Q, exec, foot
windowrulev2 = float, class:^(kitty)$
"#;

    #[test]
    fn parses_general_block() {
        let s = parse_hyprland_conf(SAMPLE);
        assert_eq!(s.gaps_in, 6);
        assert_eq!(s.gaps_out, 12);
        assert_eq!(s.border_size, 3);
        assert_eq!(s.active_border_color, "#a3be8c");
        assert_eq!(s.inactive_border_color, "#4c566a");
    }

    #[test]
    fn parses_decoration_and_blur() {
        let s = parse_hyprland_conf(SAMPLE);
        assert_eq!(s.rounding, 10);
        assert!(!s.blur_enabled);
        assert_eq!(s.blur_size, 8);
        assert_eq!(s.blur_passes, 3);
    }

    #[test]
    fn parses_animations() {
        let s = parse_hyprland_conf(SAMPLE);
        assert!(!s.animations_enabled);
    }

    #[test]
    fn parses_input_bind_and_windowrule() {
        let s = parse_hyprland_conf(SAMPLE);
        assert_eq!(s.input.kb_layout, "es");
        assert!((s.input.mouse_sensitivity - (-0.25_f32)).abs() < 1e-4);
        assert!(s.input.natural_scroll);
        assert!(!s.input.touchpad_natural_scroll);
        assert_eq!(s.keyboard.binds.len(), 1);
        assert_eq!(s.keyboard.binds[0].key, "Q");
        assert_eq!(s.keyboard.binds[0].dispatcher, "exec");
        assert_eq!(s.keyboard.binds[0].args, "foot");
        assert_eq!(s.windows.rules.len(), 1);
        assert_eq!(s.windows.rules[0].rule, "float");
        assert_eq!(s.windows.rules[0].class, "^(kitty)$");
    }

    #[test]
    fn color_rgba_parses() {
        assert_eq!(
            parse_hyprland_color("rgba(88c0d0ff)"),
            Some("#88c0d0".to_string())
        );
    }

    #[test]
    fn color_0x_parses() {
        assert_eq!(
            parse_hyprland_color("0x88c0d0ff"),
            Some("#88c0d0".to_string())
        );
    }

    #[test]
    fn empty_conf_returns_defaults() {
        let s = parse_hyprland_conf("");
        let d = HyprlandSettings::default();
        assert_eq!(s.gaps_in, d.gaps_in);
    }
}
