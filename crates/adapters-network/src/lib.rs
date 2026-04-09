//! Lectura de interfaces de red (solo lectura, sin escritura en sistema de archivos de red).

use std::collections::HashMap;
use std::process::Command;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Clasificación heurística de la interfaz.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(rename_all = "snake_case", export, export_to = "../../../apps/desktop/src/types/generated/")]
pub enum NetworkInterfaceKind {
    Loopback,
    Ethernet,
    Wireless,
    Virtual,
    Unknown,
}

/// Interfaz de red visible en el sistema.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct NetworkInterface {
    pub name: String,
    pub kind: NetworkInterfaceKind,
    pub mac_address: Option<String>,
    pub ipv4_addresses: Vec<String>,
    pub is_up: bool,
}

fn names_from_proc_net_dev() -> Vec<String> {
    let content = match std::fs::read_to_string("/proc/net/dev") {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let mut out = Vec::new();
    for (i, line) in content.lines().enumerate() {
        if i < 2 {
            continue;
        }
        let line = line.trim_start();
        let Some(colon) = line.find(':') else {
            continue;
        };
        let name = line[..colon].trim();
        if !name.is_empty() {
            out.push(name.to_string());
        }
    }
    out
}

#[derive(Default)]
struct IpIfaceInfo {
    ipv4: Vec<String>,
    mac: Option<String>,
    flags: String,
}

fn strip_leading_iface_line(s: &str) -> Option<&str> {
    let mut saw_digit = false;
    for (i, ch) in s.char_indices() {
        if ch.is_ascii_digit() {
            saw_digit = true;
            continue;
        }
        if saw_digit && ch == ':' {
            return Some(s[i + 1..].trim_start());
        }
        break;
    }
    None
}

fn parse_ip_addr_show(stdout: &str) -> HashMap<String, IpIfaceInfo> {
    let mut map: HashMap<String, IpIfaceInfo> = HashMap::new();
    let mut current: Option<String> = None;

    for line in stdout.lines() {
        let trimmed = line.trim_start();
        if trimmed.is_empty() {
            continue;
        }
        if !line.starts_with(' ') && !line.starts_with('\t') {
            let head = line.trim();
            if let Some(after_idx) = strip_leading_iface_line(head) {
                let Some(colon) = after_idx.find(':') else {
                    continue;
                };
                let name_raw = after_idx[..colon].trim();
                let name = name_raw
                    .split('@')
                    .next()
                    .unwrap_or(name_raw)
                    .trim()
                    .to_string();
                if name.is_empty() {
                    continue;
                }
                let after_name = after_idx[colon + 1..].trim();
                let flags = if let (Some(a), Some(b)) =
                    (after_name.find('<'), after_name.find('>'))
                {
                    after_name[a + 1..b].to_string()
                } else {
                    String::new()
                };
                current = Some(name.clone());
                let e = map.entry(name).or_default();
                e.flags = flags;
            }
        } else if let Some(ref iface) = current {
            let t = trimmed;
            if let Some(addr) = t.strip_prefix("inet ") {
                let ip = addr.split_whitespace().next().unwrap_or("");
                if let Some(base) = ip.split('/').next() {
                    if !base.is_empty() {
                        map.entry(iface.clone())
                            .or_default()
                            .ipv4
                            .push(base.to_string());
                    }
                }
            } else if let Some(rest) = t.strip_prefix("link/ether ") {
                let mac = rest.split_whitespace().next().unwrap_or("");
                if mac.len() >= 17 {
                    map.entry(iface.clone())
                        .or_default()
                        .mac = Some(mac.to_string());
                }
            }
        }
    }
    map
}

fn classify(name: &str, flags: &str) -> NetworkInterfaceKind {
    let f = flags.to_uppercase();
    if f.contains("LOOPBACK") {
        return NetworkInterfaceKind::Loopback;
    }
    if name.starts_with("wl") || name.starts_with("wifi") || f.contains("WIRELESS") {
        return NetworkInterfaceKind::Wireless;
    }
    if name.starts_with("br") || name.starts_with("docker") || name.starts_with("veth") || name.starts_with("virbr")
    {
        return NetworkInterfaceKind::Virtual;
    }
    if name == "lo" {
        return NetworkInterfaceKind::Loopback;
    }
    if name.starts_with("en") || name.starts_with("eth") {
        return NetworkInterfaceKind::Ethernet;
    }
    NetworkInterfaceKind::Unknown
}

/// Lista interfaces (best-effort): `/proc/net/dev` + `ip addr show`.
pub fn list_interfaces() -> Vec<NetworkInterface> {
    let mut by_name: HashMap<String, NetworkInterface> = HashMap::new();
    for n in names_from_proc_net_dev() {
        by_name.insert(
            n.clone(),
            NetworkInterface {
                name: n,
                kind: NetworkInterfaceKind::Unknown,
                mac_address: None,
                ipv4_addresses: Vec::new(),
                is_up: false,
            },
        );
    }

    if let Ok(out) = Command::new("ip").args(["addr", "show"]).output() {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let parsed = parse_ip_addr_show(&stdout);
            for (name, info) in parsed {
                let kind = classify(&name, &info.flags);
                let is_up = info.flags.contains("UP") && !info.flags.contains("DOWN");
                by_name
                    .entry(name.clone())
                    .and_modify(|e| {
                        e.kind = kind;
                        e.mac_address = info.mac.clone().or(e.mac_address.clone());
                        if !info.ipv4.is_empty() {
                            e.ipv4_addresses = info.ipv4.clone();
                        }
                        e.is_up = is_up;
                    })
                    .or_insert(NetworkInterface {
                        name,
                        kind,
                        mac_address: info.mac,
                        ipv4_addresses: info.ipv4,
                        is_up,
                    });
            }
        }
    }

    let mut v: Vec<_> = by_name.into_values().collect();
    v.sort_by(|a, b| a.name.cmp(&b.name));
    v
}

#[cfg(test)]
mod tests {
    use ts_rs::TS;

    use super::*;

    #[test]
    fn export_ts() {
        NetworkInterfaceKind::export().expect("NetworkInterfaceKind");
        NetworkInterface::export().expect("NetworkInterface");
    }

    #[test]
    fn list_interfaces_does_not_panic() {
        let v = list_interfaces();
        for i in v {
            assert!(!i.name.is_empty());
        }
    }

    #[test]
    fn parses_sample_ip_addr() {
        let sample = r#"1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
2: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether aa:bb:cc:dd:ee:ff brd ff:ff:ff:ff:ff:ff
    inet 192.168.1.10/24 brd 192.168.1.255 scope global dynamic wlan0
"#;
        let m = parse_ip_addr_show(sample);
        assert!(m.contains_key("lo"));
        assert!(m.contains_key("wlan0"));
        assert_eq!(m["lo"].ipv4, vec!["127.0.0.1"]);
        assert_eq!(m["wlan0"].ipv4, vec!["192.168.1.10"]);
        assert_eq!(
            m["wlan0"].mac.as_deref(),
            Some("aa:bb:cc:dd:ee:ff")
        );
    }
}
