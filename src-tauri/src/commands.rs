use crate::course_model::{validate_timeline_strict, Timeline, ValidationError};
use crate::course_store::{
  CourseDirs, delete_course, file_name_from_path, list_course_ids, parse_timeline, read_course_json,
  serialize_timeline_pretty, write_course_json_atomic,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct CourseSummary {
  pub id: String,
  pub title: String,
  pub chapter_count: usize,
  pub section_count: usize,
  pub total_duration: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CourseIdRequest {
  pub course_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ValidateCourseRequest {
  pub document: Timeline,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SaveCourseRequest {
  pub course_id: String,
  pub document: Timeline,
}

#[derive(Debug, Clone, Serialize)]
pub struct SaveCourseResult {
  pub id: String,
  pub file_name: String,
  pub bytes_written: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationResult {
  pub valid: bool,
  pub error: Option<ValidationError>,
}

#[tauri::command]
pub fn list_local_courses(dirs: tauri::State<CourseDirs>) -> Result<Vec<CourseSummary>, String> {
  let ids = list_course_ids(&dirs)?;
  let mut summaries = Vec::with_capacity(ids.len());

  for id in ids {
    let json = read_course_json(&id, &dirs)?;
    let document = parse_timeline(&json)?;
    validate_timeline_strict(&document).map_err(|e| {
      format!(
        "course '{}' failed strict validation at {} ({}): {}",
        id, e.path, e.code, e.message
      )
    })?;

    let section_count = document
      .chapters
      .iter()
      .map(|chapter| chapter.sections.len())
      .sum();
    let total_duration = document
      .chapters
      .iter()
      .flat_map(|chapter| chapter.sections.iter())
      .map(|section| section.duration_seconds)
      .sum();

    summaries.push(CourseSummary {
      id,
      title: document.title,
      chapter_count: document.chapters.len(),
      section_count,
      total_duration,
    });
  }

  Ok(summaries)
}

#[tauri::command]
pub fn load_local_course(dirs: tauri::State<CourseDirs>, request: CourseIdRequest) -> Result<Timeline, String> {
  let json = read_course_json(&request.course_id, &dirs)?;
  let document = parse_timeline(&json)?;
  validate_timeline_strict(&document)
    .map_err(|e| format!("validation failed at {} ({}): {}", e.path, e.code, e.message))?;
  Ok(document)
}

#[tauri::command]
pub fn validate_course_document(request: ValidateCourseRequest) -> Result<ValidationResult, String> {
  match validate_timeline_strict(&request.document) {
    Ok(()) => Ok(ValidationResult {
      valid: true,
      error: None,
    }),
    Err(err) => Ok(ValidationResult {
      valid: false,
      error: Some(err),
    }),
  }
}

#[tauri::command]
pub fn save_course_document(dirs: tauri::State<CourseDirs>, request: SaveCourseRequest) -> Result<SaveCourseResult, String> {
  validate_timeline_strict(&request.document)
    .map_err(|e| format!("validation failed at {} ({}): {}", e.path, e.code, e.message))?;

  let json = serialize_timeline_pretty(&request.document)?;
  let (path, bytes_written) = write_course_json_atomic(&request.course_id, &json, &dirs)?;

  Ok(SaveCourseResult {
    id: request.course_id,
    file_name: file_name_from_path(&path),
    bytes_written,
  })
}

#[tauri::command]
pub fn delete_local_course(dirs: tauri::State<CourseDirs>, request: CourseIdRequest) -> Result<bool, String> {
  delete_course(&request.course_id, &dirs)
}
