# Linux Control Center — Architecture

## Visión general

Linux Control Center es una aplicación de escritorio (Tauri + React) que permite al usuario gestionar su entorno Linux de forma coherente: apariencia, compositor Hyprland, barra Waybar, launcher Rofi y servicios systemd. Opera sobre **fixtures en fase 1** y escalará a integración real del sistema en fases posteriores.

---

## Capas del sistema

```
┌─────────────────────────────────────────┐
│            apps/desktop (UI)            │  React 19 + TypeScript
│  Sidebar / Pages / Settings forms       │
└───────────────┬─────────────────────────┘
                │ Tauri IPC (commands)
┌───────────────▼─────────────────────────┐
│        apps/desktop/src-tauri           │  Tauri 2 + Rust
│  Commands layer / Event bus             │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│            crates/core-model            │  Dominio puro, sin I/O
│  Settings / Profile / Snapshot / Diff   │
│  Validate / Error                       │
└──────┬──────┬──────┬──────┬─────────────┘
       │      │      │      │
┌──────▼──┐ ┌─▼──────▼──┐ ┌▼─────────────┐
│adapters-│ │adapters-  │ │adapters-     │
│hyprland │ │waybar     │ │rofi (TODO)   │
└──────┬──┘ └─────┬──────┘ └──────────────┘
       │           │
┌──────▼───────────▼───────────────────────┐
│           crates/privileged-helper        │  (TODO) Operaciones root
│           crates/adapters-systemd         │  (TODO) Servicios systemd
└───────────────────────────────────────────┘
```

---

## Responsabilidades por crate

| Crate | Responsabilidad |
|---|---|
| `core-model` | Tipos de dominio: `AppSettings`, `SettingsProfile`, `SettingsSnapshot`, `SettingsDiff`. Validación. Sin I/O. |
| `adapters-hyprland` | Leer/escribir configuración Hyprland. Fase 1: solo fixtures en memoria. |
| `adapters-waybar` | Leer/escribir configuración Waybar. Fase 1: solo fixtures en memoria. |
| `adapters-rofi` | Placeholder. Leerá/escribirá config Rofi. Fase 2+. |
| `adapters-systemd` | Placeholder. Control de unidades systemd vía zbus. Fase 2+. |
| `privileged-helper` | Placeholder. Operaciones que requieren permisos elevados. Fase 2+. |
| `apps/desktop/src-tauri` | Capa de comandos Tauri. Orquesta adapters y expone IPC a la UI. |

---

## Flujo de aplicación de cambios

```
Usuario edita valor en UI
    → Tauri command `apply_settings(patch)`
    → core-model::validate(patch)          [si error → devuelve Err]
    → core-model::snapshot::create(current) [guarda estado anterior]
    → adapter::export_from_settings(patch)  [genera contenido de config]
    → [FASE 2] escribir archivo en disco
    → [FASE 2] recargar proceso (hyprctl reload / waybar --reload)
    → devuelve Ok a la UI
```

En fase 1, el paso de escritura en disco y recarga **no ocurre**. El adapter devuelve el contenido generado pero no lo aplica.

---

## Estrategia de snapshots / diff / rollback

- **Snapshot**: copia inmutable de `AppSettings` en un instante dado, con `SnapshotId` (UUID v4) y timestamp.
- **Diff**: comparación campo a campo entre dos `AppSettings`. Produce un `SettingsDiff` con lista de `DiffEntry { field, old_value, new_value }`.
- **Rollback**: restaurar un snapshot previo pasándolo como `AppSettings` al flujo de aplicación de cambios.

En fase 1, snapshots se almacenan **solo en memoria** (Vec dentro del estado Tauri). Persistencia en disco en fase 2.

---

## Riesgos y decisiones pendientes

| # | Riesgo / Decisión | Estado |
|---|---|---|
| 1 | Formato interno de hyprland.conf (no es TOML ni JSON puro) | Pendiente: fase 2 definirá parser propio o wrapper de `hyprctl getoption` |
| 2 | Permisos para escribir configs del sistema | Pendiente: privileged-helper con polkit o setuid |
| 3 | Detección de cambios externos (inotify) | Pendiente: usar crate `notify` en fase 2 |
| 4 | Múltiples monitores en Hyprland | Pendiente |
| 5 | Soporte multi-perfil concurrente | No previsto en fase 1 |
| 6 | Estrategia de persistencia de snapshots | En memoria en fase 1, SQLite o archivos TOML en fase 2 |
| 7 | IPC Tauri: comandos tipados vs eventos | Decisión pendiente para fase 2 |
