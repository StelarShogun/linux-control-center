use ts_rs::TS;

use crate::types::{ActiveState, LoadState, UnitFileState, UnitInfo, UnitKind};

/// Representación plana de una unidad systemd para la frontera IPC.
///
/// Todos los campos de estado se serializan como strings simples para evitar
/// la complejidad de los enums con variante `Unknown(String)` en TypeScript.
#[derive(Debug, Clone, serde::Serialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct UnitStatusDto {
    pub name: String,
    pub description: String,
    /// "service" | "socket" | "target" | "timer" | "mount" | "path" |
    /// "slice" | "scope" | "device" | "automount" | "swap" | "other"
    pub kind: String,
    /// "loaded" | "not-found" | "bad-setting" | "error" | "merged" |
    /// "masked" | "stub" | "unknown:<raw>"
    pub load_state: String,
    /// "active" | "inactive" | "activating" | "deactivating" | "failed" |
    /// "reloading" | "maintenance" | "unknown:<raw>"
    pub active_state: String,
    pub sub_state: String,
    /// "enabled" | "enabled-runtime" | "linked" | "linked-runtime" |
    /// "masked" | "masked-runtime" | "static" | "disabled" | "indirect" |
    /// "generated" | "transient" | "bad" | "unknown:<raw>"
    pub unit_file_state: String,
    pub fragment_path: Option<String>,
}

/// Respuesta de `list_systemd_units`.
///
/// `source` indica si los datos vienen de D-Bus real o del fixture embebido.
#[derive(Debug, serde::Serialize, TS)]
#[ts(export, export_to = "../../../apps/desktop/src/types/generated/")]
pub struct ListUnitsResponse {
    pub units: Vec<UnitStatusDto>,
    /// "dbus" cuando los datos provienen de D-Bus real; "fixture" cuando se
    /// usa el fallback embebido (D-Bus no disponible).
    pub source: String,
}

/// Convierte `UnitInfo` a `UnitStatusDto` aplanando los enums a strings.
pub fn unit_info_to_dto(u: &UnitInfo) -> UnitStatusDto {
    UnitStatusDto {
        name: u.name.clone(),
        description: u.description.clone(),
        kind: unit_kind_to_str(u.kind),
        load_state: load_state_to_str(&u.load_state),
        active_state: active_state_to_str(&u.active_state),
        sub_state: u.sub_state.clone(),
        unit_file_state: unit_file_state_to_str(&u.unit_file_state),
        fragment_path: u.fragment_path.clone(),
    }
}

fn unit_kind_to_str(k: UnitKind) -> String {
    match k {
        UnitKind::Service => "service".into(),
        UnitKind::Socket => "socket".into(),
        UnitKind::Target => "target".into(),
        UnitKind::Timer => "timer".into(),
        UnitKind::Mount => "mount".into(),
        UnitKind::Path => "path".into(),
        UnitKind::Slice => "slice".into(),
        UnitKind::Scope => "scope".into(),
        UnitKind::Device => "device".into(),
        UnitKind::Automount => "automount".into(),
        UnitKind::Swap => "swap".into(),
        UnitKind::Other => "other".into(),
    }
}

fn load_state_to_str(s: &LoadState) -> String {
    match s {
        LoadState::Loaded => "loaded".into(),
        LoadState::NotFound => "not-found".into(),
        LoadState::BadSetting => "bad-setting".into(),
        LoadState::Error => "error".into(),
        LoadState::Merged => "merged".into(),
        LoadState::Masked => "masked".into(),
        LoadState::Stub => "stub".into(),
        LoadState::Unknown(raw) => format!("unknown:{}", raw),
    }
}

fn active_state_to_str(s: &ActiveState) -> String {
    match s {
        ActiveState::Active => "active".into(),
        ActiveState::Inactive => "inactive".into(),
        ActiveState::Activating => "activating".into(),
        ActiveState::Deactivating => "deactivating".into(),
        ActiveState::Failed => "failed".into(),
        ActiveState::Reloading => "reloading".into(),
        ActiveState::Maintenance => "maintenance".into(),
        ActiveState::Unknown(raw) => format!("unknown:{}", raw),
    }
}

fn unit_file_state_to_str(s: &UnitFileState) -> String {
    match s {
        UnitFileState::Enabled => "enabled".into(),
        UnitFileState::EnabledRuntime => "enabled-runtime".into(),
        UnitFileState::Linked => "linked".into(),
        UnitFileState::LinkedRuntime => "linked-runtime".into(),
        UnitFileState::Masked => "masked".into(),
        UnitFileState::MaskedRuntime => "masked-runtime".into(),
        UnitFileState::Static => "static".into(),
        UnitFileState::Disabled => "disabled".into(),
        UnitFileState::Indirect => "indirect".into(),
        UnitFileState::Generated => "generated".into(),
        UnitFileState::Transient => "transient".into(),
        UnitFileState::Bad => "bad".into(),
        UnitFileState::Unknown(raw) => format!("unknown:{}", raw),
    }
}

#[cfg(test)]
mod tests {
    use crate::types::{ActiveState, LoadState, UnitFileState, UnitInfo, UnitKind};

    use super::*;

    fn make_unit(kind: UnitKind, active: ActiveState) -> UnitInfo {
        UnitInfo {
            name: "test.service".to_string(),
            description: "test".to_string(),
            kind,
            load_state: LoadState::Loaded,
            active_state: active,
            sub_state: "running".to_string(),
            unit_file_state: UnitFileState::Enabled,
            fragment_path: None,
        }
    }

    #[test]
    fn dto_conversion_service_unit() {
        let u = make_unit(UnitKind::Service, ActiveState::Active);
        let dto = unit_info_to_dto(&u);
        assert_eq!(dto.kind, "service");
        assert_eq!(dto.active_state, "active");
        assert_eq!(dto.load_state, "loaded");
        assert_eq!(dto.unit_file_state, "enabled");
    }

    #[test]
    fn dto_conversion_unknown_state() {
        let mut u = make_unit(UnitKind::Other, ActiveState::Unknown("half-active".to_string()));
        u.load_state = LoadState::Unknown("loaded-ish".to_string());
        u.unit_file_state = UnitFileState::Unknown("mystery".to_string());
        let dto = unit_info_to_dto(&u);
        assert_eq!(dto.kind, "other");
        assert_eq!(dto.active_state, "unknown:half-active");
        assert_eq!(dto.load_state, "unknown:loaded-ish");
        assert_eq!(dto.unit_file_state, "unknown:mystery");
    }

    #[test]
    fn list_units_fixture_roundtrip_via_dto() {
        let units = crate::fixture::list_units_fixture();
        let dtos: Vec<UnitStatusDto> = units.iter().map(unit_info_to_dto).collect();
        assert_eq!(dtos.len(), units.len());
        assert!(dtos.iter().all(|d| !d.name.is_empty()));
    }

    #[test]
    fn unit_filter_deserialize() {
        let json = r#"{"kinds":["Service","Timer"],"active_only":true,"max_results":50}"#;
        let f: crate::types::UnitFilter = serde_json::from_str(json).expect("should deserialize");
        assert_eq!(f.max_results, 50);
        assert!(f.active_only);
        assert_eq!(
            f.kinds,
            Some(vec![crate::types::UnitKind::Service, crate::types::UnitKind::Timer])
        );
    }
}
