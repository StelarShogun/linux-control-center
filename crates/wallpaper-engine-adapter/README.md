# wallpaper-engine-adapter

Wrapper **cerrado** para aplicar wallpapers vía un binario externo (p. ej. integración con Wallpaper Engine u otra herramienta del usuario).

## Contrato del binario

Definir la ruta con `LCC_WALLPAPER_APPLY_BIN` (absoluta o nombre en `PATH`). Si no está definida, se busca `lcc-wallpaper-helper` en `PATH`.

Subcomandos invocados por Linux Control Center:

1. **`--version`** — debe devolver código de salida `0` si el backend está operativo (stdout opcional).
2. **`apply <ruta_absoluta>`** — aplica el recurso; código `0` = éxito. La ruta la resuelve **solo** el backend Tauri a partir del catálogo allowlist; el frontend nunca envía rutas.
3. **`current`** — opcional; primera línea de stdout describe el wallpaper actual (texto opaco para la UI).

No se usa shell (`sh -c`); solo `std::process::Command` con argumentos fijos.

## Errores

Si el binario no existe, `get_wallpaper_backend_status` devuelve `NotInstalled`. Los fallos de `apply` se propagan como `WallpaperApplyResult.ok = false` y se registran en el Operation Journal.
