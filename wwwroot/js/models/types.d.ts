export interface Segment {
    title: string;
    duration: number;
    type?: 'lecture' | 'demo' | 'break';
    notes?: string[];
}
export interface Timeline {
    segments: Segment[];
}
export interface AppState {
    currentSegmentIndex: number;
    segmentStartTime: number;
    isPaused: boolean;
    pausedAt?: number;
}
//# sourceMappingURL=types.d.ts.map