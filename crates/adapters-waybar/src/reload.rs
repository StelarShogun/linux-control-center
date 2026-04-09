//! Recarga en vivo de Waybar vía señal al proceso (documentado en `waybar(1)`).

use crate::types::ReloadOutput;

/// Envía `SIGUSR2` a procesos llamados `waybar` para que recarguen `config.jsonc` / estilo.
///
/// - Sin shell: solo `pkill` con argumentos fijos.
/// - Si Waybar no está en ejecución, `pkill` suele devolver código ≠ 0 → `ok: false`.
/// - Requiere `pkill` en PATH (p. ej. paquete **procps** en Arch).
pub fn reload_waybar() -> ReloadOutput {
    match std::process::Command::new("pkill")
        .args(["-USR2", "waybar"])
        .output()
    {
        Ok(out) => ReloadOutput {
            ok: out.status.success(),
            output: format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            )
            .trim()
            .to_string(),
        },
        Err(e) => ReloadOutput {
            ok: false,
            output: format!("pkill not available: {e}"),
        },
    }
}
