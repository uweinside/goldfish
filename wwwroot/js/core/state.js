export const goldfishState = {
    currentSegmentIndex: 0,
    segmentStartTime: Date.now(),
    isPaused: false,
};
export function advanceSegment(timeline) {
    if (goldfishState.currentSegmentIndex < timeline.segments.length - 1) {
        goldfishState.currentSegmentIndex++;
        goldfishState.segmentStartTime = Date.now();
        goldfishState.isPaused = false;
        goldfishState.pausedAt = undefined;
    }
}
export function previousSegment(timeline) {
    if (goldfishState.currentSegmentIndex > 0) {
        goldfishState.currentSegmentIndex--;
        goldfishState.segmentStartTime = Date.now();
        goldfishState.isPaused = false;
        goldfishState.pausedAt = undefined;
    }
}
export function pauseResume() {
    if (goldfishState.isPaused) {
        const pauseDuration = Date.now() - (goldfishState.pausedAt ?? Date.now());
        goldfishState.segmentStartTime += pauseDuration;
        goldfishState.isPaused = false;
        goldfishState.pausedAt = undefined;
    }
    else {
        goldfishState.pausedAt = Date.now();
        goldfishState.isPaused = true;
    }
}
//# sourceMappingURL=state.js.map