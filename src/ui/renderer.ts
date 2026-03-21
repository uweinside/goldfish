import { Timeline, AppState } from '../models/types.js';
import { getSecondsRemaining, getSessionActualRemaining, getScheduleDrift, formatTime } from '../core/timer.js';

const elTitle = document.getElementById('segment-title')!;
const elTimer = document.getElementById('timer')!;
const elProgressFill = document.getElementById('progress-bar-fill')!;
const elNextSegment = document.getElementById('next-segment')!;
const elTotalRemaining = document.getElementById('total-remaining')!;
const elInfoPanel = document.getElementById('info-panel')!;
const elPauseButton = document.getElementById('btn-pause');
const elSegmentKicker = document.getElementById('segment-kicker')!;
const elSegmentBadgeText = document.getElementById('segment-badge-text')!;
const elTimerState = document.getElementById('timer-state')!;
const elScheduleDrift = document.getElementById('schedule-drift')!;
const elLeftPanel = document.querySelector('.panel-left') as HTMLElement | null;
const elRightPanel = document.querySelector('.panel-right') as HTMLElement | null;

const STATE_CLASSES = ['state-ok', 'state-warn', 'state-over'] as const;
const TYPE_CLASSES = ['type-lecture', 'type-demo', 'type-break'] as const;
let lastRenderedSegmentIndex = -1;

const SECTION_COLORS: Record<string, string> = {
    focus: '#60A5FA',
    objective: '#60A5FA',
    talking: '#2DD4BF',
    prompt: '#FBBF24',
    demo: '#A78BFA',
    rule: '#F87171',
};

function getSectionColor(label: string): string {
    const lower = label.toLowerCase();
    for (const [keyword, color] of Object.entries(SECTION_COLORS)) {
        if (lower.includes(keyword)) return color;
    }
    return '#6B7280';
}

export function render(timeline: Timeline, state: AppState): void {
    const segment = timeline.segments[state.currentSegmentIndex];
    const hasSegmentChanged = lastRenderedSegmentIndex !== -1 && lastRenderedSegmentIndex !== state.currentSegmentIndex;
    if (hasSegmentChanged) {
        const panels: (HTMLElement | null)[] = [elLeftPanel, elRightPanel];
        for (const panel of panels) {
            if (!panel) continue;
            panel.classList.remove('panel-crossfade');
            // Force reflow so repeated same-class animations restart.
            void panel.offsetWidth;
            panel.classList.add('panel-crossfade');
        }
    }
    lastRenderedSegmentIndex = state.currentSegmentIndex;

    const secondsRemaining = getSecondsRemaining(segment, state);
    const nextIndex = state.currentSegmentIndex + 1;
    const nextSegment = nextIndex < timeline.segments.length ? timeline.segments[nextIndex] : undefined;
    const typeLabel = segment.type ? `${segment.type[0].toUpperCase()}${segment.type.slice(1)}` : 'Flow';

    // Timer display
    elTimer.textContent = formatTime(secondsRemaining);

    // Segment title
    elTitle.textContent = segment.title;
    elSegmentBadgeText.textContent = (segment.type?.[0] ?? segment.title[0] ?? 'C').toUpperCase();

    // Progress bar (0–100%, clamps at both ends; stays full during overtime)
    const elapsed = (segment.duration - Math.max(secondsRemaining, 0)) / segment.duration;
    elProgressFill.style.width = `${Math.min(100, Math.max(0, elapsed * 100)).toFixed(2)}%`;

    // Color state: ok → warn (last 20%) → over (overtime)
    const stateClass =
        secondsRemaining < 0 ? 'state-over' :
        secondsRemaining <= segment.duration * 0.2 ? 'state-warn' :
        'state-ok';
    STATE_CLASSES.forEach(c => document.body.classList.remove(c));
    document.body.classList.add(stateClass);

    const timerStateText =
        state.isPaused ? 'Paused' :
        secondsRemaining < 0 ? 'Overtime' :
        secondsRemaining <= segment.duration * 0.2 ? 'Wrapping up' :
        'On track';
    elTimerState.textContent = timerStateText;
    const kickerStatus = state.isPaused
        ? (state.hasStarted ? 'paused' : 'ready')
        : 'in progress';
    elSegmentKicker.textContent = `${typeLabel} segment ${kickerStatus}`;

    // Segment type accent
    TYPE_CLASSES.forEach(c => document.body.classList.remove(c));
    if (segment.type) {
        document.body.classList.add(`type-${segment.type}`);
    }

    // Paused indicator
    if (state.isPaused) {
        document.body.classList.add('paused');
    } else {
        document.body.classList.remove('paused');
    }
    if (elPauseButton) {
        const pauseLabel = state.isPaused
            ? (state.hasStarted ? 'Resume' : 'Start')
            : 'Pause';
        const pauseSymbol = state.isPaused ? '>' : 'II';
        const symbolEl = elPauseButton.querySelector('.control-symbol');
        const textEl = elPauseButton.querySelector('.control-text');
        if (symbolEl) symbolEl.textContent = pauseSymbol;
        if (textEl) textEl.textContent = pauseLabel;
    }

    // Next segment
    if (nextSegment) {
        elNextSegment.textContent = nextSegment.title;
    } else {
        elNextSegment.textContent = 'Last segment';
    }

    // Total session remaining (clock-based once started, planned total before start)
    const sessionRemaining = state.hasStarted
        ? getSessionActualRemaining(state)
        : timeline.segments.reduce((sum, seg) => sum + seg.duration, 0);
    elTotalRemaining.textContent = formatTime(sessionRemaining);

    // Schedule drift indicator
    const DRIFT_CLASSES = ['drift-ahead', 'drift-behind', 'drift-on-schedule'] as const;
    DRIFT_CLASSES.forEach(c => elScheduleDrift.classList.remove(c));
    if (!state.hasStarted) {
        elScheduleDrift.textContent = '';
    } else {
        const drift = getScheduleDrift(timeline, state);
        if (drift > 30) {
            elScheduleDrift.textContent = `${formatTime(drift)} ahead`;
            elScheduleDrift.classList.add('drift-ahead');
        } else if (drift < -30) {
            elScheduleDrift.textContent = `${formatTime(-drift)} behind`;
            elScheduleDrift.classList.add('drift-behind');
        } else {
            elScheduleDrift.textContent = 'On schedule';
            elScheduleDrift.classList.add('drift-on-schedule');
        }
    }

    // Info panel is always visible
    elInfoPanel.innerHTML = '';
    if (segment.info && segment.info.length > 0) {
        for (let i = 0; i < segment.info.length; i++) {
            const section = segment.info[i];
            const sectionEl = document.createElement('div');
            const priority = i === 0 ? 'info-section-primary' : i === 1 ? 'info-section-secondary' : 'info-section-tertiary';
            sectionEl.className = `info-section ${priority}`;
            sectionEl.style.setProperty('--section-accent', getSectionColor(section.label));

            const labelEl = document.createElement('h3');
            labelEl.className = 'info-label';
            labelEl.textContent = section.label;
            sectionEl.appendChild(labelEl);

            const listEl = document.createElement('ul');
            listEl.className = 'info-items';
            for (const item of section.items) {
                const li = document.createElement('li');
                li.textContent = item;
                listEl.appendChild(li);
            }
            sectionEl.appendChild(listEl);
            elInfoPanel.appendChild(sectionEl);
        }
    }
}
