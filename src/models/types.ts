export interface Segment {
    title: string;
    duration: number; // seconds
    type?: 'lecture' | 'demo' | 'break';
    notes?: string[];
}

export interface Timeline {
    segments: Segment[];
}

export interface AppState {
    currentSegmentIndex: number;
    segmentStartTime: number; // Date.now() when segment effectively started (adjusted for pauses)
    isPaused: boolean;
    pausedAt?: number; // Date.now() when paused
}
