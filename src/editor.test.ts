import { describe, expect, it } from 'vitest';
import type { Timeline } from './models/types.js';
import { formatSessionDuration, normalizeTimelineAndSelection } from './editor.js';

function createTimeline(chapters: Array<{ title: string; sections: Array<{ title: string }> }>): Timeline {
    return {
        title: 'Test Course',
        chapters: chapters.map(chapter => ({
            title: chapter.title,
            sections: chapter.sections.map(section => ({
                title: section.title,
                type: 'Narration',
                durationSeconds: 300,
                instructions: 'Test instructions',
            })),
        })),
    };
}

describe('normalizeTimelineAndSelection', () => {
    it('auto-creates a default chapter and section when chapters are empty', () => {
        const timeline = createTimeline([]);

        const normalized = normalizeTimelineAndSelection(timeline, 4, 8);

        expect(timeline.chapters).toHaveLength(1);
        expect(timeline.chapters[0].title).toBe('Chapter 1');
        expect(timeline.chapters[0].sections).toHaveLength(1);
        expect(timeline.chapters[0].sections[0].title).toBe('Section 1');
        expect(normalized.selectedChapterIndex).toBe(0);
        expect(normalized.selectedSectionIndex).toBe(0);
    });

    it('auto-creates a default section when selected chapter has no sections', () => {
        const timeline = createTimeline([
            { title: 'Chapter A', sections: [] },
        ]);

        const normalized = normalizeTimelineAndSelection(timeline, 0, null);

        expect(timeline.chapters[0].sections).toHaveLength(1);
        expect(timeline.chapters[0].sections[0].title).toBe('Section 1');
        expect(normalized.selectedChapterIndex).toBe(0);
        expect(normalized.selectedSectionIndex).toBe(null);
    });

    it('clamps chapter index into valid bounds', () => {
        const timeline = createTimeline([
            { title: 'Chapter A', sections: [{ title: 'S1' }] },
            { title: 'Chapter B', sections: [{ title: 'S2' }] },
        ]);

        const high = normalizeTimelineAndSelection(timeline, 99, null);
        const low = normalizeTimelineAndSelection(timeline, -9, null);

        expect(high.selectedChapterIndex).toBe(1);
        expect(low.selectedChapterIndex).toBe(0);
    });

    it('clamps section index into valid bounds for selected chapter', () => {
        const timeline = createTimeline([
            {
                title: 'Chapter A',
                sections: [{ title: 'S1' }, { title: 'S2' }, { title: 'S3' }],
            },
        ]);

        const high = normalizeTimelineAndSelection(timeline, 0, 99);
        const low = normalizeTimelineAndSelection(timeline, 0, -2);

        expect(high.selectedSectionIndex).toBe(2);
        expect(low.selectedSectionIndex).toBe(0);
    });

    it('keeps section selection null when no section is explicitly selected', () => {
        const timeline = createTimeline([
            { title: 'Chapter A', sections: [{ title: 'S1' }] },
        ]);

        const normalized = normalizeTimelineAndSelection(timeline, 0, null);

        expect(normalized.selectedSectionIndex).toBe(null);
    });

    it('repairs missing title to Untitled Course', () => {
        const timeline = createTimeline([{ title: 'Chapter A', sections: [{ title: 'S1' }] }]);
        timeline.title = '';

        normalizeTimelineAndSelection(timeline, 0, null);

        expect(timeline.title).toBe('Untitled Course');
    });
});

describe('formatSessionDuration', () => {
    it('returns friendly duration strings below one hour', () => {
        expect(formatSessionDuration(59)).toBe('59s');
        expect(formatSessionDuration(3599)).toBe('59m 59s');
    });

    it('returns friendly duration strings for one hour or more', () => {
        expect(formatSessionDuration(3600)).toBe('1h');
        expect(formatSessionDuration(3661)).toBe('1h 1m 1s');
    });
});
