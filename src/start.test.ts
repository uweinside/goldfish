import { describe, expect, it } from 'vitest';
import { formatDuration } from './start.js';

describe('formatDuration (start page)', () => {
    it('omits seconds and rounds up to the next minute for sub-hour durations', () => {
        expect(formatDuration(0)).toBe('0m');
        expect(formatDuration(1)).toBe('1m');
        expect(formatDuration(3599)).toBe('1h');
    });

    it('omits seconds and rounds up to minutes for hour durations', () => {
        expect(formatDuration(3600)).toBe('1h');
        expect(formatDuration(3661)).toBe('1h 2m');
    });
});
