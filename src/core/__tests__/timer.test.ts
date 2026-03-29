import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    formatTime,
    getElapsedMs,
    getSecondsRemaining,
    getTotalRemainingSeconds,
    getSessionActualRemaining,
    getScheduleDrift,
} from '../timer.js';
import type { AppState, Timeline, Section } from '../../models/types.js';

// Helper to create a minimal test state
function createTestState(overrides: Partial<AppState> = {}): AppState {
    return {
        currentChapterIndex: 0,
        currentSectionIndex: 0,
        sectionStartTime: Date.now(),
        isPaused: false,
        pausedAt: undefined,
        hasStarted: true,
        sessionEndTime: Date.now() + 60000,
        rightPanelMode: 'info',
        ...overrides,
    };
}

// Helper to create a minimal test section
function createTestSection(durationSeconds: number): Section {
    return {
        title: 'Test Section',
        type: 'Narration',
        durationSeconds,
        instructions: 'Test instructions',
    };
}

// Helper to create a minimal test timeline
function createTestTimeline(chapterDurations: number[][]): Timeline {
    return {
        title: 'Test Timeline',
        chapters: chapterDurations.map((sectionDurations, chapterIndex) => ({
            title: `Chapter ${chapterIndex + 1}`,
            sections: sectionDurations.map((duration, sectionIndex) => ({
                title: `Section ${chapterIndex + 1}.${sectionIndex + 1}`,
                type: 'Narration' as const,
                durationSeconds: duration,
                instructions: 'Test',
            })),
        })),
    };
}

describe('formatTime', () => {
    it('formats positive seconds as MM:SS', () => {
        expect(formatTime(0)).toBe('00:00');
        expect(formatTime(5)).toBe('00:05');
        expect(formatTime(65)).toBe('01:05');
        expect(formatTime(600)).toBe('10:00');
        expect(formatTime(3599)).toBe('59:59');
    });

    it('formats hours when >= 3600 seconds', () => {
        expect(formatTime(3600)).toBe('1:00:00');
        expect(formatTime(3661)).toBe('1:01:01');
        expect(formatTime(7200)).toBe('2:00:00');
        expect(formatTime(36000)).toBe('10:00:00');
    });

    it('formats negative seconds (overtime) with + prefix', () => {
        expect(formatTime(-1)).toBe('+00:01');
        expect(formatTime(-65)).toBe('+01:05');
        expect(formatTime(-3600)).toBe('+1:00:00');
    });

    it('handles fractional seconds by flooring', () => {
        expect(formatTime(5.9)).toBe('00:05');
        expect(formatTime(59.99)).toBe('00:59');
        // Note: floors first, then takes abs: floor(-5.9) = -6, abs(-6) = 6
        expect(formatTime(-5.9)).toBe('+00:06');
    });
});

describe('getElapsedMs', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns elapsed time since section start when active', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const state = createTestState({
            sectionStartTime: now - 5000, // Started 5 seconds ago
            isPaused: false,
        });

        expect(getElapsedMs(state)).toBe(5000);
    });

    it('returns frozen elapsed time when paused', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const state = createTestState({
            sectionStartTime: now - 10000, // Started 10 seconds ago
            isPaused: true,
            pausedAt: now - 3000, // Paused 3 seconds ago (7 seconds elapsed when paused)
        });

        expect(getElapsedMs(state)).toBe(7000);
    });

    it('updates in real-time when not paused', () => {
        const startTime = Date.now();
        vi.setSystemTime(startTime);

        const state = createTestState({
            sectionStartTime: startTime,
            isPaused: false,
        });

        expect(getElapsedMs(state)).toBe(0);

        vi.advanceTimersByTime(2500);
        expect(getElapsedMs(state)).toBe(2500);

        vi.advanceTimersByTime(2500);
        expect(getElapsedMs(state)).toBe(5000);
    });
});

describe('getSecondsRemaining', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns positive remaining time', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const section = createTestSection(60);
        const state = createTestState({
            sectionStartTime: now - 10000, // 10 seconds elapsed
        });

        expect(getSecondsRemaining(section, state)).toBe(50);
    });

    it('returns negative when overtime', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const section = createTestSection(60);
        const state = createTestState({
            sectionStartTime: now - 70000, // 70 seconds elapsed, 10 seconds overtime
        });

        expect(getSecondsRemaining(section, state)).toBe(-10);
    });

    it('returns full duration at section start', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const section = createTestSection(300);
        const state = createTestState({
            sectionStartTime: now,
        });

        expect(getSecondsRemaining(section, state)).toBe(300);
    });
});

describe('getTotalRemainingSeconds', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sums current section remaining + all future sections', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        // [[60, 120], [180]] = 3 sections: 60s, 120s, 180s
        const timeline = createTestTimeline([[60, 120], [180]]);
        const state = createTestState({
            currentChapterIndex: 0,
            currentSectionIndex: 0,
            sectionStartTime: now - 30000, // 30 seconds into first section (30 remaining)
        });

        // Current: 30 remaining + Section 2: 120 + Section 3: 180 = 330 seconds
        expect(getTotalRemainingSeconds(timeline, state)).toBe(330);
    });

    it('returns only current section remaining when at last section', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const timeline = createTestTimeline([[60], [120]]);
        const state = createTestState({
            currentChapterIndex: 1,
            currentSectionIndex: 0,
            sectionStartTime: now - 60000, // 60 seconds into last section (60 remaining)
        });

        expect(getTotalRemainingSeconds(timeline, state)).toBe(60);
    });

    it('clamps current section to zero when overtime (does not subtract)', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const timeline = createTestTimeline([[60, 120]]);
        const state = createTestState({
            currentChapterIndex: 0,
            currentSectionIndex: 0,
            sectionStartTime: now - 90000, // 30 seconds overtime
        });

        // Current: clamped to 0 + Section 2: 120 = 120 seconds
        expect(getTotalRemainingSeconds(timeline, state)).toBe(120);
    });
});

describe('getSessionActualRemaining', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns wall-clock seconds until session end', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const state = createTestState({
            sessionEndTime: now + 120000, // 2 minutes from now
            isPaused: false,
        });

        expect(getSessionActualRemaining(state)).toBe(120);
    });

    it('uses pausedAt when paused', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const state = createTestState({
            sessionEndTime: now + 120000,
            isPaused: true,
            pausedAt: now - 30000, // Paused 30 seconds ago
        });

        // From pausedAt perspective: 120000 + 30000 = 150 seconds remaining
        expect(getSessionActualRemaining(state)).toBe(150);
    });

    it('returns negative when past session end', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const state = createTestState({
            sessionEndTime: now - 60000, // Session ended 1 minute ago
            isPaused: false,
        });

        expect(getSessionActualRemaining(state)).toBe(-60);
    });
});

describe('getScheduleDrift', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns zero when on schedule', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        // Total duration: 120 seconds
        const timeline = createTestTimeline([[60, 60]]);
        const state = createTestState({
            currentChapterIndex: 0,
            currentSectionIndex: 0,
            sectionStartTime: now, // Just started
            sessionEndTime: now + 120000, // Session ends in exactly 120 seconds
        });

        // Actual remaining: 120s, Planned remaining: 120s, Drift: 0
        expect(getScheduleDrift(timeline, state)).toBe(0);
    });

    it('returns positive drift when behind schedule', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const timeline = createTestTimeline([[60, 60]]);
        const state = createTestState({
            currentChapterIndex: 0,
            currentSectionIndex: 0,
            sectionStartTime: now, // Just started first section
            sessionEndTime: now + 90000, // But only 90 seconds until session end
        });

        // Actual remaining: 90s, Planned remaining: 120s
        // Drift: 90 - 120 = -30 (30 seconds behind)
        expect(getScheduleDrift(timeline, state)).toBe(-30);
    });

    it('returns negative drift when ahead of schedule', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const timeline = createTestTimeline([[60, 60]]);
        const state = createTestState({
            currentChapterIndex: 0,
            currentSectionIndex: 1, // Already on second section
            sectionStartTime: now, // Just started second section
            sessionEndTime: now + 90000, // 90 seconds until session end
        });

        // Actual remaining: 90s, Planned remaining: 60s (just one section left)
        // Drift: 90 - 60 = +30 (30 seconds ahead)
        expect(getScheduleDrift(timeline, state)).toBe(30);
    });
});
