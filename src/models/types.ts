export interface InfoSection {
    label: string;
    items: string[];
}

export interface Segment {
    title: string;
    duration: number; // seconds
    type?: 'lecture' | 'demo' | 'break';
    info?: InfoSection[];
}

export interface Timeline {
    title?: string;
    segments: Segment[];
}

export interface AppState {
    currentSegmentIndex: number;
    segmentStartTime: number; // Date.now() when segment effectively started (adjusted for pauses)
    isPaused: boolean;
    pausedAt?: number; // Date.now() when paused
    hasStarted: boolean; // true once the user starts the timer for the first time
    sessionEndTime: number; // fixed wall-clock endpoint (shifts forward on pause/resume)
}
