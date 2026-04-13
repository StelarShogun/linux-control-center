use core_model::settings::{HyprlandBind, HyprlandSettings, HyprlandWindowRule};
use std::collections::{HashSet, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};

/// Lee la cadena de configuración Hyprland (archivo principal, `source`, globs) y fusiona
/// atajos y reglas de todas las fuentes. Los demás campos usan **último archivo gana** en orden
/// de visita (igual que Hyprland al procesar la cadena).
pub fn read_from_system() -> HyprlandSettings {
    let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
        return HyprlandSettings::default();
    };
    let hypr_dir = home.join(".config/hypr");
    let main_conf = hypr_dir.join("hyprland.conf");

    let mut queue: VecDeque<PathBuf> = VecDeque::new();
    if main_conf.is_file() {
        queue.push_back(main_conf);
    } else {
        // Sin hyprland.conf: intentar solo snippets en hyprland.d/
        push_hyprland_d_files(&hypr_dir, &mut queue);
    }

    let mut ordered: Vec<PathBuf> = Vec::new();
    let mut seen: HashSet<PathBuf> = HashSet::new();

    while let Some(path) = queue.pop_front() {
        let real = fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
        if !real.is_file() || !seen.insert(real.clone()) {
            continue;
        }
        ordered.push(real.clone());

        let Ok(content) = fs::read_to_string(&real) else {
            continue;
        };
        let base = real
            .parent()
            .unwrap_or_else(|| hypr_dir.as_path())
            .to_path_buf();
        for spec in extract_source_specs(&content) {
            for candidate in resolve_source_spec(&base, &home, spec.as_str()) {
                if candidate.is_file() {
                    queue.push_back(candidate);
                } else {
                    for g in expand_glob_path(&candidate) {
                        if g.is_file() {
                            queue.push_back(g);
                        }
                    }
                }
            }
        }
    }

    if ordered.is_empty() {
        return HyprlandSettings::default();
    }

    let mut merged = HyprlandSettings::default();
    let mut all_binds: Vec<HyprlandBind> = Vec::new();
    let mut all_rules: Vec<HyprlandWindowRule> = Vec::new();

    for path in &ordered {
        let Ok(text) = fs::read_to_string(path) else {
            continue;
        };
        let part = parse_hyprland_conf(&text);
        all_binds.extend(part.keyboard.binds);
        all_rules.extend(part.windows.rules);
        merged.gaps_in = part.gaps_in;
        merged.gaps_out = part.gaps_out;
        merged.border_size = part.border_size;
        merged.active_border_color = part.active_border_color.clone();
        merged.inactive_border_color = part.inactive_border_color.clone();
        merged.rounding = part.rounding;
        merged.animations_enabled = part.animations_enabled;
        merged.blur_enabled = part.blur_enabled;
        merged.blur_size = part.blur_size;
        merged.blur_passes = part.blur_passes;
        merged.input = part.input.clone();
    }
    merged.keyboard.binds = all_binds;
    merged.windows.rules = all_rules;
    merged
}

fn push_hyprland_d_files(hypr_dir: &Path, queue: &mut VecDeque<PathBuf>) {
    let hyprland_d = hypr_dir.join("hyprland.d");
    if !hyprland_d.is_dir() {
        return;
    }
    let mut extra: Vec<PathBuf> = fs::read_dir(&hyprland_d)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("conf"))
        .collect();
    extra.sort();
    for p in extra {
        queue.push_back(p);
    }
}

/// Líneas `source = …` / `exec-once` ignoradas.
fn extract_source_specs(content: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in content.lines() {
        let t = strip_comment(line).trim();
        let Some(rest) = t
            .strip_prefix("source")
            .map(str::trim_start)
            .and_then(|s| s.strip_prefix('='))
            .map(str::trim)
        else {
            continue;
        };
        let spec = rest.trim_matches('"').trim_matches('\'').trim();
        if !spec.is_empty() {
            out.push(spec.to_string());
        }
    }
    out
}

fn resolve_source_spec(base_dir: &Path, home: &Path, spec: &str) -> Vec<PathBuf> {
    let spec = spec.trim();
    let path = if let Some(tail) = spec.strip_prefix("~/") {
        home.join(tail)
    } else if spec == "~" {
        home.to_path_buf()
    } else if spec.starts_with('$') {
        // $XDG_CONFIG_HOME/hypr/foo.conf — mínimo: CONFIG_HOME
        if let Some(tail) = spec.strip_prefix("$XDG_CONFIG_HOME/") {
            if let Ok(cfg) = std::env::var("XDG_CONFIG_HOME") {
                PathBuf::from(cfg).join(tail)
            } else {
                home.join(".config").join(tail)
            }
        } else {
            base_dir.join(spec.trim_start_matches("./"))
        }
    } else if Path::new(spec).is_absolute() {
        PathBuf::from(spec)
    } else {
        base_dir.join(spec.trim_start_matches("./"))
    };
    vec![path]
}

fn expand_glob_path(path_with_glob: &Path) -> Vec<PathBuf> {
    let pattern = match path_with_glob.file_name().and_then(|n| n.to_str()) {
        Some(p) if p.contains('*') => p,
        _ => return vec![],
    };
    let parent = path_with_glob
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let parts: Vec<&str> = pattern.split('*').collect();
    let Ok(rd) = fs::read_dir(parent) else {
        return vec![];
    };
    let mut out: Vec<PathBuf> = rd
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            match parts.as_slice() {
                [pre, suf] if pre.is_empty() => name.ends_with(suf),
                [pre, suf] if suf.is_empty() => name.starts_with(pre),
                [pre, suf] => name.starts_with(pre) && name.ends_with(suf),
                _ => true,
            }
        })
        .collect();
    out.sort();
    out
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
            if let Some((key, value)) = split_assignment(&trimmed) {
                if let Some(b) = parse_bind_line(key, value) {
                    s.keyboard.binds.push(b);
                    continue;
                }
                let wr_key = key.to_lowercase();
                if wr_key == "windowrulev2" {
                    if let Some(rule) = parse_windowrulev2(value) {
                        s.windows.rules.push(rule);
                    }
                    continue;
                }
                if wr_key == "windowrule" {
                    if let Some(rule) = parse_windowrule_v1(value) {
                        s.windows.rules.push(rule);
                    }
                    continue;
                }
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

/// `bind`, `bindl`, `binde`, `bindm`, `bindle`, `bindd`, etc.
fn parse_bind_line(key: &str, value: &str) -> Option<HyprlandBind> {
    let kl = key.trim().to_lowercase();
    if !kl.starts_with("bind") {
        return None;
    }
    // Evitar falsos positivos (p. ej. futuras claves que empiecen por "bind")
    if kl.starts_with("binding") {
        return None;
    }

    let parts: Vec<&str> = value
        .split(',')
        .map(|x| x.trim())
        .filter(|x| !x.is_empty())
        .collect();

    // bindd = mods, key, dispatcher, args…, descripción (último segmento; ver wiki Hyprland).
    if kl == "bindd" || kl == "binddr" {
        if parts.len() < 4 {
            return None;
        }
        let description = parts[parts.len() - 1].to_string();
        let mods: Vec<String> = parts[0]
            .split_whitespace()
            .filter(|x| !x.is_empty())
            .map(str::to_string)
            .collect();
        if mods.is_empty() {
            return None;
        }
        let args = if parts.len() == 5 {
            parts[3].to_string()
        } else if parts.len() > 5 {
            parts[3..parts.len() - 1].join(", ")
        } else {
            String::new()
        };
        return Some(HyprlandBind {
            modifiers: mods,
            key: parts[1].to_string(),
            dispatcher: parts[2].to_string(),
            args,
            description,
            enabled: true,
            bind_type: kl,
        });
    }

    if matches!(
        kl.as_str(),
        "bind"
            | "bindl"
            | "binde"
            | "bindm"
            | "bindle"
            | "bindlr"
            | "bindlte"
            | "bindp"
            | "bindpt"
    ) {
        if parts.len() < 3 {
            return None;
        }
        let mods: Vec<String> = parts[0]
            .split_whitespace()
            .filter(|x| !x.is_empty())
            .map(str::to_string)
            .collect();
        return Some(HyprlandBind {
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
            bind_type: kl,
        });
    }

    None
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

/// `windowrule = float, ^(kitty)$` (v1): regla + patrón de clase/título en un solo campo.
fn parse_windowrule_v1(v: &str) -> Option<HyprlandWindowRule> {
    let mut it = v.splitn(2, ',').map(str::trim);
    let rule = it.next()?.to_string();
    let pat = it.next().unwrap_or("").to_string();
    if rule.is_empty() {
        return None;
    }
    Some(HyprlandWindowRule {
        rule,
        class: pat,
        title: String::new(),
        description: "windowrule (v1)".into(),
        enabled: true,
    })
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
bindl = ALT, F4, killactive,
windowrulev2 = float, class:^(kitty)$
windowrule = opacity 0.9, ^(.*)$
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
        assert_eq!(s.keyboard.binds.len(), 2);
        assert_eq!(s.keyboard.binds[0].key, "Q");
        assert_eq!(s.keyboard.binds[0].dispatcher, "exec");
        assert_eq!(s.keyboard.binds[0].args, "foot");
        assert_eq!(s.keyboard.binds[0].bind_type, "bind");
        assert_eq!(s.keyboard.binds[1].bind_type, "bindl");
        assert_eq!(s.keyboard.binds[1].dispatcher, "killactive");
        assert_eq!(s.windows.rules.len(), 2);
        assert_eq!(s.windows.rules[0].rule, "float");
        assert_eq!(s.windows.rules[0].class, "^(kitty)$");
        assert!(s.windows.rules[1].rule.contains("opacity"));
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

    #[test]
    fn extract_source_specs_trims_quotes() {
        let txt = "  source = ./foo.conf  \n# x\nsource=\"/abs/bar.conf\"\n";
        let specs = extract_source_specs(txt);
        assert_eq!(specs, vec!["./foo.conf", "/abs/bar.conf"]);
    }
}
