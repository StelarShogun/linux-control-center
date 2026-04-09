//! Wrapper del backend externo de wallpapers (Fase E).
//!
//! Contrato documentado: el binario configurado recibe subcomandos fijos, sin shell arbitrario.

mod cli;

pub use cli::{
    default_apply_bin_candidates, detect_backend, query_current_wallpaper, validate_apply_binary,
    wallpaper_apply, AdapterError, CommandRunner, StdCommandRunner, DEFAULT_TIMEOUT_APPLY_MS,
    DEFAULT_TIMEOUT_DETECT_MS,
};
