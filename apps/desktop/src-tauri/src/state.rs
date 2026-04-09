use std::{path::PathBuf, sync::Mutex};

use core_model::settings::AppSettings;

pub struct AppState {
    pub data_dir: PathBuf,
    pub current: Mutex<AppSettings>,
}

