//! Discovery de wallpapers bajo raíces allowlist (Fase E).
//!
//! No aplica wallpapers ni habla con el frontend. Expone scan + caché serializable.

mod scan;

pub use scan::{
    current_state_placeholder, default_roots, fingerprint_roots, rebuild_from_disk, scan_catalog,
    CatalogDiskFile, CatalogDiskRow, CatalogError, MAX_CATALOG_ENTRIES,
};
