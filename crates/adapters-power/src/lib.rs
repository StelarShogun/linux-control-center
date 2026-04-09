//! Estado y perfiles de energía (best-effort, sin shell arbitrario).

use std::fs;
use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

#[derive(Debug, Error)]
pub enum PowerAdapterError {
    #[error("perfil desconocido o no aplicable")]
    UnknownProfile,
    #[error("powerprofilesctl falló: {0}")]
    CommandFailed(String),
}

/// Perfil de energía lógico (mapeado a `powerprofilesctl` cuando existe).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(rename_all = "snake_case", export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum PowerProfileKind {
    Performance,
    Balanced,
    PowerSaver,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct PowerStatus {
    pub profile: PowerProfileKind,
    /// Etiqueta tal como la reporta el sistema (p. ej. `balanced`).
    pub profile_label: String,
    pub battery_percent: Option<u8>,
    pub on_ac: Option<bool>,
    /// `powerprofilesctl` | `sysfs` | `unavailable`
    pub source: String,
}

fn trim_output(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).trim().to_string()
}

fn profile_from_label(label: &str) -> PowerProfileKind {
    let l = label.trim().to_lowercase();
    if l.contains("performance") || l == "perf" {
        PowerProfileKind::Performance
    } else if l.contains("power-saver") || l.contains("powersaver") || l.contains("saver") {
        PowerProfileKind::PowerSaver
    } else if l.contains("balanced") || l == "balance" {
        PowerProfileKind::Balanced
    } else if l.is_empty() {
        PowerProfileKind::Unknown
    } else {
        PowerProfileKind::Unknown
    }
}

fn read_sysfs_u8(dir: &Path, name: &str) -> Option<u8> {
    let p = dir.join(name);
    let s = fs::read_to_string(p).ok()?;
    s.trim().parse().ok()
}

fn read_sysfs_battery_and_ac() -> (Option<u8>, Option<bool>) {
    let Ok(entries) = fs::read_dir("/sys/class/power_supply") else {
        return (None, None);
    };
    let mut pct = None;
    let mut on_ac = None;
    for e in entries.flatten() {
        let p = e.path();
        let t = fs::read_to_string(p.join("type")).unwrap_or_default();
        let t = t.trim().to_lowercase();
        if t == "battery" {
            if let Some(c) = read_sysfs_u8(&p, "capacity") {
                pct = Some(c);
            }
        } else if t == "mains" || t == "usb" || t == "ups" {
            if let Ok(online) = fs::read_to_string(p.join("online")) {
                let v = online.trim();
                if v == "1" {
                    on_ac = Some(true);
                } else if v == "0" {
                    on_ac = Some(false);
                }
            }
        }
    }
    (pct, on_ac)
}

/// Lee estado de energía (perfil + batería si hay sysfs).
pub fn get_power_status() -> PowerStatus {
    let (bat, ac) = read_sysfs_battery_and_ac();

    if let Ok(out) = Command::new("powerprofilesctl").arg("get").output() {
        if out.status.success() {
            let label = trim_output(&out.stdout);
            return PowerStatus {
                profile: profile_from_label(&label),
                profile_label: label,
                battery_percent: bat,
                on_ac: ac,
                source: "powerprofilesctl".into(),
            };
        }
    }

    PowerStatus {
        profile: PowerProfileKind::Unknown,
        profile_label: String::new(),
        battery_percent: bat,
        on_ac: ac,
        source: if bat.is_some() || ac.is_some() {
            "sysfs".into()
        } else {
            "unavailable".into()
        },
    }
}

fn pctl_arg(kind: PowerProfileKind) -> Option<&'static str> {
    match kind {
        PowerProfileKind::Performance => Some("performance"),
        PowerProfileKind::Balanced => Some("balanced"),
        PowerProfileKind::PowerSaver => Some("power-saver"),
        PowerProfileKind::Unknown => None,
    }
}

/// Establece perfil vía `powerprofilesctl set` (sin shell).
pub fn set_power_profile(kind: PowerProfileKind) -> Result<(), PowerAdapterError> {
    let Some(arg) = pctl_arg(kind) else {
        return Err(PowerAdapterError::UnknownProfile);
    };
    let out = Command::new("powerprofilesctl")
        .args(["set", arg])
        .output()
        .map_err(|e| PowerAdapterError::CommandFailed(e.to_string()))?;
    if out.status.success() {
        Ok(())
    } else {
        let mut msg = trim_output(&out.stderr);
        if msg.is_empty() {
            msg = trim_output(&out.stdout);
        }
        if msg.is_empty() {
            msg = "exit non-zero".into();
        }
        Err(PowerAdapterError::CommandFailed(msg))
    }
}

#[cfg(test)]
mod tests {
    use ts_rs::TS;

    use super::*;

    #[test]
    fn export_ts() {
        PowerProfileKind::export().expect("PowerProfileKind");
        PowerStatus::export().expect("PowerStatus");
    }

    #[test]
    fn profile_from_label_maps() {
        assert_eq!(
            profile_from_label("balanced"),
            PowerProfileKind::Balanced
        );
        assert_eq!(
            profile_from_label("performance"),
            PowerProfileKind::Performance
        );
    }
}
