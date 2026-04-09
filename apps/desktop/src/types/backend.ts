/**
 * Estado de la conexión con el backend Tauri.
 * Importar desde aquí en lugar de declarar el tipo inline en cada componente.
 */
export type BackendStatus = "loading" | "ready" | "unavailable";
