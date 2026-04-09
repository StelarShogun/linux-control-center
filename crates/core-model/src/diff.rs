use serde::{Deserialize, Serialize};

use crate::settings::AppSettings;

// `toml` is a workspace dependency already included in core-model's Cargo.toml.

/// Una entrada de diferencia entre dos valores del mismo campo.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DiffEntry {
    /// Ruta del campo en dot-notation (e.g., "hyprland.gaps_in").
    pub field: String,
    pub old_value: String,
    pub new_value: String,
}

/// Resultado de comparar dos `AppSettings`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsDiff {
    pub entries: Vec<DiffEntry>,
}

impl SettingsDiff {
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

/// Serializa un valor serde a TOML compacto para mostrar en diffs.
///
/// Usa TOML como formato determinista y legible, consistente con la capa de persistencia.
/// Si la serialización falla (no debería con tipos conocidos), vuelve a `Debug`.
fn to_toml_string<T: serde::Serialize + std::fmt::Debug>(value: &T) -> String {
    toml::to_string(value).unwrap_or_else(|_| format!("{value:?}"))
}

/// Compara dos `AppSettings` sección a sección.
///
/// Produce una entrada por cada sección que difiera, con el valor serializado
/// en TOML para facilitar la lectura humana y la comparación programática.
/// No produce diff a nivel de campo individual dentro de cada sección.
pub fn compute_diff(old: &AppSettings, new: &AppSettings) -> SettingsDiff {
    let mut entries = Vec::new();

    macro_rules! section_diff {
        ($section:ident, $label:literal) => {
            if old.$section != new.$section {
                entries.push(DiffEntry {
                    field: $label.into(),
                    old_value: to_toml_string(&old.$section),
                    new_value: to_toml_string(&new.$section),
                });
            }
        };
    }

    section_diff!(appearance, "appearance");
    section_diff!(hyprland, "hyprland");
    section_diff!(waybar, "waybar");
    section_diff!(rofi, "rofi");

    SettingsDiff { entries }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diff_values_are_toml_not_debug() {
        let old = AppSettings::default();
        let mut new = old.clone();
        new.hyprland.gaps_in = 99;
        let diff = compute_diff(&old, &new);
        let entry = diff.entries.iter().find(|e| e.field == "hyprland").unwrap();
        // TOML uses `key = value` pairs; Debug would use `HyprlandSettings { ... }`.
        assert!(entry.old_value.contains("gaps_in"), "expected TOML key, got: {}", entry.old_value);
        assert!(!entry.old_value.starts_with("HyprlandSettings"), "should not be Debug format");
    }
}
