export interface InfoSection {
    label: string;
    items: string[];
}
export interface Segment {
    title: string;
    duration: number;
    type?: 'lecture' | 'demo' | 'break';
    info?: InfoSection[];
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