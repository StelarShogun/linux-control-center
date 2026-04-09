use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use core_model::settings::AppSettings;
use core_model::wallpaper::WallpaperCollection;

/// Catálogo de wallpapers en memoria + resolución id → ruta (nunca expuesta al frontend).
#[derive(Debug)]
pub struct WallpaperRuntime {
    pub collection: Option<WallpaperCollection>,
    pub id_to_path: HashMap<String, PathBuf>,
}

impl Default for WallpaperRuntime {
    fn default() -> Self {
        Self {
            collection: None,
            id_to_path: HashMap::new(),
        }
    }
}

pub struct AppState {
    pub data_dir: PathBuf,
    pub current: Mutex<AppSettings>,
    pub wallpaper: Mutex<WallpaperRuntime>,
}
