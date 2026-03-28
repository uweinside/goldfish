use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SegmentType {
  Lecture,
  Demo,
  Break,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InfoSection {
  pub label: String,
  pub items: Vec<String>,
  pub transcript: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Segment {
  pub title: String,
  pub duration: i64,
  #[serde(rename = "type")]
  pub segment_type: Option<SegmentType>,
  pub info: Option<Vec<InfoSection>>,
  pub transcript: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Timeline {
  pub title: Option<String>,
  pub segments: Vec<Segment>,
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
  if let Some(title) = &document.title {
    if title.trim().is_empty() {
      return Err(err("title", "EMPTY_TITLE", "title cannot be empty when provided"));
    }
  }

  if document.segments.is_empty() {
    return Err(err("segments", "EMPTY_SEGMENTS", "segments must contain at least one segment"));
  }

  for (segment_index, segment) in document.segments.iter().enumerate() {
    let segment_path = format!("segments[{segment_index}]");

    if segment.title.trim().is_empty() {
      return Err(err(
        &format!("{segment_path}.title"),
        "EMPTY_SEGMENT_TITLE",
        "segment title cannot be empty",
      ));
    }

    if segment.duration <= 0 {
      return Err(err(
        &format!("{segment_path}.duration"),
        "INVALID_SEGMENT_DURATION",
        "segment duration must be greater than zero seconds",
      ));
    }

    if let Some(transcript) = &segment.transcript {
      if transcript.trim().is_empty() {
        return Err(err(
          &format!("{segment_path}.transcript"),
          "EMPTY_SEGMENT_TRANSCRIPT",
          "segment transcript cannot be empty when provided",
        ));
      }
    }

    if let Some(info_sections) = &segment.info {
      for (section_index, section) in info_sections.iter().enumerate() {
        let section_path = format!("{segment_path}.info[{section_index}]");

        if section.label.trim().is_empty() {
          return Err(err(
            &format!("{section_path}.label"),
            "EMPTY_INFO_LABEL",
            "info section label cannot be empty",
          ));
        }

        if section.items.is_empty() {
          return Err(err(
            &format!("{section_path}.items"),
            "EMPTY_INFO_ITEMS",
            "info section must include at least one item",
          ));
        }

        for (item_index, item) in section.items.iter().enumerate() {
          if item.trim().is_empty() {
            return Err(err(
              &format!("{section_path}.items[{item_index}]"),
              "EMPTY_INFO_ITEM",
              "info item cannot be empty",
            ));
          }
        }

        if let Some(lines) = &section.transcript {
          for (line_index, line) in lines.iter().enumerate() {
            if line.trim().is_empty() {
              return Err(err(
                &format!("{section_path}.transcript[{line_index}]"),
                "EMPTY_SECTION_TRANSCRIPT_LINE",
                "section transcript lines cannot be empty",
              ));
            }
          }
        }
      }
    }
  }

  Ok(())
}

#[cfg(test)]
mod tests {
  use super::{validate_timeline_strict, InfoSection, Segment, SegmentType, Timeline};

  fn valid_timeline() -> Timeline {
    Timeline {
      title: Some("Sample".to_string()),
      segments: vec![Segment {
        title: "Welcome".to_string(),
        duration: 300,
        segment_type: Some(SegmentType::Lecture),
        info: Some(vec![InfoSection {
          label: "focus".to_string(),
          items: vec!["Set expectations".to_string()],
          transcript: Some(vec!["Notes".to_string()]),
        }]),
        transcript: Some("Segment notes".to_string()),
      }],
    }
  }

  #[test]
  fn validate_accepts_valid_timeline() {
    let timeline = valid_timeline();
    assert!(validate_timeline_strict(&timeline).is_ok());
  }

  #[test]
  fn validate_rejects_empty_segments() {
    let timeline = Timeline {
      title: Some("Empty".to_string()),
      segments: vec![],
    };

    let err = validate_timeline_strict(&timeline).expect_err("expected validation error");
    assert_eq!(err.code, "EMPTY_SEGMENTS");
  }

  #[test]
  fn validate_rejects_empty_item() {
    let mut timeline = valid_timeline();
    timeline.segments[0].info.as_mut().expect("has info")[0].items[0] = "   ".to_string();

    let err = validate_timeline_strict(&timeline).expect_err("expected validation error");
    assert_eq!(err.code, "EMPTY_INFO_ITEM");
  }
}
