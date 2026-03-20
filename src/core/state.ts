import { Timeline, AppState } from '../models/types.js';

export const goldfishState: AppState = {
    currentSegmentIndex: 0,
    segmentStartTime: Date.now(),
    isPaused: false,
};

export function advanceSegment(timeline: Timeline): void {
    if (goldfishState.currentSegmentIndex < timeline.segments.length - 1) {
        goldfishState.currentSegmentIndex++;
        goldfishState.segmentStartTime = Date.now();
        goldfishState.isPaused = false;
        goldfishState.pausedAt = undefined;
    }
}

export function previousSegment(timeline: Timeline): void {
    if (goldfishState.currentSegmentIndex > 0) {
        goldfishState.currentSegmentIndex--;
        goldfishState.segmentStartTime = Date.now();
        goldfishState.isPaused = false;
        goldfishState.pausedAt = undefined;
    }
}

export function pauseResume(): void {
    if (goldfishState.isPaused) {
        // Shift segmentStartTime forward by the paused duration to preserve elapsed time
        const pauseDuration = Date.now() - (goldfishState.pausedAt ?? Date.now());
        goldfishState.segmentStartTime += pauseDuration;
        goldfishState.isPaused = false;
        goldfishState.pausedAt = undefined;
    } else {
        goldfishState.pausedAt = Date.now();
        goldfishState.isPaused = true;
    }
}
