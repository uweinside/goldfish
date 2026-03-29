import { invoke } from '@tauri-apps/api/core';
import { Timeline } from '../models/types.js';
import {
  CourseSummary,
  SaveCourseResult,
  ValidationResult,
} from '../models/course-authoring.js';

export async function listLocalCourses(): Promise<CourseSummary[]> {
  return invoke<CourseSummary[]>('list_local_courses');
}

export async function loadLocalCourse(courseId: string): Promise<Timeline> {
  return invoke<Timeline>('load_local_course', {
    request: {
      course_id: courseId,
    },
  });
}

export async function validateCourseDocument(document: Timeline): Promise<ValidationResult> {
  return invoke<ValidationResult>('validate_course_document', {
    request: {
      document,
    },
  });
}

export async function saveCourseDocument(
  courseId: string,
  document: Timeline,
): Promise<SaveCourseResult> {
  return invoke<SaveCourseResult>('save_course_document', {
    request: {
      course_id: courseId,
      document,
    },
  });
}

export async function deleteLocalCourse(courseId: string): Promise<boolean> {
  return invoke<boolean>('delete_local_course', {
    request: {
      course_id: courseId,
    },
  });
}
