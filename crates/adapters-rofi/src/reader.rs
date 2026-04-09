use core_model::settings::RofiSettings;

/// Lee `~/.config/rofi/config.rasi` y extrae los campos que modela
/// `RofiSettings`. Cualquier campo ausente o no parseable queda en `Default`.
/// Nunca propaga errores de I/O al llamador.
pub fn read_from_system() -> RofiSettings {
    let path = match dirs_path() {
        Some(p) => p,
        None => return RofiSettings::default(),
    };

    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return RofiSettings::default(),
    };

    parse_rofi_config(&content)
}

fn dirs_path() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(std::path::PathBuf::from(home).join(".config/rofi/config.rasi"))
}

/// Parsea el bloque `configuration { … }` de un archivo `.rasi` y extrae
/// los campos que cubre `RofiSettings`. Ignora todos los demás bloques.
///
/// Formato de cada entrada dentro del bloque:
/// ```text
/// key: "string value";
/// key: unquoted_value;
/// key: true;
/// ```
pub fn parse_rofi_config(content: &str) -> RofiSettings {
    let mut s = RofiSettings::default();

    let block = match extract_configuration_block(content) {
        Some(b) => b,
        None => return s,
    };

    for line in block.lines() {
        let trimmed = strip_rasi_comment(line).trim().to_string();
        if trimmed.is_empty() {
            continue;
        }

        if let Some((key, value)) = split_rasi_pair(&trimmed) {
            apply_field(&mut s, key, value);
        }
    }

    s
}

/// Extrae el contenido interno del bloque `configuration { … }`.
/// Solo el primer bloque con ese nombre.
///
/// Rastrea profundidad de llaves y contexto de strings para no confundir
/// valores como `"{name} [{generic}]"` con el cierre del bloque.
fn extract_configuration_block(content: &str) -> Option<String> {
    let start_marker = "configuration";
    let start_pos = content.find(start_marker)?;
    let after_kw = &content[start_pos + start_marker.len()..];

    // Encontrar la llave de apertura `{`
    let brace_pos = after_kw.find('{')?;
    let inside_start = start_pos + start_marker.len() + brace_pos + 1;
    let inner_content = &content[inside_start..];

    // Recorrer char a char rastreando strings y profundidad de llaves
    let mut depth = 1i32;
    let mut in_string = false;
    let mut escaped = false;
    let mut end_byte = inner_content.len();

    for (i, c) in inner_content.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if in_string {
            match c {
                '\\' => escaped = true,
                '"' => in_string = false,
                _ => {}
            }
            continue;
        }
        match c {
            '"' => in_string = true,
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    end_byte = i;
                    break;
                }
            }
            _ => {}
        }
    }

    Some(inner_content[..end_byte].to_string())
}

/// Elimina comentarios `//` y `/* … */` de una línea (simplificado para `.rasi`).
fn strip_rasi_comment(line: &str) -> &str {
    // Los archivos .rasi suelen usar /* */ para comentarios de bloque
    // y // no es parte del estándar, pero Rofi lo acepta en la práctica.
    if let Some(pos) = line.find("//") {
        return &line[..pos];
    }
    // Comentarios de bloque en la misma línea: /* ... */
    // Caso simple: si la línea empieza con /* la ignoramos
    if line.trim_start().starts_with("/*") {
        return "";
    }
    line
}

/// Divide `"key: value;"` devolviendo `(key_trimmed, value_unquoted_trimmed)`.
fn split_rasi_pair(line: &str) -> Option<(&str, String)> {
    let pos = line.find(':')?;
    let key = line[..pos].trim();
    let rest = line[pos + 1..].trim();
    // Quitar el punto y coma final
    let rest = rest.strip_suffix(';').unwrap_or(rest).trim();
    // Quitar comillas
    let value = rest.trim_matches('"').to_string();
    if key.is_empty() {
        return None;
    }
    Some((key, value))
}

fn apply_field(s: &mut RofiSettings, key: &str, value: String) {
    match key {
        "modi" => s.modi = value,
        "font" => s.font = value,
        "show-icons" => {
            s.show_icons = matches!(value.to_lowercase().as_str(), "true" | "1" | "yes");
        }
        "icon-theme" => s.icon_theme = value,
        "display-drun" => s.display_drun = value,
        "display-run" => s.display_run = value,
        "display-window" => s.display_window = value,
        "drun-display-format" => s.drun_display_format = value,
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
/* Rofi config */
configuration {
    modi:               "drun,run,filebrowser";
    show-icons:         true;
    icon-theme:         "Papirus-Dark";
    display-drun:       "Apps";
    display-run:        "Exec";
    display-window:     "Win";
    drun-display-format: "{name} [{generic}]";
    font:               "JetBrains Mono 12";
}

* {
    bg: #2e3440;
}
"#;

    #[test]
    fn parses_modi() {
        let s = parse_rofi_config(SAMPLE);
        assert_eq!(s.modi, "drun,run,filebrowser");
    }

    #[test]
    fn parses_font() {
        let s = parse_rofi_config(SAMPLE);
        assert_eq!(s.font, "JetBrains Mono 12");
    }

    #[test]
    fn parses_show_icons() {
        let s = parse_rofi_config(SAMPLE);
        assert!(s.show_icons);
    }

    #[test]
    fn parses_icon_theme() {
        let s = parse_rofi_config(SAMPLE);
        assert_eq!(s.icon_theme, "Papirus-Dark");
    }

    #[test]
    fn parses_display_fields() {
        let s = parse_rofi_config(SAMPLE);
        assert_eq!(s.display_drun, "Apps");
        assert_eq!(s.display_run, "Exec");
        assert_eq!(s.display_window, "Win");
        assert_eq!(s.drun_display_format, "{name} [{generic}]");
    }

    #[test]
    fn no_config_block_returns_defaults() {
        let s = parse_rofi_config("* { bg: #000000; }");
        let d = RofiSettings::default();
        assert_eq!(s.modi, d.modi);
    }

    #[test]
    fn empty_content_returns_defaults() {
        let s = parse_rofi_config("");
        let d = RofiSettings::default();
        assert_eq!(s.font, d.font);
    }
}
