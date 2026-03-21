import { Segment, Timeline, AppState } from '../models/types.js';

export function getElapsedMs(state: AppState): number {
    if (state.isPaused && state.pausedAt !== undefined) {
        return state.pausedAt - state.segmentStartTime;
    }
    return Date.now() - state.segmentStartTime;
}

export function getSecondsRemaining(segment: Segment, state: AppState): number {
    return segment.duration - getElapsedMs(state) / 1000;
}

export function getTotalRemainingSeconds(timeline: Timeline, state: AppState): number {
    const segment = timeline.segments[state.currentSegmentIndex];
    const currentRemaining = Math.max(getSecondsRemaining(segment, state), 0);
    const futureTotal = timeline.segments
        .slice(state.currentSegmentIndex + 1)
        .reduce((sum, seg) => sum + seg.duration, 0);
    return currentRemaining + futureTotal;
}

export function getSessionActualRemaining(state: AppState): number {
    const now = state.isPaused && state.pausedAt !== undefined ? state.pausedAt : Date.now();
    return (state.sessionEndTime - now) / 1000;
}

export function getScheduleDrift(timeline: Timeline, state: AppState): number {
    return getSessionActualRemaining(state) - getTotalRemainingSeconds(timeline, state);
}

export function formatTime(totalSeconds: number): string {
    const abs = Math.abs(Math.floor(totalSeconds));
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    const sign = totalSeconds < 0 ? '+' : '';
    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    return h > 0 ? `${sign}${h}:${mm}:${ss}` : `${sign}${mm}:${ss}`;
}
