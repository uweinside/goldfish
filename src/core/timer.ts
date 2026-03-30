import { Section, Timeline, AppState } from '../models/types.js';

export function getElapsedMs(state: AppState): number {
    if (state.isPaused && state.pausedAt !== undefined) {
        return state.pausedAt - state.sectionStartTime;
    }
    return Date.now() - state.sectionStartTime;
}

export function getSecondsRemaining(section: Section, state: AppState): number {
    return section.durationSeconds - getElapsedMs(state) / 1000;
}

export function getTotalRemainingSeconds(timeline: Timeline, state: AppState): number {
    const currentChapter = timeline.chapters[state.currentChapterIndex];
    const currentSection = currentChapter.sections[state.currentSectionIndex];
    const currentRemaining = Math.max(getSecondsRemaining(currentSection, state), 0);

    let futureTotal = 0;
    for (let chapterIndex = state.currentChapterIndex; chapterIndex < timeline.chapters.length; chapterIndex++) {
        const chapter = timeline.chapters[chapterIndex];
        const startSection = chapterIndex === state.currentChapterIndex ? state.currentSectionIndex + 1 : 0;
        for (let sectionIndex = startSection; sectionIndex < chapter.sections.length; sectionIndex++) {
            futureTotal += chapter.sections[sectionIndex].durationSeconds;
        }
    }

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
    const sign = totalSeconds < 0 ? '+' : '';

    if (abs === 0) {
        return `${sign}0s`;
    }

    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    const parts: string[] = [];

    if (h > 0) {
        parts.push(`${h}h`);
    }

    if (m > 0) {
        parts.push(`${m}m`);
    }

    if (s > 0 || parts.length === 0) {
        parts.push(`${s}s`);
    }

    return `${sign}${parts.join(' ')}`;
}

export function formatClockTime(totalSeconds: number): string {
    const abs = Math.abs(Math.floor(totalSeconds));
    const sign = totalSeconds < 0 ? '+' : '';
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;

    return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
