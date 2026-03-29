import { describe, expect, it } from 'vitest';
import { formatDuration } from './start.js';

describe('formatDuration (start page)', () => {
    it('returns mm:ss for durations below one hour', () => {
        expect(formatDuration(0)).toBe('00:00');
        expect(formatDuration(3599)).toBe('59:59');
    });

    it('returns hh:mm:ss for durations of one hour or more', () => {
        expect(formatDuration(3600)).toBe('01:00:00');
        expect(formatDuration(3661)).toBe('01:01:01');
    });
});
