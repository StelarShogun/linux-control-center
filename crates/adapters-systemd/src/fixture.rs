use crate::types::{ActiveState, LoadState, UnitFileState, UnitInfo, UnitKind};

pub fn list_units_fixture() -> Vec<UnitInfo> {
    vec![
        UnitInfo {
            name: "ssh.service".to_string(),
            description: "OpenSSH server daemon".to_string(),
            kind: UnitKind::Service,
            load_state: LoadState::Loaded,
            active_state: ActiveState::Active,
            sub_state: "running".to_string(),
            unit_file_state: UnitFileState::Enabled,
            fragment_path: Some("/usr/lib/systemd/system/ssh.service".to_string()),
        },
        UnitInfo {
            name: "bluetooth.service".to_string(),
            description: "Bluetooth service".to_string(),
            kind: UnitKind::Service,
            load_state: LoadState::Loaded,
            active_state: ActiveState::Inactive,
            sub_state: "dead".to_string(),
            unit_file_state: UnitFileState::Disabled,
            fragment_path: Some("/usr/lib/systemd/system/bluetooth.service".to_string()),
        },
        UnitInfo {
            name: "timers.target".to_string(),
            description: "Timers".to_string(),
            kind: UnitKind::Target,
            load_state: LoadState::Loaded,
            active_state: ActiveState::Active,
            sub_state: "active".to_string(),
            unit_file_state: UnitFileState::Static,
            fragment_path: Some("/usr/lib/systemd/system/timers.target".to_string()),
        },
        UnitInfo {
            name: "fstrim.timer".to_string(),
            description: "Discard unused blocks once a week".to_string(),
            kind: UnitKind::Timer,
            load_state: LoadState::Loaded,
            active_state: ActiveState::Active,
            sub_state: "waiting".to_string(),
            unit_file_state: UnitFileState::Enabled,
            fragment_path: Some("/usr/lib/systemd/system/fstrim.timer".to_string()),
        },
        UnitInfo {
            name: "example-weird.unit".to_string(),
            description: "Example unknown unit kind".to_string(),
            kind: UnitKind::Other,
            load_state: LoadState::Unknown("loaded-ish".to_string()),
            active_state: ActiveState::Unknown("half-active".to_string()),
            sub_state: "??".to_string(),
            unit_file_state: UnitFileState::Unknown("mystery".to_string()),
            fragment_path: None,
        },
    ]
}
