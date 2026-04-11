//! Estado, perfiles de energia y suspension por inactividad.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

const HYPRIDLE_CONFIG_REL: &str = ".config/hypr/hypridle.conf";
const HYPRIDLE_MANAGED_BEGIN: &str = "# BEGIN Linux Control Center suspend";
const HYPRIDLE_MANAGED_END: &str = "# END Linux Control Center suspend";
const HYPRIDLE_SUSPEND_COMMAND: &str = "systemctl suspend";
const HYPRIDLE_SUSPEND_ON_BATTERY_COMMAND: &str = "/bin/sh -lc 'has_battery=0; for d in /sys/class/power_supply/*; do [ -d \"$d\" ] || continue; type=$(cat \"$d/type\" 2>/dev/null || true); case \"$type\" in Battery) has_battery=1 ;; Mains|USB|UPS) online=$(cat \"$d/online\" 2>/dev/null || true); [ \"$online\" = \"1\" ] && exit 0 ;; esac; done; [ \"$has_battery\" = \"1\" ] && exec systemctl suspend; exit 0'";
const HYPRIDLE_SUSPEND_ON_AC_COMMAND: &str = "/bin/sh -lc 'has_battery=0; for d in /sys/class/power_supply/*; do [ -d \"$d\" ] || continue; type=$(cat \"$d/type\" 2>/dev/null || true); case \"$type\" in Battery) has_battery=1 ;; Mains|USB|UPS) online=$(cat \"$d/online\" 2>/dev/null || true); [ \"$online\" = \"1\" ] && exec systemctl suspend ;; esac; done; [ \"$has_battery\" = \"0\" ] && exec systemctl suspend; exit 0'";

#[derive(Debug, Error)]
pub enum PowerAdapterError {
    #[error("perfil desconocido o no aplicable")]
    UnknownProfile,
    #[error("el perfil no esta soportado por este sistema: {0}")]
    UnsupportedProfile(String),
    #[error("{0} no esta disponible en PATH")]
    CommandUnavailable(&'static str),
    #[error("el tiempo de suspension debe ser mayor a 0 segundos")]
    InvalidSuspendTimeout,
    #[error("no se pudo resolver HOME del usuario")]
    HomeUnavailable,
    #[error("error de E/S: {0}")]
    Io(String),
    #[error("powerprofilesctl fallo: {0}")]
    CommandFailed(String),
}

/// Perfil de energia logico (mapeado a `powerprofilesctl` cuando existe).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(
    rename_all = "snake_case",
    export,
    export_to = "../../../apps/desktop/src/types/generated/"
)]
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
    pub can_set_profile: bool,
    pub available_profiles: Vec<PowerProfileKind>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct SuspendSettings {
    /// `hypridle` | `unavailable`
    pub source: String,
    pub enabled: bool,
    pub battery_timeout_seconds: Option<u32>,
    pub ac_timeout_seconds: Option<u32>,
    pub binary_available: bool,
    pub config_exists: bool,
    pub config_path: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
struct SuspendTimeouts {
    battery: Option<u32>,
    ac: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SuspendRuleKind {
    Generic,
    Battery,
    Ac,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SuspendListenerRule {
    start: usize,
    end: usize,
    timeout_seconds: Option<u32>,
    kind: SuspendRuleKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ListenerBlock {
    start: usize,
    end: usize,
    timeout_seconds: Option<u32>,
    on_timeout: Option<String>,
}

fn trim_output(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).trim().to_string()
}

fn normalize_profile_label(label: &str) -> String {
    label
        .trim()
        .trim_start_matches('*')
        .trim()
        .trim_end_matches(':')
        .trim()
        .to_lowercase()
}

fn profile_from_label(label: &str) -> PowerProfileKind {
    let l = normalize_profile_label(label);
    if l.contains("performance") || l == "perf" {
        PowerProfileKind::Performance
    } else if l.contains("power-saver") || l.contains("powersaver") || l.contains("saver") {
        PowerProfileKind::PowerSaver
    } else if l.contains("balanced") || l == "balance" {
        PowerProfileKind::Balanced
    } else {
        PowerProfileKind::Unknown
    }
}

fn default_profiles() -> Vec<PowerProfileKind> {
    vec![
        PowerProfileKind::Performance,
        PowerProfileKind::Balanced,
        PowerProfileKind::PowerSaver,
    ]
}

fn run_command(name: &'static str, args: &[&str]) -> Result<Output, PowerAdapterError> {
    Command::new(name).args(args).output().map_err(|e| {
        if e.kind() == ErrorKind::NotFound {
            PowerAdapterError::CommandUnavailable(name)
        } else {
            PowerAdapterError::CommandFailed(e.to_string())
        }
    })
}

fn parse_powerprofilesctl_list(
    stdout: &str,
) -> (Vec<PowerProfileKind>, Option<(PowerProfileKind, String)>) {
    let mut available = Vec::new();
    let mut active = None;

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || !trimmed.ends_with(':') {
            continue;
        }

        let label = normalize_profile_label(trimmed);
        let kind = profile_from_label(&label);
        if kind == PowerProfileKind::Unknown {
            continue;
        }

        if !available.contains(&kind) {
            available.push(kind);
        }

        if trimmed.starts_with('*') {
            active = Some((kind, label));
        }
    }

    (available, active)
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

fn strip_inline_comment(line: &str) -> &str {
    line.split('#').next().unwrap_or("").trim()
}

fn assignment_value<'a>(line: &'a str, key: &str) -> Option<&'a str> {
    let clean = strip_inline_comment(line);
    let (lhs, rhs) = clean.split_once('=')?;
    if lhs.trim() == key {
        Some(rhs.trim())
    } else {
        None
    }
}

fn brace_delta(line: &str) -> i32 {
    let mut delta = 0;
    for c in line.chars() {
        match c {
            '{' => delta += 1,
            '}' => delta -= 1,
            _ => {}
        }
    }
    delta
}

fn find_managed_block(lines: &[String]) -> Option<(usize, usize)> {
    let mut start = None;
    for (idx, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed == HYPRIDLE_MANAGED_BEGIN {
            start = Some(idx);
        } else if trimmed == HYPRIDLE_MANAGED_END {
            if let Some(s) = start {
                return Some((s, idx));
            }
        }
    }
    None
}

fn parse_listener_block(lines: &[String], start_idx: usize) -> Option<ListenerBlock> {
    let trimmed = strip_inline_comment(lines.get(start_idx)?.trim());
    if !(trimmed.starts_with("listener") && trimmed.contains('{')) {
        return None;
    }

    let mut end = start_idx;
    let mut depth = brace_delta(trimmed);
    let mut timeout_seconds = assignment_value(trimmed, "timeout").and_then(|v| v.parse().ok());
    let mut on_timeout = assignment_value(trimmed, "on-timeout").map(str::to_string);

    while depth > 0 && end + 1 < lines.len() {
        end += 1;
        let inner = strip_inline_comment(lines[end].trim());
        depth += brace_delta(inner);
        if let Some(value) = assignment_value(inner, "timeout") {
            timeout_seconds = value.parse().ok();
        }
        if let Some(value) = assignment_value(inner, "on-timeout") {
            on_timeout = Some(value.to_string());
        }
    }

    Some(ListenerBlock {
        start: start_idx,
        end,
        timeout_seconds,
        on_timeout,
    })
}

fn classify_suspend_command(command: &str) -> Option<SuspendRuleKind> {
    match command {
        HYPRIDLE_SUSPEND_COMMAND => Some(SuspendRuleKind::Generic),
        HYPRIDLE_SUSPEND_ON_BATTERY_COMMAND => Some(SuspendRuleKind::Battery),
        HYPRIDLE_SUSPEND_ON_AC_COMMAND => Some(SuspendRuleKind::Ac),
        _ => None,
    }
}

fn collect_suspend_rules(lines: &[String]) -> Vec<SuspendListenerRule> {
    let mut rules = Vec::new();
    let mut idx = 0;

    while idx < lines.len() {
        if let Some(block) = parse_listener_block(lines, idx) {
            if let Some(kind) = block
                .on_timeout
                .as_deref()
                .and_then(classify_suspend_command)
            {
                rules.push(SuspendListenerRule {
                    start: block.start,
                    end: block.end,
                    timeout_seconds: block.timeout_seconds,
                    kind,
                });
            }
            idx = block.end + 1;
            continue;
        }

        idx += 1;
    }

    rules
}

fn collapse_blank_lines(lines: Vec<String>) -> Vec<String> {
    let mut out = Vec::new();
    let mut prev_blank = true;

    for line in lines {
        let is_blank = line.trim().is_empty();
        if is_blank && prev_blank {
            continue;
        }
        prev_blank = is_blank;
        out.push(line);
    }

    while matches!(out.last(), Some(last) if last.trim().is_empty()) {
        out.pop();
    }

    out
}

fn render_lines(lines: Vec<String>) -> String {
    let lines = collapse_blank_lines(lines);
    if lines.is_empty() {
        String::new()
    } else {
        let mut out = lines.join("\n");
        out.push('\n');
        out
    }
}

fn managed_suspend_block(timeouts: SuspendTimeouts) -> Vec<String> {
    let mut block = vec![HYPRIDLE_MANAGED_BEGIN.into()];

    if let Some(seconds) = timeouts.battery {
        block.push("# Suspend on battery".into());
        block.push("listener {".into());
        block.push(format!("    timeout = {seconds}"));
        block.push(format!(
            "    on-timeout = {HYPRIDLE_SUSPEND_ON_BATTERY_COMMAND}"
        ));
        block.push("}".into());
    }

    if timeouts.battery.is_some() && timeouts.ac.is_some() {
        block.push(String::new());
    }

    if let Some(seconds) = timeouts.ac {
        block.push("# Suspend on AC".into());
        block.push("listener {".into());
        block.push(format!("    timeout = {seconds}"));
        block.push(format!("    on-timeout = {HYPRIDLE_SUSPEND_ON_AC_COMMAND}"));
        block.push("}".into());
    }

    block.push(HYPRIDLE_MANAGED_END.into());
    block
}

fn extract_suspend_timeouts(content: &str) -> SuspendTimeouts {
    let lines: Vec<String> = content.lines().map(|line| line.to_string()).collect();
    let scoped_lines = if let Some((start, end)) = find_managed_block(&lines) {
        lines[start..=end].to_vec()
    } else {
        lines
    };

    let rules = collect_suspend_rules(&scoped_lines);
    let mut timeouts = SuspendTimeouts::default();
    let mut generic = None;

    for rule in rules {
        match rule.kind {
            SuspendRuleKind::Battery => {
                if timeouts.battery.is_none() {
                    timeouts.battery = rule.timeout_seconds;
                }
            }
            SuspendRuleKind::Ac => {
                if timeouts.ac.is_none() {
                    timeouts.ac = rule.timeout_seconds;
                }
            }
            SuspendRuleKind::Generic => {
                if generic.is_none() {
                    generic = rule.timeout_seconds;
                }
            }
        }
    }

    if timeouts.battery.is_none() {
        timeouts.battery = generic;
    }
    if timeouts.ac.is_none() {
        timeouts.ac = generic;
    }

    timeouts
}

fn update_hypridle_suspend_block(content: &str, timeouts: SuspendTimeouts) -> String {
    let mut lines: Vec<String> = content.lines().map(|line| line.to_string()).collect();

    while let Some((start, end)) = find_managed_block(&lines) {
        lines.drain(start..=end);
    }

    let rules = collect_suspend_rules(&lines);
    for rule in rules.into_iter().rev() {
        lines.drain(rule.start..=rule.end);
    }

    if timeouts.battery.is_some() || timeouts.ac.is_some() {
        if !lines.is_empty() && !lines.last().is_some_and(|line| line.trim().is_empty()) {
            lines.push(String::new());
        }
        lines.extend(managed_suspend_block(timeouts));
    }

    render_lines(lines)
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn hypridle_config_path() -> Option<PathBuf> {
    home_dir().map(|home| home.join(HYPRIDLE_CONFIG_REL))
}

fn atomic_write(path: &Path, content: &str) -> Result<(), PowerAdapterError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| PowerAdapterError::Io(e.to_string()))?;
    }

    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content).map_err(|e| PowerAdapterError::Io(e.to_string()))?;
    fs::rename(&tmp, path).map_err(|e| PowerAdapterError::Io(e.to_string()))?;
    Ok(())
}

fn restart_hypridle_best_effort() {
    let _ = Command::new("systemctl")
        .args(["--user", "restart", "hypridle.service"])
        .output();
}

/// Lee estado de energia (perfil + bateria si hay sysfs).
pub fn get_power_status() -> PowerStatus {
    let (bat, ac) = read_sysfs_battery_and_ac();
    let mut available_profiles = Vec::new();

    if let Ok(out) = run_command("powerprofilesctl", &["list"]) {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let (parsed, active) = parse_powerprofilesctl_list(&stdout);
            available_profiles = parsed;
            if let Some((profile, label)) = active {
                return PowerStatus {
                    profile,
                    profile_label: label,
                    battery_percent: bat,
                    on_ac: ac,
                    source: "powerprofilesctl".into(),
                    can_set_profile: true,
                    available_profiles: if available_profiles.is_empty() {
                        default_profiles()
                    } else {
                        available_profiles
                    },
                };
            }
        }
    }

    if let Ok(out) = run_command("powerprofilesctl", &["get"]) {
        if out.status.success() {
            let label = normalize_profile_label(&trim_output(&out.stdout));
            return PowerStatus {
                profile: profile_from_label(&label),
                profile_label: label,
                battery_percent: bat,
                on_ac: ac,
                source: "powerprofilesctl".into(),
                can_set_profile: true,
                available_profiles: if available_profiles.is_empty() {
                    default_profiles()
                } else {
                    available_profiles
                },
            };
        }
    }

    if !available_profiles.is_empty() {
        return PowerStatus {
            profile: PowerProfileKind::Unknown,
            profile_label: String::new(),
            battery_percent: bat,
            on_ac: ac,
            source: "powerprofilesctl".into(),
            can_set_profile: true,
            available_profiles,
        };
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
        can_set_profile: false,
        available_profiles: vec![],
    }
}

/// Lee la configuracion actual de suspension automatica desde `hypridle.conf`.
pub fn get_suspend_settings() -> SuspendSettings {
    let binary_available = run_command("hypridle", &["--help"]).is_ok();
    let Some(config_path) = hypridle_config_path() else {
        return SuspendSettings {
            source: "unavailable".into(),
            enabled: false,
            battery_timeout_seconds: None,
            ac_timeout_seconds: None,
            binary_available,
            config_exists: false,
            config_path: None,
        };
    };

    let config_exists = config_path.is_file();
    let timeouts = fs::read_to_string(&config_path)
        .ok()
        .map(|content| extract_suspend_timeouts(&content))
        .unwrap_or_default();

    SuspendSettings {
        source: if binary_available || config_exists {
            "hypridle".into()
        } else {
            "unavailable".into()
        },
        enabled: timeouts.battery.is_some() || timeouts.ac.is_some(),
        battery_timeout_seconds: timeouts.battery,
        ac_timeout_seconds: timeouts.ac,
        binary_available,
        config_exists,
        config_path: Some(config_path.to_string_lossy().into_owned()),
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

/// Establece perfil via `powerprofilesctl set` (sin shell).
pub fn set_power_profile(kind: PowerProfileKind) -> Result<(), PowerAdapterError> {
    let Some(arg) = pctl_arg(kind) else {
        return Err(PowerAdapterError::UnknownProfile);
    };

    if let Ok(out) = run_command("powerprofilesctl", &["list"]) {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let (available, _) = parse_powerprofilesctl_list(&stdout);
            if !available.is_empty() && !available.contains(&kind) {
                return Err(PowerAdapterError::UnsupportedProfile(arg.into()));
            }
        }
    }

    let out = run_command("powerprofilesctl", &["set", arg])?;
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

/// Escribe o elimina los listeners gestionados de suspension en `hypridle.conf`.
pub fn set_suspend_settings(
    battery_timeout_seconds: Option<u32>,
    ac_timeout_seconds: Option<u32>,
) -> Result<(), PowerAdapterError> {
    if matches!(battery_timeout_seconds, Some(0)) || matches!(ac_timeout_seconds, Some(0)) {
        return Err(PowerAdapterError::InvalidSuspendTimeout);
    }

    let path = hypridle_config_path().ok_or(PowerAdapterError::HomeUnavailable)?;
    let current = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(e) if e.kind() == ErrorKind::NotFound => String::new(),
        Err(e) => return Err(PowerAdapterError::Io(e.to_string())),
    };

    let timeouts = SuspendTimeouts {
        battery: battery_timeout_seconds,
        ac: ac_timeout_seconds,
    };

    if current.is_empty() && timeouts == SuspendTimeouts::default() {
        return Ok(());
    }

    let next = update_hypridle_suspend_block(&current, timeouts);
    if next == current {
        return Ok(());
    }

    atomic_write(&path, &next)?;
    restart_hypridle_best_effort();
    Ok(())
}

#[cfg(test)]
mod tests {
    use ts_rs::TS;

    use super::*;

    #[test]
    fn export_ts() {
        PowerProfileKind::export().expect("PowerProfileKind");
        PowerStatus::export().expect("PowerStatus");
        SuspendSettings::export().expect("SuspendSettings");
    }

    #[test]
    fn profile_from_label_maps() {
        assert_eq!(profile_from_label("balanced"), PowerProfileKind::Balanced);
        assert_eq!(
            profile_from_label("performance"),
            PowerProfileKind::Performance
        );
        assert_eq!(
            profile_from_label("power-saver"),
            PowerProfileKind::PowerSaver
        );
    }

    #[test]
    fn parse_powerprofilesctl_list_detects_supported_profiles() {
        let sample =
            "  performance:\n* balanced:\n  power-saver:\n      Driver: platform_profile\n";
        let (available, active) = parse_powerprofilesctl_list(sample);

        assert_eq!(
            available,
            vec![
                PowerProfileKind::Performance,
                PowerProfileKind::Balanced,
                PowerProfileKind::PowerSaver,
            ]
        );
        assert_eq!(
            active,
            Some((PowerProfileKind::Balanced, "balanced".into()))
        );
    }

    #[test]
    fn extract_suspend_timeouts_reads_generic_listener_as_both_modes() {
        let content = r#"
listener {
    timeout = 1800
    on-timeout = systemctl suspend
}
"#;

        assert_eq!(
            extract_suspend_timeouts(content),
            SuspendTimeouts {
                battery: Some(1800),
                ac: Some(1800),
            }
        );
    }

    #[test]
    fn extract_suspend_timeouts_reads_managed_split_listeners() {
        let content = format!(
            "{HYPRIDLE_MANAGED_BEGIN}\n# Suspend on battery\nlistener {{\n    timeout = 900\n    on-timeout = {HYPRIDLE_SUSPEND_ON_BATTERY_COMMAND}\n}}\n\n# Suspend on AC\nlistener {{\n    timeout = 1800\n    on-timeout = {HYPRIDLE_SUSPEND_ON_AC_COMMAND}\n}}\n{HYPRIDLE_MANAGED_END}\n"
        );

        assert_eq!(
            extract_suspend_timeouts(&content),
            SuspendTimeouts {
                battery: Some(900),
                ac: Some(1800),
            }
        );
    }

    #[test]
    fn update_hypridle_suspend_block_replaces_existing_listener_with_split_rules() {
        let current = r#"
listener {
    timeout = 1800
    on-timeout = systemctl suspend
}
"#;

        let next = update_hypridle_suspend_block(
            current,
            SuspendTimeouts {
                battery: Some(900),
                ac: Some(1800),
            },
        );

        assert!(next.contains(HYPRIDLE_MANAGED_BEGIN));
        assert!(next.contains("timeout = 900"));
        assert!(next.contains("timeout = 1800"));
        assert!(next.contains(HYPRIDLE_SUSPEND_ON_BATTERY_COMMAND));
        assert!(next.contains(HYPRIDLE_SUSPEND_ON_AC_COMMAND));
        assert!(!next.contains("on-timeout = systemctl suspend\n"));
    }

    #[test]
    fn update_hypridle_suspend_block_removes_all_suspend_rules_for_never() {
        let current = format!(
            "listener {{\n    timeout = 600\n    on-timeout = {HYPRIDLE_SUSPEND_ON_BATTERY_COMMAND}\n}}\n\nlistener {{\n    timeout = 1200\n    on-timeout = {HYPRIDLE_SUSPEND_ON_AC_COMMAND}\n}}\n"
        );

        let next = update_hypridle_suspend_block(&current, SuspendTimeouts::default());
        assert!(!next.contains(HYPRIDLE_SUSPEND_ON_BATTERY_COMMAND));
        assert!(!next.contains(HYPRIDLE_SUSPEND_ON_AC_COMMAND));
        assert!(!next.contains(HYPRIDLE_MANAGED_BEGIN));
    }
}
