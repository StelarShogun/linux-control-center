#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub mod commands;
pub mod persistence;
pub mod state;
pub mod types;
pub mod wallpaper_cache;
pub mod wallpaper_ipc;
use std::path::PathBuf;
use tauri::Manager;

pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let data_dir = app.path().app_data_dir()?;

      let initial = match persistence::load_current_settings(&data_dir) {
        Ok(Some(s)) => s,
        Ok(None) => {
          // Primera vez sin settings.toml: importar desde los archivos del sistema real.
          let imported = core_model::settings::AppSettings {
            appearance: core_model::settings::AppearanceSettings::default(),
            hyprland: adapters_hyprland::read_from_system(),
            waybar: adapters_waybar::read_from_system(),
            rofi: adapters_rofi::read_from_system(),
            wallpaper: core_model::settings::WallpaperAppPreferences::default(),
          };
          // Persistir para que próximos arranques no relean disco innecesariamente.
          if let Err(e) = persistence::save_current_settings(&data_dir, &imported) {
            log::warn!("failed to persist imported settings: {e}");
          }
          imported
        }
        Err(e) => {
          log::warn!("failed to load settings.toml, using defaults: {e}");
          core_model::settings::AppSettings::default()
        }
      };

      let mut wallpaper_rt = state::WallpaperRuntime::default();
      if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        if let Some(disk) = wallpaper_cache::load(&data_dir) {
          if let Some((col, map)) = wallpaper_catalog::rebuild_from_disk(&home, &disk) {
            wallpaper_rt.collection = Some(col);
            wallpaper_rt.id_to_path = map;
          }
        }
      }

      app.manage(state::AppState {
        data_dir,
        current: std::sync::Mutex::new(initial),
        wallpaper: std::sync::Mutex::new(wallpaper_rt),
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::get_current_settings,
      commands::list_snapshots,
      commands::save_profile,
      commands::list_profiles_cmd,
      commands::delete_profile_cmd,
      commands::load_profile_settings,
      commands::update_profile_cmd,
      commands::get_active_profile,
      commands::set_active_profile,
      commands::save_settings,
      commands::create_snapshot,
      commands::restore_snapshot,
      commands::apply_config_to_sandbox,
      commands::apply_config_to_real_path,
      commands::apply_live_hyprland,
      commands::apply_live_waybar,
      commands::rollback_config_file,
      commands::rollback_full_state,
      commands::preview_hyprland_config,
      commands::hyprctl_get_option,
      commands::hyprctl_set_keyword,
      commands::hyprctl_binds_json,
      commands::hyprctl_monitors_json,
      commands::hyprctl_version_json,
      commands::hyprctl_devices_json,
      commands::hyprctl_reload,
      commands::preview_waybar_config,
      commands::read_waybar_style_disk,
      commands::preview_rofi_config,
      commands::list_systemd_units,
      commands::get_systemd_unit,
      commands::import_system_settings,
      commands::list_network_interfaces,
      commands::get_power_status,
      commands::get_suspend_settings,
      commands::set_power_profile,
      commands::set_suspend_settings,
      commands::inspect_hyprland_setup_cmd,
      commands::repair_hyprland_main_include,
      commands::list_hyprland_main_backups_cmd,
      commands::list_recent_operations,
      commands::audit_config_backups,
      commands::delete_orphan_backup,
      commands::list_theme_presets,
      commands::get_theme_preview,
      commands::apply_theme,
      wallpaper_ipc::list_wallpapers,
      wallpaper_ipc::refresh_wallpaper_catalog,
      wallpaper_ipc::get_wallpaper_preview,
      wallpaper_ipc::get_current_wallpaper,
      wallpaper_ipc::get_wallpaper_backend_status,
      wallpaper_ipc::apply_wallpaper,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
