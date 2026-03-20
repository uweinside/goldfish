export function getElapsedMs(state) {
    if (state.isPaused && state.pausedAt !== undefined) {
        return state.pausedAt - state.segmentStartTime;
    }
    return Date.now() - state.segmentStartTime;
}
export function getSecondsRemaining(segment, state) {
    return segment.duration - getElapsedMs(state) / 1000;
}
export function getTotalRemainingSeconds(timeline, state) {
    const segment = timeline.segments[state.currentSegmentIndex];
    const currentRemaining = Math.max(getSecondsRemaining(segment, state), 0);
    const futureTotal = timeline.segments
        .slice(state.currentSegmentIndex + 1)
        .reduce((sum, seg) => sum + seg.duration, 0);
    return currentRemaining + futureTotal;
}
export function formatTime(totalSeconds) {
    const abs = Math.abs(Math.floor(totalSeconds));
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    const sign = totalSeconds < 0 ? '+' : '';
    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    return h > 0 ? `${sign}${h}:${mm}:${ss}` : `${sign}${mm}:${ss}`;
}
//# sourceMappingURL=timer.js.map