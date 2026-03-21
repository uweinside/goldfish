import { getSecondsRemaining, getTotalRemainingSeconds, formatTime } from '../core/timer.js';
const elTitle = document.getElementById('segment-title');
const elTimer = document.getElementById('timer');
const elProgressFill = document.getElementById('progress-bar-fill');
const elNextSegment = document.getElementById('next-segment');
const elTotalRemaining = document.getElementById('total-remaining');
const elInfoPanel = document.getElementById('info-panel');
const elPauseButton = document.getElementById('btn-pause');
const elSegmentKicker = document.getElementById('segment-kicker');
const elSegmentBadgeText = document.getElementById('segment-badge-text');
const elTimerState = document.getElementById('timer-state');
const STATE_CLASSES = ['state-ok', 'state-warn', 'state-over'];
const TYPE_CLASSES = ['type-lecture', 'type-demo', 'type-break'];
const SECTION_COLORS = {
    focus: '#60A5FA',
    objective: '#60A5FA',
    talking: '#2DD4BF',
    prompt: '#FBBF24',
    demo: '#A78BFA',
    rule: '#F87171',
};
function getSectionColor(label) {
    const lower = label.toLowerCase();
    for (const [keyword, color] of Object.entries(SECTION_COLORS)) {
        if (lower.includes(keyword))
            return color;
    }
    return '#6B7280';
}
export function render(timeline, state) {
    const segment = timeline.segments[state.currentSegmentIndex];
    const secondsRemaining = getSecondsRemaining(segment, state);
    const nextIndex = state.currentSegmentIndex + 1;
    const nextSegment = nextIndex < timeline.segments.length ? timeline.segments[nextIndex] : undefined;
    const typeLabel = segment.type ? `${segment.type[0].toUpperCase()}${segment.type.slice(1)}` : 'Flow';
    elTimer.textContent = formatTime(secondsRemaining);
    elTitle.textContent = segment.title;
    elSegmentBadgeText.textContent = (segment.type?.[0] ?? segment.title[0] ?? 'C').toUpperCase();
    const elapsed = (segment.duration - Math.max(secondsRemaining, 0)) / segment.duration;
    elProgressFill.style.width = `${Math.min(100, Math.max(0, elapsed * 100)).toFixed(2)}%`;
    const stateClass = secondsRemaining < 0 ? 'state-over' :
        secondsRemaining <= segment.duration * 0.2 ? 'state-warn' :
            'state-ok';
    STATE_CLASSES.forEach(c => document.body.classList.remove(c));
    document.body.classList.add(stateClass);
    const timerStateText = state.isPaused ? 'Paused' :
        secondsRemaining < 0 ? 'Overtime' :
            secondsRemaining <= segment.duration * 0.2 ? 'Wrapping up' :
                'On track';
    elTimerState.textContent = timerStateText;
    elSegmentKicker.textContent = `${typeLabel} segment ${state.isPaused ? 'paused' : 'in progress'}`;
    TYPE_CLASSES.forEach(c => document.body.classList.remove(c));
    if (segment.type) {
        document.body.classList.add(`type-${segment.type}`);
    }
    if (state.isPaused) {
        document.body.classList.add('paused');
    }
    else {
        document.body.classList.remove('paused');
    }
    if (elPauseButton) {
        elPauseButton.innerHTML = state.isPaused
            ? '<span class="control-symbol" aria-hidden="true">></span><span class="control-text">Resume</span>'
            : '<span class="control-symbol" aria-hidden="true">II</span><span class="control-text">Pause</span>';
    }
    if (nextSegment) {
        elNextSegment.textContent = nextSegment.title;
    }
    else {
        elNextSegment.textContent = 'Last segment';
    }
    elTotalRemaining.textContent = formatTime(getTotalRemainingSeconds(timeline, state));
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
//# sourceMappingURL=renderer.js.map