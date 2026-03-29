import { Timeline, AppState } from '../models/types.js';

export const goldfishState: AppState = {
    currentChapterIndex: 0,
    currentSectionIndex: 0,
    sectionStartTime: Date.now(),
    isPaused: true,
    pausedAt: Date.now(),
    hasStarted: false,
    sessionEndTime: 0,
    rightPanelMode: 'info',
};

interface TimelinePosition {
    chapterIndex: number;
    sectionIndex: number;
}

function flattenPositions(timeline: Timeline): TimelinePosition[] {
    const positions: TimelinePosition[] = [];
    for (let chapterIndex = 0; chapterIndex < timeline.chapters.length; chapterIndex++) {
        const chapter = timeline.chapters[chapterIndex];
        for (let sectionIndex = 0; sectionIndex < chapter.sections.length; sectionIndex++) {
            positions.push({ chapterIndex, sectionIndex });
        }
    }
    return positions;
}

function currentFlatIndex(timeline: Timeline): number {
    const positions = flattenPositions(timeline);
    return positions.findIndex(
        p => p.chapterIndex === goldfishState.currentChapterIndex && p.sectionIndex === goldfishState.currentSectionIndex,
    );
}

function initSessionEndTime(timeline: Timeline): void {
    if (!goldfishState.hasStarted) {
        const totalMs = timeline.chapters
            .flatMap(chapter => chapter.sections)
            .reduce((s, section) => s + section.durationSeconds, 0) * 1000;
        goldfishState.sessionEndTime = Date.now() + totalMs;
    }
}

function moveToPosition(position: TimelinePosition, timeline: Timeline): void {
    initSessionEndTime(timeline);
    goldfishState.currentChapterIndex = position.chapterIndex;
    goldfishState.currentSectionIndex = position.sectionIndex;
    goldfishState.sectionStartTime = Date.now();
    goldfishState.isPaused = false;
    goldfishState.pausedAt = undefined;
    goldfishState.hasStarted = true;
    goldfishState.rightPanelMode = 'info';
}

export function navigateToSectionInChapter(sectionIndex: number, timeline: Timeline): void {
    const chapter = timeline.chapters[goldfishState.currentChapterIndex];
    if (sectionIndex < 0 || sectionIndex >= chapter.sections.length) {
        return;
    }
    moveToPosition({ chapterIndex: goldfishState.currentChapterIndex, sectionIndex }, timeline);
}

export function advanceSegment(timeline: Timeline): void {
    const positions = flattenPositions(timeline);
    const current = currentFlatIndex(timeline);
    if (current >= 0 && current < positions.length - 1) {
        moveToPosition(positions[current + 1], timeline);
    }
}

export function previousSegment(timeline: Timeline): void {
    const positions = flattenPositions(timeline);
    const current = currentFlatIndex(timeline);
    if (current > 0) {
        moveToPosition(positions[current - 1], timeline);
    }
}

export function openNotesPanel(): void {
    goldfishState.rightPanelMode = 'notes';
}

export function closeNotesPanel(): void {
    goldfishState.rightPanelMode = 'info';
}

function hasTranscript(section: Timeline['chapters'][number]['sections'][number]): boolean {
    return typeof section.transcript === 'string' && section.transcript.trim().length > 0;
}

export function advanceNotesSection(timeline: Timeline): void {
    const positions = flattenPositions(timeline);
    const current = currentFlatIndex(timeline);
    if (current < 0) {
        return;
    }

    for (let i = current + 1; i < positions.length; i++) {
        const position = positions[i];
        const section = timeline.chapters[position.chapterIndex].sections[position.sectionIndex];
        if (hasTranscript(section)) {
            moveToPosition(position, timeline);
            goldfishState.rightPanelMode = 'notes';
            return;
        }
    }
}

export function previousNotesSection(timeline: Timeline): void {
    const positions = flattenPositions(timeline);
    const current = currentFlatIndex(timeline);
    if (current <= 0) {
        return;
    }

    for (let i = current - 1; i >= 0; i--) {
        const position = positions[i];
        const section = timeline.chapters[position.chapterIndex].sections[position.sectionIndex];
        if (hasTranscript(section)) {
            moveToPosition(position, timeline);
            goldfishState.rightPanelMode = 'notes';
            return;
        }
    }
}

export function pauseResume(timeline?: Timeline): void {
    if (goldfishState.isPaused) {
        if (!goldfishState.hasStarted) {
            goldfishState.sectionStartTime = Date.now();
            if (timeline) {
                initSessionEndTime(timeline);
            }
        } else {
            const pauseDuration = Date.now() - (goldfishState.pausedAt ?? Date.now());
            goldfishState.sectionStartTime += pauseDuration;
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
