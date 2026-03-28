use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum SectionType {
  Narration,
  Demo,
  Prompt,
  Rule,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Section {
  pub title: String,
  #[serde(rename = "type")]
  pub section_type: SectionType,
  #[serde(rename = "durationSeconds")]
  pub duration_seconds: i64,
  pub instructions: String,
  pub transcript: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Chapter {
  pub title: String,
  pub sections: Vec<Section>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Timeline {
  pub title: String,
  pub chapters: Vec<Chapter>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationError {
  pub path: String,
  pub code: String,
  pub message: String,
}

fn err(path: &str, code: &str, message: &str) -> ValidationError {
  ValidationError {
    path: path.to_string(),
    code: code.to_string(),
    message: message.to_string(),
  }
}

pub fn validate_timeline_strict(document: &Timeline) -> Result<(), ValidationError> {
  if document.title.trim().is_empty() {
    return Err(err("title", "EMPTY_TITLE", "title cannot be empty"));
  }

  if document.chapters.is_empty() {
    return Err(err(
      "chapters",
      "EMPTY_CHAPTERS",
      "chapters must contain at least one chapter",
    ));
  }

  for (chapter_index, chapter) in document.chapters.iter().enumerate() {
    let chapter_path = format!("chapters[{chapter_index}]");

    if chapter.title.trim().is_empty() {
      return Err(err(
        &format!("{chapter_path}.title"),
        "EMPTY_CHAPTER_TITLE",
        "chapter title cannot be empty",
      ));
    }

    if chapter.sections.is_empty() {
      return Err(err(
        &format!("{chapter_path}.sections"),
        "EMPTY_SECTIONS",
        "chapter must include at least one section",
      ));
    }

    for (section_index, section) in chapter.sections.iter().enumerate() {
      let section_path = format!("{chapter_path}.sections[{section_index}]");

      if section.title.trim().is_empty() {
        return Err(err(
          &format!("{section_path}.title"),
          "EMPTY_SECTION_TITLE",
          "section title cannot be empty",
        ));
      }

      if section.duration_seconds <= 0 {
        return Err(err(
          &format!("{section_path}.durationSeconds"),
          "INVALID_SECTION_DURATION",
          "section duration must be greater than zero seconds",
        ));
      }

      if section.instructions.trim().is_empty() {
        return Err(err(
          &format!("{section_path}.instructions"),
          "EMPTY_SECTION_INSTRUCTIONS",
          "section instructions cannot be empty",
        ));
      }

      if let Some(transcript) = &section.transcript {
        if transcript.trim().is_empty() {
          return Err(err(
            &format!("{section_path}.transcript"),
            "EMPTY_SECTION_TRANSCRIPT",
            "section transcript cannot be empty when provided",
          ));
        }
      }
    }
  }

  Ok(())
}

#[cfg(test)]
mod tests {
  use super::{validate_timeline_strict, Chapter, Section, SectionType, Timeline};

  fn valid_timeline() -> Timeline {
    Timeline {
      title: "Sample".to_string(),
      chapters: vec![Chapter {
        title: "Welcome".to_string(),
        sections: vec![Section {
          title: "Intro".to_string(),
          section_type: SectionType::Narration,
          duration_seconds: 300,
          instructions: "Set expectations".to_string(),
          transcript: Some("Welcome everyone".to_string()),
        }],
      }],
    }
  }

  #[test]
  fn validate_accepts_valid_timeline() {
    let timeline = valid_timeline();
    assert!(validate_timeline_strict(&timeline).is_ok());
  }

  #[test]
  fn validate_rejects_empty_chapters() {
    let timeline = Timeline {
      title: "Empty".to_string(),
      chapters: vec![],
    };

    let err = validate_timeline_strict(&timeline).expect_err("expected validation error");
    assert_eq!(err.code, "EMPTY_CHAPTERS");
  }

  #[test]
  fn validate_rejects_empty_instructions() {
    let mut timeline = valid_timeline();
    timeline.chapters[0].sections[0].instructions = "   ".to_string();

    let err = validate_timeline_strict(&timeline).expect_err("expected validation error");
    assert_eq!(err.code, "EMPTY_SECTION_INSTRUCTIONS");
  }
}
