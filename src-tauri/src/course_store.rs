use crate::course_model::Timeline;
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};

const COURSES_DIR: &str = "courses";

fn workspace_root() -> Result<PathBuf, String> {
  std::env::current_dir().map_err(|e| format!("failed to resolve workspace root: {e}"))
}

fn courses_dir() -> Result<PathBuf, String> {
  Ok(workspace_root()?.join(COURSES_DIR))
}

fn ensure_courses_dir() -> Result<PathBuf, String> {
  let dir = courses_dir()?;
  fs::create_dir_all(&dir).map_err(|e| format!("failed to create courses directory: {e}"))?;
  Ok(dir)
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

pub fn course_file_path(course_id: &str) -> Result<PathBuf, String> {
  let safe_id = sanitize_course_id(course_id)?;
  Ok(courses_dir()?.join(format!("{safe_id}.json")))
}

pub fn list_course_ids() -> Result<Vec<String>, String> {
  let dir = ensure_courses_dir()?;
  let entries = fs::read_dir(dir).map_err(|e| format!("failed to list courses directory: {e}"))?;

  let mut ids: Vec<String> = entries
    .filter_map(|entry| entry.ok())
    .map(|entry| entry.path())
    .filter(|path| path.extension() == Some(OsStr::new("json")))
    .filter_map(|path| path.file_stem().map(|stem| stem.to_string_lossy().to_string()))
    .filter_map(|id| sanitize_course_id(&id).ok())
    .collect();

  ids.sort();
  Ok(ids)
}

pub fn read_course_json(course_id: &str) -> Result<String, String> {
  let path = course_file_path(course_id)?;
  if !path.exists() {
    return Err(format!("course '{course_id}' was not found"));
  }

  fs::read_to_string(&path).map_err(|e| format!("failed to read course file '{}': {e}", path.display()))
}

pub fn write_course_json_atomic(course_id: &str, json: &str) -> Result<(PathBuf, usize), String> {
  let _ = ensure_courses_dir()?;
  let target = course_file_path(course_id)?;
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

pub fn delete_course(course_id: &str) -> Result<bool, String> {
  let path = course_file_path(course_id)?;
  if !path.exists() {
    return Ok(false);
  }

  fs::remove_file(&path).map_err(|e| format!("failed to delete course file '{}': {e}", path.display()))?;
  Ok(true)
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
