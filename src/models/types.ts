export type SectionType = 'Narration' | 'Demo' | 'Prompt' | 'Rule';

export interface Section {
    title: string;
    type: SectionType;
    durationSeconds: number;
    instructions: string;
    transcript?: string;
}

export interface Chapter {
    title: string;
    sections: Section[];
}

export interface Timeline {
    title: string;
    chapters: Chapter[];
}

export interface AppState {
    currentChapterIndex: number;
    currentSectionIndex: number;
    sectionStartTime: number; // Date.now() when section effectively started (adjusted for pauses)
    isPaused: boolean;
    pausedAt?: number; // Date.now() when paused
    hasStarted: boolean; // true once the user starts the timer for the first time
    sessionEndTime: number; // fixed wall-clock endpoint (shifts forward on pause/resume)
    rightPanelMode: 'info' | 'notes';
}
