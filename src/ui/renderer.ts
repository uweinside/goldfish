import { Timeline, AppState } from '../models/types.js';
import { getSecondsRemaining, getTotalRemainingSeconds, formatTime } from '../core/timer.js';

const elTitle = document.getElementById('segment-title')!;
const elTimer = document.getElementById('timer')!;
const elProgressFill = document.getElementById('progress-bar-fill')!;
const elNextSegment = document.getElementById('next-segment')!;
const elTotalRemaining = document.getElementById('total-remaining')!;
const elInfoPanel = document.getElementById('info-panel')!;

const STATE_CLASSES = ['state-ok', 'state-warn', 'state-over'] as const;
const TYPE_CLASSES = ['type-lecture', 'type-demo', 'type-break'] as const;

export function render(timeline: Timeline, state: AppState): void {
    const segment = timeline.segments[state.currentSegmentIndex];
    const secondsRemaining = getSecondsRemaining(segment, state);

    // Timer display
    elTimer.textContent = formatTime(secondsRemaining);

    // Segment title
    elTitle.textContent = segment.title;

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

    // Next segment
    const nextIndex = state.currentSegmentIndex + 1;
    if (nextIndex < timeline.segments.length) {
        elNextSegment.textContent = `Next: ${timeline.segments[nextIndex].title}`;
    } else {
        elNextSegment.textContent = 'Last segment';
    }

    // Total session remaining
    elTotalRemaining.textContent = `Session remaining: ${formatTime(getTotalRemainingSeconds(timeline, state))}`;

    // Info panel is always visible
    elInfoPanel.innerHTML = '';
    if (segment.info && segment.info.length > 0) {
        for (const section of segment.info) {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'info-section';

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
