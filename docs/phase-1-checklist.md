# Phase 1 Checklist

## Entregables implementados

- [x] `docs/architecture.md` — visión general, capas, flujo, riesgos
- [x] `docs/phase-1-checklist.md` — este archivo
- [x] `fixtures/hyprland/hyprland.conf` — fixture mínimo realista
- [x] `fixtures/waybar/config.jsonc` — fixture mínimo realista
- [x] `fixtures/rofi/config.rasi` — fixture mínimo realista
- [x] `profiles/default.toml` — perfil base coherente
- [x] `crates/core-model` — tipos de dominio, validación, snapshot, diff
  - [x] `error.rs` — `CoreError` con variantes tipadas
  - [x] `settings.rs` — `AppSettings`, `AppearanceSettings`, `HyprlandSettings`, `WaybarSettings`, `RofiSettings`
  - [x] `profile.rs` — `ProfileMetadata`, `SettingsProfile`, load/save TOML
  - [x] `snapshot.rs` — `SnapshotId`, `SettingsSnapshot`, `create_snapshot`
  - [x] `diff.rs` — `DiffEntry`, `SettingsDiff`, `compute_diff`
  - [x] `validate.rs` — `validate_settings` con checks básicos
  - [x] `lib.rs` — exports limpios + tests básicos
- [x] `crates/adapters-hyprland` — adapter de fixtures, sin tocar el sistema
  - [x] `types.rs` — `HyprlandFixtureResult`
  - [x] `adapter.rs` — `load_fixture`, `export_from_settings`
  - [x] `lib.rs` — exports + tests básicos
- [x] `crates/adapters-waybar` — adapter de fixtures, sin tocar el sistema
  - [x] `types.rs` — `WaybarFixtureResult`
  - [x] `adapter.rs` — `load_fixture`, `export_from_settings`
  - [x] `lib.rs` — exports + tests básicos
- [x] `crates/adapters-rofi` — placeholder limpio con TODO explícito
- [x] `crates/adapters-systemd` — placeholder limpio con TODO explícito
- [x] `crates/privileged-helper` — placeholder limpio con TODO explícito
- [x] `apps/desktop/src/types/settings.ts` — tipos TS alineados con core-model
- [x] `apps/desktop/src/components/Sidebar.tsx` — navegación simple
- [x] `apps/desktop/src/pages/AppearancePage.tsx` — página funcional
- [x] `apps/desktop/src/pages/HyprlandPage.tsx` — página funcional
- [x] `apps/desktop/src/pages/WaybarPage.tsx` — página funcional
- [x] `apps/desktop/src/pages/RofiPage.tsx` — placeholder declarativo
- [x] `apps/desktop/src/pages/ProfilesPage.tsx` — página funcional
- [x] `apps/desktop/src/App.tsx` — layout principal con sidebar + router

## No implementado en fase 1

- [ ] Escritura real de archivos de configuración en disco
- [ ] Recarga de procesos (hyprctl, waybar, rofi)
- [ ] Integración zbus / systemd
- [ ] Operaciones privilegiadas (polkit / setuid)
- [ ] Parser propio de hyprland.conf (formato no estándar)
- [ ] Comandos Tauri IPC (backend ↔ frontend)
- [ ] Persistencia de snapshots en disco
- [ ] Detección de cambios externos (inotify)
- [ ] Multi-perfil concurrente
- [ ] Multi-monitor

## Cómo validar la fase 1

```bash
# Rust
cargo check --workspace

# TypeScript
cd apps/desktop && npx tsc --noEmit

# Tests Rust
cargo test --workspace
```
