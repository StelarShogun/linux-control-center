use core_model::settings::WaybarSettings;

/// Lee `~/.config/waybar/config.jsonc` y extrae los campos que modela
/// `WaybarSettings`. Cualquier campo ausente o no parseable queda en `Default`.
/// Nunca propaga errores de I/O al llamador.
pub fn read_from_system() -> WaybarSettings {
    let path = match dirs_path() {
        Some(p) => p,
        None => return WaybarSettings::default(),
    };

    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return WaybarSettings::default(),
    };

    parse_waybar_config(&content)
}

fn dirs_path() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    // Waybar acepta tanto config.jsonc como config
    let base = std::path::PathBuf::from(home).join(".config/waybar");
    for name in &["config.jsonc", "config"] {
        let p = base.join(name);
        if p.exists() {
            return Some(p);
        }
    }
    // Si ninguno existe devolvemos la ruta preferida para que el read falle limpiamente
    Some(base.join("config.jsonc"))
}

/// Parsea el contenido JSONC de waybar config.
///
/// JSONC puede tener comentarios `//` de línea y `/* … */` de bloque.
/// Se eliminan antes de parsear con `serde_json`.
pub fn parse_waybar_config(content: &str) -> WaybarSettings {
    let stripped = strip_jsonc_comments(content);
    let value: serde_json::Value = match serde_json::from_str(&stripped) {
        Ok(v) => v,
        Err(_) => return WaybarSettings::default(),
    };

    extract_waybar_settings(&value)
}

fn extract_waybar_settings(v: &serde_json::Value) -> WaybarSettings {
    let mut s = WaybarSettings::default();

    if let Some(pos) = v.get("position").and_then(|x| x.as_str()) {
        s.position = pos.to_string();
    }

    if let Some(h) = v.get("height").and_then(|x| x.as_u64()) {
        s.height = h.min(255) as u8;
    }

    if let Some(arr) = v.get("modules-left").and_then(|x| x.as_array()) {
        s.modules_left = json_str_array(arr);
    }

    if let Some(arr) = v.get("modules-center").and_then(|x| x.as_array()) {
        s.modules_center = json_str_array(arr);
    }

    if let Some(arr) = v.get("modules-right").and_then(|x| x.as_array()) {
        s.modules_right = json_str_array(arr);
    }

    s
}

fn json_str_array(arr: &[serde_json::Value]) -> Vec<String> {
    arr.iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect()
}

/// Elimina comentarios de estilo JSONC:
/// - Comentarios de línea `//` (fuera de strings)
/// - Comentarios de bloque `/* … */` (fuera de strings)
///
/// Implementación simple y sin dependencias externas; adecuada para
/// archivos de configuración reales (no código JavaScript arbitrario).
fn strip_jsonc_comments(src: &str) -> String {
    let mut out = String::with_capacity(src.len());
    let chars: Vec<char> = src.chars().collect();
    let len = chars.len();
    let mut i = 0;
    let mut in_string = false;
    let mut escaped = false;

    while i < len {
        let c = chars[i];

        if escaped {
            out.push(c);
            escaped = false;
            i += 1;
            continue;
        }

        if in_string {
            if c == '\\' {
                escaped = true;
                out.push(c);
            } else if c == '"' {
                in_string = false;
                out.push(c);
            } else {
                out.push(c);
            }
            i += 1;
            continue;
        }

        // Outside string
        if c == '"' {
            in_string = true;
            out.push(c);
            i += 1;
            continue;
        }

        // Line comment //
        if c == '/' && i + 1 < len && chars[i + 1] == '/' {
            // Skip until end of line
            while i < len && chars[i] != '\n' {
                i += 1;
            }
            continue;
        }

        // Block comment /* … */
        if c == '/' && i + 1 < len && chars[i + 1] == '*' {
            i += 2;
            while i + 1 < len && !(chars[i] == '*' && chars[i + 1] == '/') {
                if chars[i] == '\n' {
                    out.push('\n'); // preserve newlines for line numbers
                }
                i += 1;
            }
            i += 2; // skip */
            continue;
        }

        out.push(c);
        i += 1;
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
// Waybar config
{
    "layer": "top",
    "position": "bottom", // bar at bottom
    "height": 40,
    /* modules */
    "modules-left": ["hyprland/workspaces", "hyprland/window"],
    "modules-center": ["clock"],
    "modules-right": ["network", "cpu", "tray"],

    "clock": {
        "format": "{:%H:%M}"
    }
}
"#;

    #[test]
    fn parses_position_and_height() {
        let s = parse_waybar_config(SAMPLE);
        assert_eq!(s.position, "bottom");
        assert_eq!(s.height, 40);
    }

    #[test]
    fn parses_module_arrays() {
        let s = parse_waybar_config(SAMPLE);
        assert_eq!(s.modules_left, vec!["hyprland/workspaces", "hyprland/window"]);
        assert_eq!(s.modules_center, vec!["clock"]);
        assert_eq!(s.modules_right, vec!["network", "cpu", "tray"]);
    }

    #[test]
    fn empty_content_returns_defaults() {
        let s = parse_waybar_config("");
        let d = WaybarSettings::default();
        assert_eq!(s.position, d.position);
    }

    #[test]
    fn invalid_json_returns_defaults() {
        let s = parse_waybar_config("{ not valid }");
        let d = WaybarSettings::default();
        assert_eq!(s.height, d.height);
    }

    #[test]
    fn strips_line_comments() {
        let src = "{ \"key\": 1 // comment\n}";
        let stripped = strip_jsonc_comments(src);
        assert!(!stripped.contains("comment"));
        assert!(stripped.contains("\"key\": 1"));
    }

    #[test]
    fn strips_block_comments() {
        let src = "{ /* block */ \"key\": 2 }";
        let stripped = strip_jsonc_comments(src);
        assert!(!stripped.contains("block"));
        assert!(stripped.contains("\"key\": 2"));
    }
}
