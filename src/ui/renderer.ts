import { Timeline, AppState, Section } from '../models/types.js';
import { getSecondsRemaining, getSessionActualRemaining, getScheduleDrift, formatTime } from '../core/timer.js';

const elTitle = document.getElementById('segment-title')!;
const elTimer = document.getElementById('timer')!;
const elProgressFill = document.getElementById('progress-bar-fill')!;
const elNextSegment = document.getElementById('next-segment')!;
const elTotalRemaining = document.getElementById('total-remaining')!;
const elInfoPanel = document.getElementById('info-panel')!;
const elPanelRightHeader = document.getElementById('panel-right-header')!;
const elPauseButton = document.getElementById('btn-pause');
const elSegmentKicker = document.getElementById('segment-kicker')!;
const elSegmentBadgeText = document.getElementById('segment-badge-text')!;
const elTimerState = document.getElementById('timer-state')!;
const elScheduleDrift = document.getElementById('schedule-drift')!;
const elLeftPanel = document.querySelector('.panel-left') as HTMLElement | null;
const elRightPanel = document.querySelector('.panel-right') as HTMLElement | null;

const STATE_CLASSES = ['state-ok', 'state-warn', 'state-over'] as const;
let lastRenderKey = '';

interface TimelinePosition {
    chapterIndex: number;
    sectionIndex: number;
}

function flattenPositions(timeline: Timeline): TimelinePosition[] {
    const positions: TimelinePosition[] = [];
    for (let chapterIndex = 0; chapterIndex < timeline.chapters.length; chapterIndex++) {
        const chapter = timeline.chapters[chapterIndex];
        for (let sectionIndex = 0; sectionIndex < chapter.sections.length; sectionIndex++) {
            positions.push({ chapterIndex, sectionIndex });
        }
    }
    return positions;
}

function getCurrentSection(timeline: Timeline, state: AppState): Section {
    return timeline.chapters[state.currentChapterIndex].sections[state.currentSectionIndex];
}

function getCurrentChapterTitle(timeline: Timeline, state: AppState): string {
    return timeline.chapters[state.currentChapterIndex].title;
}

function getNextPosition(timeline: Timeline, state: AppState): TimelinePosition | undefined {
    const positions = flattenPositions(timeline);
    const currentIndex = positions.findIndex(
        p => p.chapterIndex === state.currentChapterIndex && p.sectionIndex === state.currentSectionIndex,
    );
    if (currentIndex < 0 || currentIndex >= positions.length - 1) {
        return undefined;
    }
    return positions[currentIndex + 1];
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(text: string): string {
    let output = escapeHtml(text);
    output = output.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    output = output.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    output = output.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return output;
}

function renderMarkdown(markdown: string): string {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const htmlParts: string[] = [];
    let inUnorderedList = false;
    let inOrderedList = false;
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];

    const closeLists = (): void => {
        if (inUnorderedList) {
            htmlParts.push('</ul>');
            inUnorderedList = false;
        }
        if (inOrderedList) {
            htmlParts.push('</ol>');
            inOrderedList = false;
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                closeLists();
                inCodeBlock = true;
                codeBlockLines = [];
            } else {
                htmlParts.push(`<pre><code>${escapeHtml(codeBlockLines.join('\n'))}</code></pre>`);
                inCodeBlock = false;
                codeBlockLines = [];
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockLines.push(rawLine);
            continue;
        }

        if (!line) {
            closeLists();
            continue;
        }

        const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
            closeLists();
            const level = Math.min(headingMatch[1].length + 1, 4);
            htmlParts.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
            continue;
        }

        const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
        if (orderedMatch) {
            if (inUnorderedList) {
                htmlParts.push('</ul>');
                inUnorderedList = false;
            }
            if (!inOrderedList) {
                htmlParts.push('<ol>');
                inOrderedList = true;
            }
            htmlParts.push(`<li>${formatInlineMarkdown(orderedMatch[1])}</li>`);
            continue;
        }

        const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
        if (unorderedMatch) {
            if (inOrderedList) {
                htmlParts.push('</ol>');
                inOrderedList = false;
            }
            if (!inUnorderedList) {
                htmlParts.push('<ul>');
                inUnorderedList = true;
            }
            htmlParts.push(`<li>${formatInlineMarkdown(unorderedMatch[1])}</li>`);
            continue;
        }

        closeLists();
        htmlParts.push(`<p>${formatInlineMarkdown(line)}</p>`);
    }

    closeLists();
    if (inCodeBlock) {
        htmlParts.push(`<pre><code>${escapeHtml(codeBlockLines.join('\n'))}</code></pre>`);
    }

    return htmlParts.join('');
}

function renderInfoPanel(section: Section): void {
    const transcriptAvailable = typeof section.transcript === 'string' && section.transcript.trim().length > 0;

    elPanelRightHeader.innerHTML = `
        <div class="notes-top-row">
            <span class="notes-mode-label">Outline View</span>
            ${transcriptAvailable ? '<button id="outline-view-transcript" class="outline-view-transcript-btn" type="button" aria-label="Switch to Transcript View"><span>Transcript</span><span aria-hidden="true">&rarr;</span></button>' : ''}
        </div>
    `;

    elInfoPanel.innerHTML = `
        <div class="info-section info-section-primary${transcriptAvailable ? ' info-section-notes-enabled' : ''}" ${transcriptAvailable ? 'data-notes-enabled="true" role="button" tabindex="0"' : ''}>
            <div class="info-label-row">
                <h3 class="info-label">${escapeHtml(section.title)}</h3>
                ${transcriptAvailable ? '<span class="notes-marker" aria-hidden="true">T</span>' : ''}
            </div>
            <div class="notes-block">${renderMarkdown(section.instructions || '')}</div>
        </div>
    `;
}

function renderNotesPanel(timeline: Timeline, state: AppState, section: Section): void {
    const positions = flattenPositions(timeline);
    const currentIndex = positions.findIndex(
        p => p.chapterIndex === state.currentChapterIndex && p.sectionIndex === state.currentSectionIndex,
    );

    const hasPrev = positions.slice(0, Math.max(0, currentIndex)).some(
        p => (timeline.chapters[p.chapterIndex].sections[p.sectionIndex].transcript || '').trim().length > 0,
    );
    const hasNext = positions.slice(currentIndex + 1).some(
        p => (timeline.chapters[p.chapterIndex].sections[p.sectionIndex].transcript || '').trim().length > 0,
    );

    elPanelRightHeader.innerHTML = `
        <div class="notes-top-row">
            <span class="notes-mode-label">Transcript View</span>
            <div class="notes-top-row-actions">
                <button id="notes-back" class="notes-back-btn" type="button" aria-label="Back to Outline View">
                    <span aria-hidden="true">&larr;</span>
                    <span>Outline</span>
                </button>
                <div class="notes-nav-row">
                    <button id="notes-prev" class="notes-nav-btn" type="button" aria-label="Previous transcript section"${hasPrev ? '' : ' disabled'}>
                        <span aria-hidden="true">&larr;</span>
                        <span>Prev</span>
                    </button>
                    <button id="notes-next" class="notes-nav-btn" type="button" aria-label="Next transcript section"${hasNext ? '' : ' disabled'}>
                        <span>Next</span>
                        <span aria-hidden="true">&rarr;</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    const transcript = section.transcript && section.transcript.trim().length > 0
        ? section.transcript
        : 'No transcript available for this section.';

    elInfoPanel.innerHTML = `
        <div class="notes-view" aria-live="polite">
            <div class="notes-header">
                <p class="notes-kicker">Transcript</p>
                <h3>${escapeHtml(section.title)}</h3>
                <p class="notes-subtitle">${escapeHtml(getCurrentChapterTitle(timeline, state))}</p>
            </div>
            <div class="notes-content">
                <section class="notes-block">${renderMarkdown(transcript)}</section>
            </div>
        </div>
    `;
}

export function render(timeline: Timeline, state: AppState): void {
    const section = getCurrentSection(timeline, state);
    const chapterTitle = getCurrentChapterTitle(timeline, state);
    const nextPosition = getNextPosition(timeline, state);

    const renderKey = [
        state.currentChapterIndex,
        state.currentSectionIndex,
        state.rightPanelMode,
    ].join('|');

    if (renderKey !== lastRenderKey) {
        const panels: (HTMLElement | null)[] = [elLeftPanel, elRightPanel];
        for (const panel of panels) {
            if (!panel) continue;
            panel.classList.remove('panel-crossfade');
            void panel.offsetWidth;
            panel.classList.add('panel-crossfade');
        }
        lastRenderKey = renderKey;
    }

    const secondsRemaining = getSecondsRemaining(section, state);

    elTimer.textContent = formatTime(secondsRemaining);
    elTitle.textContent = section.title;
    elSegmentBadgeText.textContent = section.type.slice(0, 1).toUpperCase();

    const elapsed = (section.durationSeconds - Math.max(secondsRemaining, 0)) / section.durationSeconds;
    elProgressFill.style.width = `${Math.min(100, Math.max(0, elapsed * 100)).toFixed(2)}%`;

    const stateClass =
        secondsRemaining < 0 ? 'state-over' :
        secondsRemaining <= section.durationSeconds * 0.2 ? 'state-warn' :
        'state-ok';
    STATE_CLASSES.forEach(c => document.body.classList.remove(c));
    document.body.classList.add(stateClass);

    const timerStateText =
        state.isPaused ? 'Paused' :
        secondsRemaining < 0 ? 'Overtime' :
        secondsRemaining <= section.durationSeconds * 0.2 ? 'Wrapping up' :
        'On track';
    elTimerState.textContent = timerStateText;

    const kickerStatus = state.isPaused
        ? (state.hasStarted ? 'paused' : 'ready')
        : 'in progress';
    elSegmentKicker.textContent = `${chapterTitle} · ${section.type} · ${kickerStatus}`;

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

    if (nextPosition) {
        const nextSection = timeline.chapters[nextPosition.chapterIndex].sections[nextPosition.sectionIndex];
        elNextSegment.textContent = nextSection.title;
    } else {
        elNextSegment.textContent = 'Last section';
    }

    const sessionRemaining = state.hasStarted
        ? getSessionActualRemaining(state)
        : timeline.chapters
            .flatMap(chapter => chapter.sections)
            .reduce((sum, s) => sum + s.durationSeconds, 0);
    elTotalRemaining.textContent = formatTime(sessionRemaining);

    const DRIFT_CLASSES = ['drift-ahead', 'drift-behind', 'drift-on-schedule'] as const;
    DRIFT_CLASSES.forEach(c => elScheduleDrift.classList.remove(c));
    if (!state.hasStarted) {
        elScheduleDrift.textContent = '';
    } else {
        const drift = getScheduleDrift(timeline, state);
        if (drift > 30) {
            elScheduleDrift.textContent = `${formatTime(Math.round(drift))} ahead`;
            elScheduleDrift.classList.add('drift-ahead');
        } else if (drift < -30) {
            elScheduleDrift.textContent = `${formatTime(Math.round(-drift))} behind`;
            elScheduleDrift.classList.add('drift-behind');
        } else {
            elScheduleDrift.textContent = 'On schedule';
            elScheduleDrift.classList.add('drift-on-schedule');
        }
    }

    const hasTranscript = typeof section.transcript === 'string' && section.transcript.trim().length > 0;
    elRightPanel?.classList.toggle('panel-notes-available', hasTranscript || state.rightPanelMode === 'notes');
    elRightPanel?.classList.toggle('panel-notes-open', state.rightPanelMode === 'notes');

    if (state.rightPanelMode === 'notes') {
        renderNotesPanel(timeline, state, section);
    } else {
        renderInfoPanel(section);
    }
}
