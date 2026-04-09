use core_model::settings::WaybarSettings;

use crate::types::{FixtureSource, WaybarExportResult, WaybarFixtureResult};

/// Contenido del fixture embebido en el binario.
const FIXTURE_CONTENT: &str = include_str!("../../../fixtures/waybar/config.jsonc");

/// Carga el fixture de Waybar desde el binario.
///
/// LIMITATION (fase 1): Solo devuelve el contenido del fixture embebido.
/// No lee ni modifica archivos del sistema real.
pub fn load_fixture() -> WaybarFixtureResult {
    WaybarFixtureResult {
        content: FIXTURE_CONTENT.to_string(),
        source: FixtureSource::Embedded,
    }
}

/// Genera el contenido de config.jsonc a partir de `WaybarSettings`.
///
/// LIMITATION (fase 1): Genera JSON manualmente; no escribe en disco ni recarga waybar.
/// Solo cubre los campos del core-model. Campos avanzados (estilos CSS, etc.) no están soportados.
pub fn export_from_settings(s: &WaybarSettings) -> WaybarExportResult {
    let modules_left = format_module_array(&s.modules_left);
    let modules_center = format_module_array(&s.modules_center);
    let modules_right = format_module_array(&s.modules_right);

    let mut lines: Vec<String> = Vec::new();
    lines.push("{".into());
    lines.push("    \"layer\": \"top\",".into());
    lines.push(format!("    \"position\": \"{}\",", s.position));
    lines.push(format!("    \"height\": {},", s.height));
    lines.push(format!("    \"modules-left\": {},", modules_left));
    lines.push(format!("    \"modules-center\": {},", modules_center));
    lines.push(format!("    \"modules-right\": {}", modules_right));
    lines.push("}".into());

    WaybarExportResult { content: lines.join("\n") + "\n" }
}

fn format_module_array(modules: &[String]) -> String {
    let inner = modules
        .iter()
        .map(|m| format!("\"{}\"", m))
        .collect::<Vec<_>>()
        .join(", ");
    format!("[{}]", inner)
}
