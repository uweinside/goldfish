import { Timeline, AppState } from '../models/types.js';

export const goldfishState: AppState = {
    currentSegmentIndex: 0,
    segmentStartTime: Date.now(),
    isPaused: true,
    pausedAt: Date.now(),
    hasStarted: false,
    sessionEndTime: 0,
    rightPanelMode: 'info',
    notesSectionIndex: undefined,
};

function initSessionEndTime(timeline: Timeline): void {
    if (!goldfishState.hasStarted) {
        const totalMs = timeline.segments.reduce((s, seg) => s + seg.duration, 0) * 1000;
        goldfishState.sessionEndTime = Date.now() + totalMs;
    }
}

export function advanceSegment(timeline: Timeline): void {
    if (goldfishState.currentSegmentIndex < timeline.segments.length - 1) {
        initSessionEndTime(timeline);
        goldfishState.currentSegmentIndex++;
        goldfishState.segmentStartTime = Date.now();
        goldfishState.isPaused = false;
        goldfishState.pausedAt = undefined;
        goldfishState.hasStarted = true;
        goldfishState.rightPanelMode = 'info';
        goldfishState.notesSectionIndex = undefined;
    }
}

export function previousSegment(timeline: Timeline): void {
    if (goldfishState.currentSegmentIndex > 0) {
        initSessionEndTime(timeline);
        goldfishState.currentSegmentIndex--;
        goldfishState.segmentStartTime = Date.now();
        goldfishState.isPaused = false;
        goldfishState.pausedAt = undefined;
        goldfishState.hasStarted = true;
        goldfishState.rightPanelMode = 'info';
        goldfishState.notesSectionIndex = undefined;
    }
}

export function openNotesPanel(sectionIndex?: number): void {
    goldfishState.rightPanelMode = 'notes';
    goldfishState.notesSectionIndex = sectionIndex;
}

export function closeNotesPanel(): void {
    goldfishState.rightPanelMode = 'info';
    goldfishState.notesSectionIndex = undefined;
}

export function pauseResume(timeline?: Timeline): void {
    if (goldfishState.isPaused) {
        if (!goldfishState.hasStarted) {
            // First start: reset segment start time and anchor session end time
            goldfishState.segmentStartTime = Date.now();
            if (timeline) {
                initSessionEndTime(timeline);
            }
        } else {
            // Resume: shift segmentStartTime and sessionEndTime forward by the paused duration
            const pauseDuration = Date.now() - (goldfishState.pausedAt ?? Date.now());
            goldfishState.segmentStartTime += pauseDuration;
            goldfishState.sessionEndTime += pauseDuration;
        }
        goldfishState.isPaused = false;
        goldfishState.pausedAt = undefined;
        goldfishState.hasStarted = true;
    } else {
        goldfishState.pausedAt = Date.now();
        goldfishState.isPaused = true;
    }
}
