/// Re-exports types from `core-model` used across the Tauri IPC layer.
/// This keeps `commands.rs` and `persistence.rs` decoupled from presentation details.
pub use core_model::snapshot::SnapshotInfo;
