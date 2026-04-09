#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub mod commands;
pub mod persistence;
pub mod state;
pub mod types;
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
        Ok(None) => core_model::settings::AppSettings::default(),
        Err(e) => {
          log::warn!("failed to load settings.toml, using defaults: {e}");
          core_model::settings::AppSettings::default()
        }
      };

      app.manage(state::AppState {
        data_dir,
        current: std::sync::Mutex::new(initial),
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::get_current_settings,
      commands::list_snapshots,
      commands::save_profile,
      commands::save_settings,
      commands::create_snapshot,
      commands::restore_snapshot,
      commands::apply_config_to_sandbox,
      commands::apply_config_to_real_path,
      commands::apply_live_hyprland,
      commands::rollback_config_file,
      commands::rollback_full_state,
      commands::preview_hyprland_config,
      commands::preview_waybar_config,
      commands::preview_rofi_config,
      commands::list_systemd_units,
      commands::get_systemd_unit,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
