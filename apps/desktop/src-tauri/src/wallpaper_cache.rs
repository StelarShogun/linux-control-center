//! Caché JSON del catálogo bajo `{data_dir}/cache/wallpaper_catalog.json`.

use std::path::{Path, PathBuf};

use wallpaper_catalog::CatalogDiskFile;

pub fn cache_path(data_dir: &Path) -> PathBuf {
    data_dir.join("cache").join("wallpaper_catalog.json")
}

pub fn load(data_dir: &Path) -> Option<CatalogDiskFile> {
    let p = cache_path(data_dir);
    let s = std::fs::read_to_string(p).ok()?;
    serde_json::from_str(&s).ok()
}

pub fn save(data_dir: &Path, disk: &CatalogDiskFile) -> Result<(), String> {
    let p = cache_path(data_dir);
    if let Some(d) = p.parent() {
        std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(disk).map_err(|e| e.to_string())?;
    std::fs::write(&p, json).map_err(|e| e.to_string())
}
