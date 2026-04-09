//! # adapters-systemd (read-only)
//!
//! Adapter de **solo lectura** para consultar unidades systemd.
//!
//! ## Garantías de esta fase
//! - No expone comandos de escritura (start/stop/restart/enable/disable).
//! - No ejecuta shell.
//! - El objetivo es modelar datos y ofrecer lectura básica vía D-Bus (`zbus`).
//!
//! ## Nota sobre permisos
//! - Leer estado suele ser posible sin privilegios.
//! - Cualquier futura capacidad de escritura se hará en otra capa (p.ej. `privileged-helper`).

pub mod adapter;
pub mod dto;
pub mod fixture;
pub mod types;

pub use adapter::{get_unit_status, list_units};
pub use dto::{unit_info_to_dto, ListUnitsResponse, UnitStatusDto};
pub use fixture::list_units_fixture;
pub use types::{
    ActiveState, LoadState, SystemdBus, SystemdError, UnitFileState, UnitFilter, UnitInfo, UnitKind,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixture_is_non_empty() {
        let list = list_units_fixture();
        assert!(!list.is_empty());
    }

    #[test]
    fn filter_by_kind_narrows_results() {
        let list = list_units_fixture();
        let f = UnitFilter {
            kinds: Some(vec![UnitKind::Service]),
            active_only: false,
            max_results: 100,
        };
        let filtered = f.apply(&list);
        assert!(!filtered.is_empty());
        assert!(filtered.iter().all(|u| u.kind == UnitKind::Service));
    }

    #[test]
    fn filter_active_only_eliminates_inactive() {
        let list = list_units_fixture();
        let f = UnitFilter {
            kinds: None,
            active_only: true,
            max_results: 100,
        };
        let filtered = f.apply(&list);
        assert!(!filtered.is_empty());
        assert!(filtered.iter().all(|u| u.active_state == ActiveState::Active));
    }

    #[test]
    fn max_results_is_respected() {
        let list = list_units_fixture();
        let f = UnitFilter {
            kinds: None,
            active_only: false,
            max_results: 2,
        };
        let filtered = f.apply(&list);
        assert_eq!(filtered.len(), 2);
    }
}
