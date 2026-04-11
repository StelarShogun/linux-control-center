use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use core_model::wallpaper::{
    CurrentWallpaperState, WallpaperCatalogCacheMeta, WallpaperCatalogEntry, WallpaperCollection,
    WallpaperConfidence, WallpaperEntryFlags, WallpaperFilter, WallpaperId, WallpaperKind,
    WallpaperMetadata, WallpaperScanStats, WallpaperSource,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

/// Límite duro de entradas (plan Fase E).
pub const MAX_CATALOG_ENTRIES: usize = 2000;

#[derive(Debug, Error)]
pub enum CatalogError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("home directory unknown")]
    HomeUnknown,
}

/// Fila persistible (resolución `root_index` + `rel_path` → ruta absoluta en Tauri).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogDiskRow {
    pub root_index: usize,
    pub rel_path: String,
    pub entry: WallpaperCatalogEntry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogDiskFile {
    pub meta: WallpaperCatalogCacheMeta,
    pub rows: Vec<CatalogDiskRow>,
}

#[derive(Debug, Clone)]
struct ScannedRow {
    abs_path: PathBuf,
    root_index: usize,
    rel_path: String,
    entry: WallpaperCatalogEntry,
}

/// Raíces allowlist: solo bibliotecas típicas de Wallpaper Engine bajo `home`.
pub fn default_roots(home: &Path) -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    candidates.extend([
        home.join(".local/share/wallpaper_engine/library"),
        home.join(".steam/steam/steamapps/common/wallpaper_engine/projects/defaultproject"),
        home.join(".local/share/Steam/steamapps/common/wallpaper_engine/projects/defaultproject"),
    ]);
    candidates.into_iter().filter(|p| p.is_dir()).collect()
}

pub fn fingerprint_roots(roots: &[PathBuf]) -> String {
    let mut h = Sha256::new();
    for p in roots {
        h.update(p.to_string_lossy().as_bytes());
        h.update(b"\n");
        if let Ok(m) = fs::metadata(p) {
            if let Ok(t) = m.modified() {
                if let Ok(d) = t.duration_since(std::time::UNIX_EPOCH) {
                    h.update(format!("{}", d.as_secs()).as_bytes());
                }
            }
        }
        h.update(b";");
    }
    let hex = format!("{:x}", h.finalize());
    hex.chars().take(32).collect()
}

fn make_id(prefix: &str, root_index: usize, rel: &str) -> WallpaperId {
    let mut h = Sha256::new();
    h.update(prefix.as_bytes());
    h.update(&[b':', b'r', b':']);
    h.update(root_index.to_string().as_bytes());
    h.update(rel.as_bytes());
    let hex = format!("{:x}", h.finalize());
    let short: String = hex.chars().take(16).collect();
    WallpaperId(format!("{prefix}:r{root_index}:{short}"))
}

fn walk_dir(
    root: &Path,
    root_index: usize,
    max_total: usize,
    rows: &mut Vec<ScannedRow>,
    warnings: &mut Vec<String>,
) -> std::io::Result<()> {
    if rows.len() >= max_total {
        return Ok(());
    }
    walk_inner(root, root, root_index, 0, 6, max_total, rows, warnings)
}

fn walk_inner(
    base: &Path,
    dir: &Path,
    root_index: usize,
    depth: u32,
    max_depth: u32,
    max_total: usize,
    rows: &mut Vec<ScannedRow>,
    warnings: &mut Vec<String>,
) -> std::io::Result<()> {
    if rows.len() >= max_total || depth > max_depth {
        return Ok(());
    }
    let rd = match fs::read_dir(dir) {
        Ok(r) => r,
        Err(e) => {
            warnings.push(format!("read_dir {}: {e}", dir.display()));
            return Ok(());
        }
    };
    for ent in rd.flatten() {
        if rows.len() >= max_total {
            break;
        }
        let path = ent.path();
        let meta = match ent.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if meta.is_dir() {
            let pj = path.join("project.json");
            if pj.is_file() {
                push_we_project(base, &path, root_index, max_total, rows, warnings)?;
            } else {
                walk_inner(
                    base,
                    &path,
                    root_index,
                    depth + 1,
                    max_depth,
                    max_total,
                    rows,
                    warnings,
                )?;
            }
        }
    }
    Ok(())
}

fn push_we_project(
    base: &Path,
    project_dir: &Path,
    root_index: usize,
    max_total: usize,
    rows: &mut Vec<ScannedRow>,
    warnings: &mut Vec<String>,
) -> std::io::Result<()> {
    if rows.len() >= max_total {
        return Ok(());
    }
    let rel = match project_dir.strip_prefix(base).ok().and_then(|p| p.to_str()) {
        Some(r) => r.to_string(),
        None => return Ok(()),
    };
    if rel.contains("..") {
        return Ok(());
    }
    let id = make_id("we", root_index, &rel);
    let mtime = fs::metadata(project_dir)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let title = project_dir
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("project")
        .to_string();
    let parse_error = match fs::read_to_string(project_dir.join("project.json")) {
        Ok(s) => serde_json::from_str::<serde_json::Value>(&s).is_err(),
        Err(_) => true,
    };
    let entry = WallpaperCatalogEntry {
        id: id.clone(),
        source: WallpaperSource::WallpaperEngineLibrary,
        kind: WallpaperKind::WallpaperEngineProject,
        metadata: WallpaperMetadata {
            title,
            width: None,
            height: None,
            duration_ms: None,
            dominant_color: None,
            palette_preview: None,
            engine_project_id: Some(rel.clone()),
        },
        flags: WallpaperEntryFlags {
            missing_file: !project_dir.exists(),
            thumbnail_missing: true,
            parse_error,
        },
        sort_key_mtime: mtime,
    };
    rows.push(ScannedRow {
        abs_path: project_dir.to_path_buf(),
        root_index,
        rel_path: rel,
        entry,
    });
    if parse_error {
        warnings.push(format!(
            "we project.json unreadable: {}",
            project_dir.display()
        ));
    }
    Ok(())
}

/// Escaneo completo. Devuelve colección filtrada, mapa id→ruta absoluta y archivo de caché.
pub fn scan_catalog(
    home: &Path,
    filter: &WallpaperFilter,
    limit: Option<usize>,
) -> Result<
    (
        WallpaperCollection,
        HashMap<String, PathBuf>,
        CatalogDiskFile,
    ),
    CatalogError,
> {
    let roots = default_roots(home);
    let fp = fingerprint_roots(&roots);
    let max = limit
        .unwrap_or(MAX_CATALOG_ENTRIES)
        .min(MAX_CATALOG_ENTRIES);
    let mut rows = Vec::new();
    let mut warnings = Vec::new();

    for (root_index, root) in roots.iter().enumerate() {
        walk_dir(root, root_index, max, &mut rows, &mut warnings)?;
        if rows.len() >= max {
            break;
        }
    }

    let truncated = rows.len() >= max;
    if truncated {
        warnings.push(format!("catalog truncated at {max} entries"));
    }

    rows.sort_by(|a, b| {
        b.entry
            .sort_key_mtime
            .cmp(&a.entry.sort_key_mtime)
            .then_with(|| a.entry.metadata.title.cmp(&b.entry.metadata.title))
    });

    let mut filtered: Vec<ScannedRow> = Vec::new();
    for r in rows {
        if let Some(k) = filter.kind {
            if r.entry.kind != k {
                continue;
            }
        }
        if let Some(s) = filter.source {
            if r.entry.source != s {
                continue;
            }
        }
        if filtered.len() >= max {
            break;
        }
        filtered.push(r);
    }

    let mut entries: Vec<WallpaperCatalogEntry> = Vec::new();
    let mut id_to_path: HashMap<String, PathBuf> = HashMap::new();
    let mut disk_rows: Vec<CatalogDiskRow> = Vec::new();

    for r in filtered {
        let id_str = r.entry.id.as_str().to_string();
        id_to_path.insert(id_str, r.abs_path.clone());
        disk_rows.push(CatalogDiskRow {
            root_index: r.root_index,
            rel_path: r.rel_path,
            entry: r.entry.clone(),
        });
        entries.push(r.entry);
    }

    let generated_at = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".into());

    let entry_count = entries.len();
    let collection = WallpaperCollection {
        entries,
        generated_at,
        scan_stats: WallpaperScanStats {
            entry_count,
            truncated,
            max_entries: max,
            warnings,
        },
    };

    let disk = CatalogDiskFile {
        meta: WallpaperCatalogCacheMeta {
            version: 1,
            roots_fingerprint: fp,
            entry_count,
        },
        rows: disk_rows,
    };

    Ok((collection, id_to_path, disk))
}

/// Reconstruye colección y mapa desde caché en disco. `None` si fingerprint de raíces no coincide.
pub fn rebuild_from_disk(
    home: &Path,
    disk: &CatalogDiskFile,
) -> Option<(WallpaperCollection, HashMap<String, PathBuf>)> {
    let roots = default_roots(home);
    if disk.meta.roots_fingerprint != fingerprint_roots(&roots) {
        return None;
    }
    let mut id_to_path: HashMap<String, PathBuf> = HashMap::new();
    let mut entries: Vec<WallpaperCatalogEntry> = Vec::new();
    let mut warnings = Vec::new();
    for row in &disk.rows {
        let Some(root) = roots.get(row.root_index) else {
            warnings.push(format!("unknown root_index {}", row.root_index));
            continue;
        };
        let abs = root.join(&row.rel_path);
        if abs.to_string_lossy().contains("..") {
            continue;
        }
        id_to_path.insert(row.entry.id.as_str().to_string(), abs);
        entries.push(row.entry.clone());
    }
    let generated_at = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".into());
    let entry_count = entries.len();
    let col = WallpaperCollection {
        entries,
        generated_at,
        scan_stats: WallpaperScanStats {
            entry_count,
            truncated: false,
            max_entries: MAX_CATALOG_ENTRIES,
            warnings,
        },
    };
    Some((col, id_to_path))
}

/// Estado “actual” best-effort sin backend (solo último id en prefs se rellena en Tauri).
pub fn current_state_placeholder(checked_at_rfc3339: String) -> CurrentWallpaperState {
    CurrentWallpaperState {
        last_applied_by_app: None,
        reported_by_backend: None,
        checked_at: checked_at_rfc3339,
        confidence: WallpaperConfidence::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn scan_finds_we_project_under_library() {
        let tmp = tempdir().unwrap();
        let home = tmp.path();
        let library = home.join(".local/share/wallpaper_engine/library");
        let project = library.join("cool-project");
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("project.json"), "{}\n").unwrap();

        let roots = default_roots(home);
        assert!(roots
            .iter()
            .any(|p| p.ends_with("wallpaper_engine/library")));

        let (col, map, _) = scan_catalog(home, &WallpaperFilter::default(), None).unwrap();
        assert_eq!(col.entries.len(), 1);
        assert!(map.contains_key(col.entries[0].id.as_str()));
        assert_eq!(col.entries[0].kind, WallpaperKind::WallpaperEngineProject);
        assert_eq!(
            col.entries[0].source,
            WallpaperSource::WallpaperEngineLibrary
        );
    }

    #[test]
    fn scan_ignores_raw_images_inside_we_library() {
        let tmp = tempdir().unwrap();
        let home = tmp.path();
        let library = home.join(".local/share/wallpaper_engine/library");
        fs::create_dir_all(&library).unwrap();
        fs::write(library.join("screenshot.png"), [0x89u8, 0x50, 0x4e, 0x47]).unwrap();

        let (col, _, _) = scan_catalog(home, &WallpaperFilter::default(), None).unwrap();
        assert!(col.entries.is_empty());
    }

    #[test]
    fn fingerprint_stable_for_same_roots() {
        let a = PathBuf::from("/a");
        let b = PathBuf::from("/b");
        let f1 = fingerprint_roots(&[a.clone(), b.clone()]);
        let f2 = fingerprint_roots(&[a, b]);
        assert_eq!(f1, f2);
    }
}
