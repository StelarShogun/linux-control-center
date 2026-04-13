//! Comandos Tauri — Wallpaper Module (Fase E).

use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use core_model::{
    journal::{truncate_journal_error, JournalOperationAction, OperationJournalEntry},
    snapshot::create_snapshot as create_snapshot_model,
    validate::validate_settings,
    validate_wallpaper_id,
    wallpaper::{
        CurrentWallpaperState, WallpaperApplyResult, WallpaperBackendStatus, WallpaperCollection,
        WallpaperConfidence, WallpaperFilter, WallpaperId, WallpaperKind, WallpaperPreview,
    },
};
use time::format_description::well_known::Rfc3339;
use tauri::State;
use wallpaper_catalog::{rebuild_from_disk, scan_catalog, CatalogError, MAX_CATALOG_ENTRIES};
use wallpaper_engine_adapter::{detect_backend, query_current_wallpaper, wallpaper_apply, StdCommandRunner};

use crate::{
    persistence::{self, PersistenceError},
    state::AppState,
    wallpaper_cache,
};

const JOURNAL_ERR_MAX: usize = 512;
const MAX_PREVIEW_BYTES: usize = 400_000;

fn map_err(e: PersistenceError) -> String {
    e.to_string()
}

fn save_journal_best_effort(data_dir: &std::path::Path, entry: &OperationJournalEntry) {
    if let Err(e) = persistence::save_journal_entry(data_dir, entry) {
        log::warn!("failed to persist journal entry: {e}");
    }
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn now_rfc3339() -> String {
    time::OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn load_catalog_into_state(
    data_dir: &Path,
    state: &AppState,
) -> Result<(), String> {
    let Some(home) = home_dir() else {
        return Ok(());
    };
    let Some(disk) = wallpaper_cache::load(data_dir) else {
        return Ok(());
    };
    let Some((col, map)) = rebuild_from_disk(&home, &disk) else {
        return Ok(());
    };
    let mut w = state
        .wallpaper
        .lock()
        .map_err(|_| "wallpaper state lock poisoned".to_string())?;
    w.collection = Some(col);
    w.id_to_path = map;
    Ok(())
}

fn apply_filter_limit(col: &WallpaperCollection, filter: &WallpaperFilter, limit: Option<u32>) -> WallpaperCollection {
    let lim = limit
        .map(|n| n as usize)
        .unwrap_or(MAX_CATALOG_ENTRIES)
        .min(MAX_CATALOG_ENTRIES);
    let entries: Vec<_> = col
        .entries
        .iter()
        .filter(|e| {
            if let Some(k) = filter.kind {
                if e.kind != k {
                    return false;
                }
            }
            if let Some(s) = filter.source {
                if e.source != s {
                    return false;
                }
            }
            true
        })
        .take(lim)
        .cloned()
        .collect();
    let entry_count = entries.len();
    WallpaperCollection {
        entries,
        generated_at: col.generated_at.clone(),
        scan_stats: core_model::wallpaper::WallpaperScanStats {
            entry_count,
            truncated: col.scan_stats.truncated,
            max_entries: lim,
            warnings: col.scan_stats.warnings.clone(),
        },
    }
}

#[derive(Debug, serde::Deserialize, Default)]
#[serde(default)]
pub struct ListWallpapersArgs {
    pub filter: WallpaperFilter,
    pub limit: Option<u32>,
}

/// Lista wallpapers desde el catálogo en memoria (o reconstruye desde caché en disco).
#[tauri::command]
pub fn list_wallpapers(
    state: State<'_, AppState>,
    args: ListWallpapersArgs,
) -> Result<WallpaperCollection, String> {
    {
        let w = state
            .wallpaper
            .lock()
            .map_err(|_| "wallpaper state lock poisoned".to_string())?;
        if w.collection.is_some() {
            let col = w.collection.as_ref().unwrap();
            return Ok(apply_filter_limit(col, &args.filter, args.limit));
        }
    }
    load_catalog_into_state(&state.data_dir, &state)?;
    let w = state
        .wallpaper
        .lock()
        .map_err(|_| "wallpaper state lock poisoned".to_string())?;
    let col = w.collection.clone().unwrap_or_else(|| WallpaperCollection {
        entries: vec![],
        generated_at: now_rfc3339(),
        scan_stats: core_model::wallpaper::WallpaperScanStats {
            entry_count: 0,
            truncated: false,
            max_entries: MAX_CATALOG_ENTRIES,
            warnings: vec!["catálogo vacío — usa Actualizar".into()],
        },
    });
    Ok(apply_filter_limit(&col, &args.filter, args.limit))
}

/// Fuerza un escaneo y persiste caché.
#[tauri::command]
pub fn refresh_wallpaper_catalog(state: State<'_, AppState>) -> Result<WallpaperCollection, String> {
    let home = home_dir().ok_or_else(|| "HOME no definido".to_string())?;
    let (col, map, disk) = scan_catalog(&home, &WallpaperFilter::default(), None).map_err(|e: CatalogError| {
        e.to_string()
    })?;
    wallpaper_cache::save(&state.data_dir, &disk)?;
    {
        let mut w = state
            .wallpaper
            .lock()
            .map_err(|_| "wallpaper state lock poisoned".to_string())?;
        w.collection = Some(col.clone());
        w.id_to_path = map;
    }
    Ok(col)
}

#[derive(Debug, serde::Deserialize)]
pub struct GetWallpaperPreviewArgs {
    pub id: String,
}

#[tauri::command]
pub fn get_wallpaper_preview(
    state: State<'_, AppState>,
    args: GetWallpaperPreviewArgs,
) -> Result<WallpaperPreview, String> {
    validate_wallpaper_id(&args.id).map_err(|e| e.to_string())?;
    load_catalog_into_state(&state.data_dir, &state)?;
    let path = {
        let w = state
            .wallpaper
            .lock()
            .map_err(|_| "wallpaper state lock poisoned".to_string())?;
        w.id_to_path.get(&args.id).cloned()
    };
    let Some(path) = path else {
        return Ok(WallpaperPreview::Unavailable {
            reason: "id no encontrado en el catálogo; actualiza el catálogo".into(),
        });
    };
    let entry = {
        let w = state.wallpaper.lock().map_err(|_| "lock poisoned".to_string())?;
        w.collection
            .as_ref()
            .and_then(|c| c.entries.iter().find(|e| e.id.as_str() == args.id))
            .cloned()
    };
    let kind = entry.map(|e| e.kind).unwrap_or(WallpaperKind::Other);
    match kind {
        WallpaperKind::Image => {
            if !path.is_file() {
                return Ok(WallpaperPreview::Unavailable {
                    reason: "archivo no encontrado".into(),
                });
            }
            let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
            if meta.len() as usize > MAX_PREVIEW_BYTES {
                return Ok(WallpaperPreview::Unavailable {
                    reason: "archivo demasiado grande para vista previa inline".into(),
                });
            }
            let bytes = fs::read(&path).map_err(|e| e.to_string())?;
            let mime = guess_mime(&path);
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Ok(WallpaperPreview::StaticImage {
                mime,
                data_base64: b64,
            })
        }
        WallpaperKind::Video | WallpaperKind::WallpaperEngineProject | WallpaperKind::Other => {
            Ok(WallpaperPreview::Unavailable {
                reason: "vista previa no disponible para este tipo en v1".into(),
            })
        }
    }
}

fn guess_mime(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    }
    .to_string()
}

#[tauri::command]
pub fn get_wallpaper_backend_status() -> WallpaperBackendStatus {
    detect_backend(&StdCommandRunner)
}

#[tauri::command]
pub fn get_current_wallpaper(state: State<'_, AppState>) -> Result<CurrentWallpaperState, String> {
    let checked_at = now_rfc3339();
    let last = state
        .current
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .wallpaper
        .last_applied_wallpaper_id
        .clone();
    let last_id = last.map(WallpaperId);
    let runner = StdCommandRunner;
    let reported = match query_current_wallpaper(&runner) {
        Ok(o) => o,
        Err(_) => None,
    };
    let confidence = if reported.is_some() {
        WallpaperConfidence::ReportedByBackend
    } else if last_id.is_some() {
        WallpaperConfidence::KnownFromApp
    } else {
        WallpaperConfidence::Unknown
    };
    Ok(CurrentWallpaperState {
        last_applied_by_app: last_id,
        reported_by_backend: reported,
        checked_at,
        confidence,
    })
}

#[derive(Debug, serde::Deserialize)]
pub struct ApplyWallpaperArgs {
    pub id: String,
}

#[tauri::command]
pub fn apply_wallpaper(state: State<'_, AppState>, args: ApplyWallpaperArgs) -> Result<WallpaperApplyResult, String> {
    validate_wallpaper_id(&args.id).map_err(|e| e.to_string())?;
    let data_dir = state.data_dir.clone();
    let op_id = persistence::new_journal_operation_id();
    let started_at = now_rfc3339();
    let inner = apply_wallpaper_inner(&state, &args.id);
    let finished_at = now_rfc3339();
    let entry = match &inner {
        Ok(r) => OperationJournalEntry {
            operation_id: op_id.clone(),
            action: JournalOperationAction::ApplyWallpaper,
            target: format!("wallpaper:{}", args.id),
            started_at: started_at.clone(),
            finished_at,
            success: r.ok,
            snapshot_id: None,
            backup_file_name: None,
            written_path: None,
            reload_status: None,
            error_summary: if r.ok {
                None
            } else {
                Some(truncate_journal_error(
                    &r.warnings
                        .first()
                        .cloned()
                        .or_else(|| r.backend_message.clone())
                        .unwrap_or_else(|| "apply failed".into()),
                    JOURNAL_ERR_MAX,
                ))
            },
        },
        Err(e) => OperationJournalEntry {
            operation_id: op_id,
            action: JournalOperationAction::ApplyWallpaper,
            target: format!("wallpaper:{}", args.id),
            started_at,
            finished_at,
            success: false,
            snapshot_id: None,
            backup_file_name: None,
            written_path: None,
            reload_status: None,
            error_summary: Some(truncate_journal_error(e, JOURNAL_ERR_MAX)),
        },
    };
    save_journal_best_effort(&data_dir, &entry);
    inner
}

fn apply_wallpaper_inner(state: &AppState, id: &str) -> Result<WallpaperApplyResult, String> {
    load_catalog_into_state(&state.data_dir, state)?;
    let path = {
        let w = state
            .wallpaper
            .lock()
            .map_err(|_| "wallpaper state lock poisoned".to_string())?;
        w.id_to_path.get(id).cloned()
    };
    let Some(path) = path else {
        return Ok(WallpaperApplyResult {
            ok: false,
            applied_id: None,
            backend_message: None,
            already_active: false,
            warnings: vec!["id no está en el catálogo".into()],
        });
    };
    let current_last = state
        .current
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .wallpaper
        .last_applied_wallpaper_id
        .clone();
    if current_last.as_deref() == Some(id) {
        return Ok(WallpaperApplyResult {
            ok: true,
            applied_id: Some(WallpaperId(id.to_string())),
            backend_message: Some("ya era el wallpaper seleccionado en LCC".into()),
            already_active: true,
            warnings: vec![],
        });
    }
    let runner = StdCommandRunner;
    match wallpaper_apply(&runner, &path) {
        Ok(msg) => {
            let mut settings = state
                .current
                .lock()
                .map_err(|_| "lock poisoned".to_string())?
                .clone();
            settings.wallpaper.last_applied_wallpaper_id = Some(id.to_string());
            settings.wallpaper.last_successful_apply_at = Some(now_rfc3339());
            validate_settings(&settings).map_err(|e| e.to_string())?;
            {
                let mut g = state
                    .current
                    .lock()
                    .map_err(|_| "lock poisoned".to_string())?;
                *g = settings.clone();
            }
            persistence::save_current_settings(&state.data_dir, &settings).map_err(map_err)?;
            let snapshot_id = persistence::new_snapshot_id();
            let snap = create_snapshot_model(
                snapshot_id.clone(),
                now_rfc3339(),
                Some("wallpaper:apply".into()),
                None,
                settings,
            );
            if let Err(e) = persistence::save_snapshot(&state.data_dir, &snap) {
                log::warn!("wallpaper apply: snapshot failed: {e}");
            }
            Ok(WallpaperApplyResult {
                ok: true,
                applied_id: Some(WallpaperId(id.to_string())),
                backend_message: Some(msg).filter(|s| !s.is_empty()),
                already_active: false,
                warnings: vec![],
            })
        }
        Err(e) => Ok(WallpaperApplyResult {
            ok: false,
            applied_id: None,
            backend_message: Some(e.to_string()),
            already_active: false,
            warnings: vec![e.to_string()],
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_filter_respects_kind() {
        let col = WallpaperCollection {
            entries: vec![],
            generated_at: "t".into(),
            scan_stats: core_model::wallpaper::WallpaperScanStats {
                entry_count: 0,
                truncated: false,
                max_entries: 10,
                warnings: vec![],
            },
        };
        let f = WallpaperFilter {
            kind: Some(WallpaperKind::Image),
            source: None,
        };
        let out = apply_filter_limit(&col, &f, None);
        assert_eq!(out.entries.len(), 0);
    }
}
