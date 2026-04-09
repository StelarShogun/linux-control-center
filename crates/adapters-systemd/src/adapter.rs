use crate::types::{
    ActiveState, LoadState, SystemdBus, SystemdError, UnitFileState, UnitFilter, UnitInfo, UnitKind,
};

#[derive(Debug, Clone, PartialEq, Eq, zbus::zvariant::Type, serde::Deserialize)]
struct UnitEntry {
    name: String,
    description: String,
    load_state: String,
    active_state: String,
    sub_state: String,
    following: String,
    unit_object_path: zbus::zvariant::OwnedObjectPath,
    job_id: u32,
    job_type: String,
    job_object_path: zbus::zvariant::OwnedObjectPath,
}

#[zbus::proxy(
    interface = "org.freedesktop.systemd1.Manager",
    default_service = "org.freedesktop.systemd1",
    default_path = "/org/freedesktop/systemd1"
)]
trait SystemdManager {
    fn list_units(&self) -> zbus::Result<Vec<UnitEntry>>;
    fn get_unit_file_state(&self, name: &str) -> zbus::Result<String>;
}

async fn connect(bus: SystemdBus) -> Result<zbus::Connection, SystemdError> {
    Ok(match bus {
        SystemdBus::System => zbus::Connection::system().await?,
        SystemdBus::Session => zbus::Connection::session().await?,
    })
}

fn validate_unit_name(name: &str) -> Result<(), SystemdError> {
    if name.is_empty() {
        return Err(SystemdError::InvalidUnitName(name.to_string()));
    }
    if name.chars().any(|c| c.is_whitespace()) {
        return Err(SystemdError::InvalidUnitName(name.to_string()));
    }
    Ok(())
}

fn map_entry_to_unit_info(entry: UnitEntry, unit_file_state: UnitFileState) -> UnitInfo {
    let kind = UnitKind::from_unit_name(&entry.name);
    UnitInfo {
        name: entry.name,
        description: entry.description,
        kind,
        load_state: LoadState::from(entry.load_state.as_str()),
        active_state: ActiveState::from(entry.active_state.as_str()),
        sub_state: entry.sub_state,
        unit_file_state,
        fragment_path: None,
    }
}

/// Lista unidades systemd (solo lectura).
///
/// Nota: para evitar \(N\) llamadas D-Bus, `unit_file_state` se devuelve como
/// `UnitFileState::Unknown("not_queried")` en esta fase.
pub async fn list_units(bus: SystemdBus, filter: UnitFilter) -> Result<Vec<UnitInfo>, SystemdError> {
    let conn = connect(bus).await?;
    let proxy = SystemdManagerProxy::new(&conn).await?;
    let entries = proxy.list_units().await?;

    let mut units: Vec<UnitInfo> = entries
        .into_iter()
        .map(|e| map_entry_to_unit_info(e, UnitFileState::Unknown("not_queried".to_string())))
        .collect();

    units.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(filter.apply(&units))
}

/// Consulta el estado básico de una unidad concreta (solo lectura).
///
/// Esta función sí consulta `unit_file_state` vía D-Bus para el nombre indicado.
pub async fn get_unit_status(bus: SystemdBus, name: &str) -> Result<UnitInfo, SystemdError> {
    validate_unit_name(name)?;

    let conn = connect(bus).await?;
    let proxy = SystemdManagerProxy::new(&conn).await?;

    let file_state_raw = proxy.get_unit_file_state(name).await?;
    let file_state = UnitFileState::from(file_state_raw.as_str());

    let entries = proxy.list_units().await?;
    let entry = entries
        .into_iter()
        .find(|e| e.name == name)
        .ok_or_else(|| SystemdError::InvalidUnitName(name.to_string()))?;

    Ok(map_entry_to_unit_info(entry, file_state))
}
