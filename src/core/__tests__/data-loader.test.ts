import { describe, it, expect } from 'vitest';

// We need to test the isTimeline function, but it's not exported.
// For comprehensive testing, we'll create a local copy of the type guard logic
// or test it indirectly through the module's behavior.

// Type guard implementation for testing (mirrors data-loader.ts)
interface Timeline {
    title: string;
    chapters: Array<{
        title: string;
        sections: unknown[];
    }>;
}

function isTimeline(data: unknown): data is Timeline {
    if (!data || typeof data !== 'object') {
        return false;
    }

    const value = data as Partial<Timeline>;
    if (!Array.isArray(value.chapters)) {
        return false;
    }

    return value.chapters.every(chapter =>
        !!chapter &&
        typeof chapter === 'object' &&
        typeof chapter.title === 'string' &&
        Array.isArray(chapter.sections),
    );
}

describe('isTimeline type guard', () => {
    describe('valid timelines', () => {
        it('accepts minimal valid timeline', () => {
            const data = {
                title: 'Test Course',
                chapters: [],
            };
            expect(isTimeline(data)).toBe(true);
        });

        it('accepts timeline with chapters and sections', () => {
            const data = {
                title: 'Test Course',
                chapters: [
                    {
                        title: 'Chapter 1',
                        sections: [
                            {
                                title: 'Section 1',
                                type: 'Narration',
                                durationSeconds: 60,
                                instructions: 'Test',
                            },
                        ],
                    },
                ],
            };
            expect(isTimeline(data)).toBe(true);
        });

        it('accepts timeline with multiple chapters', () => {
            const data = {
                title: 'Test Course',
                chapters: [
                    { title: 'Chapter 1', sections: [] },
                    { title: 'Chapter 2', sections: [] },
                    { title: 'Chapter 3', sections: [] },
                ],
            };
            expect(isTimeline(data)).toBe(true);
        });

        it('accepts timeline with extra properties (extensible)', () => {
            const data = {
                title: 'Test Course',
                chapters: [{ title: 'Ch1', sections: [] }],
                author: 'Test Author',
                version: '1.0',
            };
            expect(isTimeline(data)).toBe(true);
        });
    });

    describe('invalid timelines', () => {
        it('rejects null', () => {
            expect(isTimeline(null)).toBe(false);
        });

        it('rejects undefined', () => {
            expect(isTimeline(undefined)).toBe(false);
        });

        it('rejects primitive types', () => {
            expect(isTimeline('string')).toBe(false);
            expect(isTimeline(123)).toBe(false);
            expect(isTimeline(true)).toBe(false);
        });

        it('rejects empty object', () => {
            expect(isTimeline({})).toBe(false);
        });

        it('rejects object without chapters array', () => {
            const data = {
                title: 'Test Course',
            };
            expect(isTimeline(data)).toBe(false);
        });

        it('rejects when chapters is not an array', () => {
            const data = {
                title: 'Test Course',
                chapters: 'not an array',
            };
            expect(isTimeline(data)).toBe(false);
        });

        it('rejects when chapters is null', () => {
            const data = {
                title: 'Test Course',
                chapters: null,
            };
            expect(isTimeline(data)).toBe(false);
        });

        it('rejects chapter without title', () => {
            const data = {
                title: 'Test Course',
                chapters: [
                    { sections: [] }, // Missing title
                ],
            };
            expect(isTimeline(data)).toBe(false);
        });

        it('rejects chapter with non-string title', () => {
            const data = {
                title: 'Test Course',
                chapters: [
                    { title: 123, sections: [] },
                ],
            };
            expect(isTimeline(data)).toBe(false);
        });

        it('rejects chapter without sections array', () => {
            const data = {
                title: 'Test Course',
                chapters: [
                    { title: 'Chapter 1' }, // Missing sections
                ],
            };
            expect(isTimeline(data)).toBe(false);
        });

        it('rejects chapter with non-array sections', () => {
            const data = {
                title: 'Test Course',
                chapters: [
                    { title: 'Chapter 1', sections: 'not an array' },
                ],
            };
            expect(isTimeline(data)).toBe(false);
        });

        it('rejects null chapter in array', () => {
            const data = {
                title: 'Test Course',
                chapters: [null],
            };
            expect(isTimeline(data)).toBe(false);
        });

        it('rejects array instead of object', () => {
            expect(isTimeline([])).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('accepts empty chapters array', () => {
            const data = {
                title: 'Empty Course',
                chapters: [],
            };
            expect(isTimeline(data)).toBe(true);
        });

        it('accepts chapter with empty sections array', () => {
            const data = {
                title: 'Test Course',
                chapters: [
                    { title: 'Empty Chapter', sections: [] },
                ],
            };
            expect(isTimeline(data)).toBe(true);
        });

        it('accepts empty string as chapter title', () => {
            const data = {
                title: 'Test Course',
                chapters: [
                    { title: '', sections: [] },
                ],
            };
            expect(isTimeline(data)).toBe(true);
        });

        it('validates all chapters (fails on any invalid)', () => {
            const data = {
                title: 'Test Course',
                chapters: [
                    { title: 'Valid', sections: [] },
                    { title: 'Also Valid', sections: [] },
                    { sections: [] }, // Invalid - missing title
                ],
            };
            expect(isTimeline(data)).toBe(false);
        });
    });
});
