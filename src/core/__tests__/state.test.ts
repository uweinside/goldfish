import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    goldfishState,
    advanceSegment,
    previousSegment,
    advanceChapter,
    previousChapter,
    navigateToSectionInChapter,
    pauseResume,
    openNotesPanel,
    closeNotesPanel,
    advanceNotesSection,
    previousNotesSection,
} from '../state.js';
import type { Timeline } from '../../models/types.js';

// Helper to create a test timeline
function createTestTimeline(chapterSectionCounts: number[]): Timeline {
    return {
        title: 'Test Timeline',
        chapters: chapterSectionCounts.map((sectionCount, chapterIndex) => ({
            title: `Chapter ${chapterIndex + 1}`,
            sections: Array.from({ length: sectionCount }, (_, sectionIndex) => ({
                title: `Section ${chapterIndex + 1}.${sectionIndex + 1}`,
                type: 'Narration' as const,
                durationSeconds: 60,
                instructions: 'Test instructions',
            })),
        })),
    };
}

// Helper to create a timeline with transcripts
function createTimelineWithTranscripts(transcriptPattern: boolean[][]): Timeline {
    return {
        title: 'Test Timeline',
        chapters: transcriptPattern.map((sectionTranscripts, chapterIndex) => ({
            title: `Chapter ${chapterIndex + 1}`,
            sections: sectionTranscripts.map((hasTranscript, sectionIndex) => ({
                title: `Section ${chapterIndex + 1}.${sectionIndex + 1}`,
                type: 'Narration' as const,
                durationSeconds: 60,
                instructions: 'Test instructions',
                transcript: hasTranscript ? 'Test transcript content' : undefined,
            })),
        })),
    };
}

// Reset state before each test
function resetState(): void {
    goldfishState.currentChapterIndex = 0;
    goldfishState.currentSectionIndex = 0;
    goldfishState.sectionStartTime = Date.now();
    goldfishState.isPaused = true;
    goldfishState.pausedAt = Date.now();
    goldfishState.hasStarted = false;
    goldfishState.sessionEndTime = 0;
    goldfishState.rightPanelMode = 'info';
}

describe('advanceSegment', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('moves to next section in same chapter', () => {
        const timeline = createTestTimeline([3, 2]); // Chapter 1: 3 sections, Chapter 2: 2 sections
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 0;

        advanceSegment(timeline);

        expect(goldfishState.currentChapterIndex).toBe(0);
        expect(goldfishState.currentSectionIndex).toBe(1);
    });

    it('moves to first section of next chapter when at chapter end', () => {
        const timeline = createTestTimeline([2, 2]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 1; // Last section of first chapter

        advanceSegment(timeline);

        expect(goldfishState.currentChapterIndex).toBe(1);
        expect(goldfishState.currentSectionIndex).toBe(0);
    });

    it('does not advance past last section of last chapter', () => {
        const timeline = createTestTimeline([2, 2]);
        goldfishState.currentChapterIndex = 1;
        goldfishState.currentSectionIndex = 1; // Last section of last chapter

        advanceSegment(timeline);

        expect(goldfishState.currentChapterIndex).toBe(1);
        expect(goldfishState.currentSectionIndex).toBe(1);
    });

    it('resets section start time on advance', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const timeline = createTestTimeline([3]);
        goldfishState.sectionStartTime = now - 10000;

        advanceSegment(timeline);

        expect(goldfishState.sectionStartTime).toBe(now);
    });

    it('unpauses when advancing', () => {
        const timeline = createTestTimeline([3]);
        goldfishState.isPaused = true;
        goldfishState.pausedAt = Date.now();

        advanceSegment(timeline);

        expect(goldfishState.isPaused).toBe(false);
        expect(goldfishState.pausedAt).toBeUndefined();
    });
});

describe('previousSegment', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('moves to previous section in same chapter', () => {
        const timeline = createTestTimeline([3, 2]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 2;

        previousSegment(timeline);

        expect(goldfishState.currentChapterIndex).toBe(0);
        expect(goldfishState.currentSectionIndex).toBe(1);
    });

    it('moves to last section of previous chapter when at chapter start', () => {
        const timeline = createTestTimeline([2, 3]);
        goldfishState.currentChapterIndex = 1;
        goldfishState.currentSectionIndex = 0; // First section of second chapter

        previousSegment(timeline);

        expect(goldfishState.currentChapterIndex).toBe(0);
        expect(goldfishState.currentSectionIndex).toBe(1); // Last section of first chapter
    });

    it('does not go back past first section of first chapter', () => {
        const timeline = createTestTimeline([2, 2]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 0;

        previousSegment(timeline);

        expect(goldfishState.currentChapterIndex).toBe(0);
        expect(goldfishState.currentSectionIndex).toBe(0);
    });
});

describe('advanceChapter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('moves to first section of next chapter', () => {
        const timeline = createTestTimeline([3, 2, 1]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 2; // Middle of first chapter

        advanceChapter(timeline);

        expect(goldfishState.currentChapterIndex).toBe(1);
        expect(goldfishState.currentSectionIndex).toBe(0);
    });

    it('does not advance past last chapter', () => {
        const timeline = createTestTimeline([2, 2]);
        goldfishState.currentChapterIndex = 1;
        goldfishState.currentSectionIndex = 0;

        advanceChapter(timeline);

        expect(goldfishState.currentChapterIndex).toBe(1);
        expect(goldfishState.currentSectionIndex).toBe(0);
    });
});

describe('previousChapter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('moves to first section of previous chapter', () => {
        const timeline = createTestTimeline([3, 2]);
        goldfishState.currentChapterIndex = 1;
        goldfishState.currentSectionIndex = 1;

        previousChapter(timeline);

        expect(goldfishState.currentChapterIndex).toBe(0);
        expect(goldfishState.currentSectionIndex).toBe(0);
    });

    it('does not go back past first chapter', () => {
        const timeline = createTestTimeline([2, 2]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 1;

        previousChapter(timeline);

        expect(goldfishState.currentChapterIndex).toBe(0);
        expect(goldfishState.currentSectionIndex).toBe(1);
    });
});

describe('navigateToSectionInChapter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('navigates to specified section within current chapter', () => {
        const timeline = createTestTimeline([5]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 0;

        navigateToSectionInChapter(3, timeline);

        expect(goldfishState.currentSectionIndex).toBe(3);
    });

    it('does not navigate to invalid negative index', () => {
        const timeline = createTestTimeline([3]);
        goldfishState.currentSectionIndex = 1;

        navigateToSectionInChapter(-1, timeline);

        expect(goldfishState.currentSectionIndex).toBe(1);
    });

    it('does not navigate to index beyond section count', () => {
        const timeline = createTestTimeline([3]);
        goldfishState.currentSectionIndex = 1;

        navigateToSectionInChapter(5, timeline);

        expect(goldfishState.currentSectionIndex).toBe(1);
    });
});

describe('pauseResume', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('pauses when running', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        goldfishState.isPaused = false;
        goldfishState.hasStarted = true;

        pauseResume();

        expect(goldfishState.isPaused).toBe(true);
        expect(goldfishState.pausedAt).toBe(now);
    });

    it('resumes when paused and shifts times by pause duration', () => {
        const startTime = 1000000;
        vi.setSystemTime(startTime);

        goldfishState.isPaused = true;
        goldfishState.hasStarted = true;
        goldfishState.pausedAt = startTime;
        goldfishState.sectionStartTime = startTime - 10000;
        goldfishState.sessionEndTime = startTime + 50000;

        // Advance time by 5 seconds while paused
        vi.advanceTimersByTime(5000);
        const resumeTime = Date.now();

        pauseResume();

        expect(goldfishState.isPaused).toBe(false);
        expect(goldfishState.pausedAt).toBeUndefined();
        // Section start time should be shifted forward by pause duration (5000ms)
        expect(goldfishState.sectionStartTime).toBe(startTime - 10000 + 5000);
        // Session end time should be shifted forward by pause duration (5000ms)
        expect(goldfishState.sessionEndTime).toBe(startTime + 50000 + 5000);
    });

    it('initializes session on first start', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const timeline = createTestTimeline([2, 2]); // 4 sections × 60s = 240s total
        goldfishState.isPaused = true;
        goldfishState.hasStarted = false;
        goldfishState.sessionEndTime = 0;

        pauseResume(timeline);

        expect(goldfishState.isPaused).toBe(false);
        expect(goldfishState.hasStarted).toBe(true);
        expect(goldfishState.sectionStartTime).toBe(now);
        expect(goldfishState.sessionEndTime).toBe(now + 240000);
    });
});

describe('openNotesPanel / closeNotesPanel', () => {
    beforeEach(() => {
        resetState();
    });

    it('opens notes panel', () => {
        goldfishState.rightPanelMode = 'info';

        openNotesPanel();

        expect(goldfishState.rightPanelMode).toBe('notes');
    });

    it('closes notes panel', () => {
        goldfishState.rightPanelMode = 'notes';

        closeNotesPanel();

        expect(goldfishState.rightPanelMode).toBe('info');
    });
});

describe('advanceNotesSection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('advances to next section with transcript', () => {
        // Chapter 1: [no, no, yes], Chapter 2: [no, yes]
        const timeline = createTimelineWithTranscripts([[false, false, true], [false, true]]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 0;

        advanceNotesSection(timeline);

        expect(goldfishState.currentChapterIndex).toBe(0);
        expect(goldfishState.currentSectionIndex).toBe(2);
        expect(goldfishState.rightPanelMode).toBe('notes');
    });

    it('skips sections without transcripts', () => {
        const timeline = createTimelineWithTranscripts([[true, false, false], [false, true]]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 0;

        advanceNotesSection(timeline);

        expect(goldfishState.currentChapterIndex).toBe(1);
        expect(goldfishState.currentSectionIndex).toBe(1);
    });

    it('does nothing when no more sections with transcripts', () => {
        const timeline = createTimelineWithTranscripts([[true, false], [false]]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 0;

        advanceNotesSection(timeline);

        expect(goldfishState.currentChapterIndex).toBe(0);
        expect(goldfishState.currentSectionIndex).toBe(0);
    });
});

describe('previousNotesSection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('moves to previous section with transcript', () => {
        const timeline = createTimelineWithTranscripts([[true, false, true]]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 2;

        previousNotesSection(timeline);

        expect(goldfishState.currentChapterIndex).toBe(0);
        expect(goldfishState.currentSectionIndex).toBe(0);
        expect(goldfishState.rightPanelMode).toBe('notes');
    });

    it('does nothing when at first section', () => {
        const timeline = createTimelineWithTranscripts([[true, true]]);
        goldfishState.currentChapterIndex = 0;
        goldfishState.currentSectionIndex = 0;

        previousNotesSection(timeline);

        expect(goldfishState.currentChapterIndex).toBe(0);
        expect(goldfishState.currentSectionIndex).toBe(0);
    });
});
