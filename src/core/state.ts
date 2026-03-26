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

function sectionHasNotes(segment: Timeline['segments'][number], index: number): boolean {
    const notes = segment.info?.[index]?.notes;
    return Array.isArray(notes) && notes.some(b => typeof b === 'string' && b.trim().length > 0);
}

export function advanceNotesSection(timeline: Timeline): void {
    const segment = timeline.segments[goldfishState.currentSegmentIndex];
    const sectionCount = segment.info?.length ?? 0;
    const currentIndex = goldfishState.notesSectionIndex;

    // Try to find next section with notes within current segment
    const searchFrom = currentIndex !== undefined ? currentIndex + 1 : 0;
    for (let i = searchFrom; i < sectionCount; i++) {
        if (sectionHasNotes(segment, i)) {
            goldfishState.notesSectionIndex = i;
            return;
        }
    }

    // Cross into subsequent segments to find one with notes
    for (let s = goldfishState.currentSegmentIndex + 1; s < timeline.segments.length; s++) {
        const nextSeg = timeline.segments[s];
        const firstWithNotes = nextSeg.info?.findIndex((_sec, idx) => sectionHasNotes(nextSeg, idx)) ?? -1;
        const hasSegNotes = typeof nextSeg.notes === 'string' && nextSeg.notes.trim().length > 0;

        if (firstWithNotes >= 0 || hasSegNotes) {
            initSessionEndTime(timeline);
            goldfishState.currentSegmentIndex = s;
            goldfishState.segmentStartTime = Date.now();
            goldfishState.isPaused = false;
            goldfishState.pausedAt = undefined;
            goldfishState.hasStarted = true;
            goldfishState.rightPanelMode = 'notes';
            goldfishState.notesSectionIndex = firstWithNotes >= 0 ? firstWithNotes : undefined;
            return;
        }
    }
}

export function previousNotesSection(timeline: Timeline): void {
    const segment = timeline.segments[goldfishState.currentSegmentIndex];
    const currentIndex = goldfishState.notesSectionIndex;

    // Try to find previous section with notes within current segment
    const searchFrom = currentIndex !== undefined ? currentIndex - 1 : -1;
    for (let i = searchFrom; i >= 0; i--) {
        if (sectionHasNotes(segment, i)) {
            goldfishState.notesSectionIndex = i;
            return;
        }
    }

    // Cross into previous segments to find one with notes
    for (let s = goldfishState.currentSegmentIndex - 1; s >= 0; s--) {
        const prevSeg = timeline.segments[s];
        const prevCount = prevSeg.info?.length ?? 0;
        let lastWithNotes = -1;
        for (let i = prevCount - 1; i >= 0; i--) {
            if (sectionHasNotes(prevSeg, i)) { lastWithNotes = i; break; }
        }
        const hasSegNotes = typeof prevSeg.notes === 'string' && prevSeg.notes.trim().length > 0;

        if (lastWithNotes >= 0 || hasSegNotes) {
            initSessionEndTime(timeline);
            goldfishState.currentSegmentIndex = s;
            goldfishState.segmentStartTime = Date.now();
            goldfishState.isPaused = false;
            goldfishState.pausedAt = undefined;
            goldfishState.hasStarted = true;
            goldfishState.rightPanelMode = 'notes';
            goldfishState.notesSectionIndex = lastWithNotes >= 0 ? lastWithNotes : undefined;
            return;
        }
    }
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
