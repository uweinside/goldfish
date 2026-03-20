import { Segment, Timeline, AppState } from '../models/types.js';
export declare function getElapsedMs(state: AppState): number;
export declare function getSecondsRemaining(segment: Segment, state: AppState): number;
export declare function getTotalRemainingSeconds(timeline: Timeline, state: AppState): number;
export declare function formatTime(totalSeconds: number): string;
//# sourceMappingURL=timer.d.ts.map