use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SystemdBus {
    System,
    Session,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadState {
    Loaded,
    NotFound,
    BadSetting,
    Error,
    Merged,
    Masked,
    Stub,
    Unknown(String),
}

impl From<&str> for LoadState {
    fn from(value: &str) -> Self {
        match value {
            "loaded" => Self::Loaded,
            "not-found" => Self::NotFound,
            "bad-setting" => Self::BadSetting,
            "error" => Self::Error,
            "merged" => Self::Merged,
            "masked" => Self::Masked,
            "stub" => Self::Stub,
            other => Self::Unknown(other.to_string()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActiveState {
    Active,
    Inactive,
    Activating,
    Deactivating,
    Failed,
    Reloading,
    Maintenance,
    Unknown(String),
}

impl From<&str> for ActiveState {
    fn from(value: &str) -> Self {
        match value {
            "active" => Self::Active,
            "inactive" => Self::Inactive,
            "activating" => Self::Activating,
            "deactivating" => Self::Deactivating,
            "failed" => Self::Failed,
            "reloading" => Self::Reloading,
            "maintenance" => Self::Maintenance,
            other => Self::Unknown(other.to_string()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum UnitFileState {
    Enabled,
    EnabledRuntime,
    Linked,
    LinkedRuntime,
    Masked,
    MaskedRuntime,
    Static,
    Disabled,
    Indirect,
    Generated,
    Transient,
    Bad,
    Unknown(String),
}

impl From<&str> for UnitFileState {
    fn from(value: &str) -> Self {
        match value {
            "enabled" => Self::Enabled,
            "enabled-runtime" => Self::EnabledRuntime,
            "linked" => Self::Linked,
            "linked-runtime" => Self::LinkedRuntime,
            "masked" => Self::Masked,
            "masked-runtime" => Self::MaskedRuntime,
            "static" => Self::Static,
            "disabled" => Self::Disabled,
            "indirect" => Self::Indirect,
            "generated" => Self::Generated,
            "transient" => Self::Transient,
            "bad" => Self::Bad,
            other => Self::Unknown(other.to_string()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
pub enum UnitKind {
    Service,
    Socket,
    Target,
    Timer,
    Mount,
    Path,
    Slice,
    Scope,
    Device,
    Automount,
    Swap,
    Other,
}

impl UnitKind {
    pub fn from_unit_name(name: &str) -> Self {
        if name.ends_with(".service") {
            Self::Service
        } else if name.ends_with(".socket") {
            Self::Socket
        } else if name.ends_with(".target") {
            Self::Target
        } else if name.ends_with(".timer") {
            Self::Timer
        } else if name.ends_with(".mount") {
            Self::Mount
        } else if name.ends_with(".path") {
            Self::Path
        } else if name.ends_with(".slice") {
            Self::Slice
        } else if name.ends_with(".scope") {
            Self::Scope
        } else if name.ends_with(".device") {
            Self::Device
        } else if name.ends_with(".automount") {
            Self::Automount
        } else if name.ends_with(".swap") {
            Self::Swap
        } else {
            Self::Other
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UnitInfo {
    pub name: String,
    pub description: String,
    pub kind: UnitKind,
    pub load_state: LoadState,
    pub active_state: ActiveState,
    pub sub_state: String,
    pub unit_file_state: UnitFileState,
    pub fragment_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize)]
pub struct UnitFilter {
    pub kinds: Option<Vec<UnitKind>>,
    pub active_only: bool,
    pub max_results: usize,
}

impl Default for UnitFilter {
    fn default() -> Self {
        Self {
            kinds: None,
            active_only: false,
            max_results: 200,
        }
    }
}

impl UnitFilter {
    pub fn apply(&self, units: &[UnitInfo]) -> Vec<UnitInfo> {
        let mut out = Vec::new();
        for u in units {
            if self.active_only && u.active_state != ActiveState::Active {
                continue;
            }
            if let Some(kinds) = &self.kinds {
                if !kinds.contains(&u.kind) {
                    continue;
                }
            }
            out.push(u.clone());
            if out.len() >= self.max_results {
                break;
            }
        }
        out
    }
}

#[derive(Debug, thiserror::Error)]
pub enum SystemdError {
    #[error("error D-Bus: {0}")]
    DBus(#[from] zbus::Error),

    #[error("unidad inválida: {0}")]
    InvalidUnitName(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unit_kind_from_suffix() {
        assert_eq!(UnitKind::from_unit_name("foo.service"), UnitKind::Service);
        assert_eq!(UnitKind::from_unit_name("bar.timer"), UnitKind::Timer);
        assert_eq!(UnitKind::from_unit_name("baz.weird"), UnitKind::Other);
    }

    #[test]
    fn parse_states_are_robust() {
        let a = ActiveState::from("mystery-state");
        let l = LoadState::from("mystery-load");
        let u = UnitFileState::from("mystery-file-state");
        assert!(matches!(a, ActiveState::Unknown(_)));
        assert!(matches!(l, LoadState::Unknown(_)));
        assert!(matches!(u, UnitFileState::Unknown(_)));
    }
}
