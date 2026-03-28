import { Timeline } from './types.js';

export interface CourseSummary {
  id: string;
  title?: string;
  segment_count: number;
  total_duration: number;
}

export interface ValidationError {
  path: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: ValidationError;
}

export interface CourseIdRequest {
  course_id: string;
}

export interface SaveCourseRequest {
  course_id: string;
  document: Timeline;
}

export interface ValidateCourseRequest {
  document: Timeline;
}

export interface SaveCourseResult {
  id: string;
  file_name: string;
  bytes_written: number;
}
