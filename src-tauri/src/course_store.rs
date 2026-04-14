use crate::course_model::Timeline;
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};

/// Resolved course storage paths, computed once at app startup.
///
/// `primary` is the writable directory for all new writes.  
/// `legacy` is an optional read-only fallback (used in dev when CWD == `src-tauri`).
pub struct CourseDirs {
  pub primary: PathBuf,
  /// Optional secondary directory to search when reading, but never written to.
  pub legacy: Option<PathBuf>,
}

pub fn sanitize_course_id(course_id: &str) -> Result<String, String> {
  let normalized = course_id.trim();
  if normalized.is_empty() {
    return Err("course id cannot be empty".to_string());
  }

  if normalized.len() > 80 {
    return Err("course id is too long (max 80 characters)".to_string());
  }

  for ch in normalized.chars() {
    let ok = ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_';
    if !ok {
      return Err(
        "course id contains invalid characters; use lowercase letters, digits, dash, underscore"
          .to_string(),
      );
    }
  }

  if !normalized
    .chars()
    .next()
    .map(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit())
    .unwrap_or(false)
  {
    return Err("course id must start with a lowercase letter or digit".to_string());
  }

  Ok(normalized.to_string())
}

pub fn course_file_path(course_id: &str, dirs: &CourseDirs) -> Result<PathBuf, String> {
  let safe_id = sanitize_course_id(course_id)?;
  Ok(dirs.primary.join(format!("{safe_id}.json")))
}

pub fn list_course_ids(dirs: &CourseDirs) -> Result<Vec<String>, String> {
  fs::create_dir_all(&dirs.primary)
    .map_err(|e| format!("failed to create courses directory: {e}"))?;

  let mut candidates: Vec<PathBuf> = Vec::new();

  let primary_entries =
    fs::read_dir(&dirs.primary).map_err(|e| format!("failed to list courses directory: {e}"))?;
  for entry in primary_entries.filter_map(|entry| entry.ok()) {
    candidates.push(entry.path());
  }

  if let Some(legacy_dir) = &dirs.legacy {
    if legacy_dir != &dirs.primary && legacy_dir.exists() {
      let legacy_entries = fs::read_dir(legacy_dir)
        .map_err(|e| format!("failed to list legacy courses directory: {e}"))?;
      for entry in legacy_entries.filter_map(|entry| entry.ok()) {
        candidates.push(entry.path());
      }
    }
  }

  let mut ids: Vec<String> = candidates
    .into_iter()
    .filter(|path| path.extension() == Some(OsStr::new("json")))
    .filter_map(|path| path.file_stem().map(|stem| stem.to_string_lossy().to_string()))
    .filter_map(|id| sanitize_course_id(&id).ok())
    .collect();

  ids.sort();
  ids.dedup();
  Ok(ids)
}

pub fn read_course_json(course_id: &str, dirs: &CourseDirs) -> Result<String, String> {
  let safe_id = sanitize_course_id(course_id)?;
  let path = dirs.primary.join(format!("{safe_id}.json"));
  if path.exists() {
    return fs::read_to_string(&path)
      .map_err(|e| format!("failed to read course file '{}': {e}", path.display()));
  }

  if let Some(legacy_dir) = &dirs.legacy {
    let legacy_path = legacy_dir.join(format!("{safe_id}.json"));
    if legacy_path.exists() {
      return fs::read_to_string(&legacy_path)
        .map_err(|e| format!("failed to read legacy course file '{}': {e}", legacy_path.display()));
    }
  }

  Err(format!("course '{course_id}' was not found"))
}

pub fn write_course_json_atomic(course_id: &str, json: &str, dirs: &CourseDirs) -> Result<(PathBuf, usize), String> {
  fs::create_dir_all(&dirs.primary)
    .map_err(|e| format!("failed to create courses directory: {e}"))?;
  let target = course_file_path(course_id, dirs)?;
  let temp_name = format!("{}.tmp", target.file_name().unwrap_or_default().to_string_lossy());
  let tmp_path = target.with_file_name(temp_name);

  fs::write(&tmp_path, json)
    .map_err(|e| format!("failed to write temporary course file '{}': {e}", tmp_path.display()))?;

  if target.exists() {
    fs::remove_file(&target)
      .map_err(|e| format!("failed to replace existing course file '{}': {e}", target.display()))?;
  }

  if let Err(err) = fs::rename(&tmp_path, &target) {
    let _ = fs::remove_file(&tmp_path);
    return Err(format!(
      "failed to move temporary course file into place '{}': {err}",
      target.display()
    ));
  }

  Ok((target, json.len()))
}

pub fn delete_course(course_id: &str, dirs: &CourseDirs) -> Result<bool, String> {
  let path = course_file_path(course_id, dirs)?;
  let mut deleted = false;

  if path.exists() {
    fs::remove_file(&path)
      .map_err(|e| format!("failed to delete course file '{}': {e}", path.display()))?;
    deleted = true;
  }

  if let Some(legacy_dir) = &dirs.legacy {
    let safe_id = sanitize_course_id(course_id)?;
    let legacy_path = legacy_dir.join(format!("{safe_id}.json"));
    if legacy_path != path && legacy_path.exists() {
      fs::remove_file(&legacy_path).map_err(|e| {
        format!(
          "failed to delete legacy course file '{}': {e}",
          legacy_path.display()
        )
      })?;
      deleted = true;
    }
  }

  Ok(deleted)
}

pub fn parse_timeline(json: &str) -> Result<Timeline, String> {
  serde_json::from_str::<Timeline>(json).map_err(|e| format!("invalid course JSON: {e}"))
}

pub fn serialize_timeline_pretty(document: &Timeline) -> Result<String, String> {
  serde_json::to_string_pretty(document).map_err(|e| format!("failed to serialize course JSON: {e}"))
}

pub fn file_name_from_path(path: &Path) -> String {
  path
    .file_name()
    .unwrap_or_default()
    .to_string_lossy()
    .to_string()
}

#[cfg(test)]
mod tests {
  use super::sanitize_course_id;

  #[test]
  fn sanitize_accepts_expected_values() {
    assert_eq!(sanitize_course_id("gh-300").expect("id should be valid"), "gh-300");
    assert_eq!(sanitize_course_id("course_1").expect("id should be valid"), "course_1");
  }

  #[test]
  fn sanitize_rejects_invalid_values() {
    assert!(sanitize_course_id("../etc").is_err());
    assert!(sanitize_course_id("Course").is_err());
    assert!(sanitize_course_id("space value").is_err());
  }
}
