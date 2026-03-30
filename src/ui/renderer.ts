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

function getCurrentChapter(timeline: Timeline, state: AppState): Timeline['chapters'][number] {
    return timeline.chapters[state.currentChapterIndex];
}

function getCurrentChapterTitle(timeline: Timeline, state: AppState): string {
    return timeline.chapters[state.currentChapterIndex].title;
}

function getCurrentChapterTotalSeconds(timeline: Timeline, state: AppState): number {
    return getCurrentChapter(timeline, state)
        .sections
        .reduce((sum, s) => sum + s.durationSeconds, 0);
}

function getCurrentChapterRemainingSeconds(timeline: Timeline, state: AppState): number {
    const chapter = getCurrentChapter(timeline, state);
    const currentSection = chapter.sections[state.currentSectionIndex];
    const currentSectionRemaining = getSecondsRemaining(currentSection, state);

    const futureSectionSeconds = chapter.sections
        .slice(state.currentSectionIndex + 1)
        .reduce((sum, section) => sum + section.durationSeconds, 0);

    return currentSectionRemaining + futureSectionSeconds;
}

function getSectionToneClass(index: number): string {
    if (index === 0) {
        return 'info-section-primary';
    }
    if (index === 1) {
        return 'info-section-secondary';
    }
    return 'info-section-tertiary';
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

function renderSectionsPanel(timeline: Timeline, state: AppState, canOpenTranscriptMode: boolean): void {
    const chapter = getCurrentChapter(timeline, state);
    const section = chapter.sections[state.currentSectionIndex];
    const transcriptAvailable = typeof section.transcript === 'string' && section.transcript.trim().length > 0;

    elPanelRightHeader.innerHTML = `
        <div class="notes-top-row">
            <span class="notes-mode-label">Outline View</span>
            ${canOpenTranscriptMode ? '<button id="outline-view-transcript" class="outline-view-transcript-btn" type="button" aria-label="Switch to Transcript View"><span>Transcript</span><span aria-hidden="true">&rarr;</span></button>' : ''}
        </div>
    `;

    const sectionCards = chapter.sections
        .map((chapterSection, index) => {
            const isCurrent = index === state.currentSectionIndex;
            const toneClass = getSectionToneClass(index);
            const sectionHasTranscript = typeof chapterSection.transcript === 'string' && chapterSection.transcript.trim().length > 0;
            const notesClass = sectionHasTranscript ? ' info-section-notes-enabled' : '';
            const instructions = chapterSection.instructions && chapterSection.instructions.trim().length > 0
                ? chapterSection.instructions
                : 'No instructions provided for this section.';
            return `
                <div class="info-section ${toneClass}${isCurrent ? ' info-section-current' : ''}${notesClass}" data-section-index="${index}" tabindex="0" role="button" aria-label="View section ${index + 1}: ${escapeHtml(chapterSection.title)}${sectionHasTranscript ? ' (has transcript)' : ''}">
                    <div class="info-label-row">
                        <h3 class="info-label">${escapeHtml(`${index + 1}. ${chapterSection.title}`)}</h3>
                        ${isCurrent ? '<span class="notes-marker" aria-hidden="true">Now</span>' : ''}
                    </div>
                    <p class="chapter-section-meta">${escapeHtml(chapterSection.type)} · ${formatTime(chapterSection.durationSeconds)}</p>
                    <div class="chapter-section-instructions">${renderMarkdown(instructions)}</div>
                </div>
            `;
        })
        .join('');

    elInfoPanel.innerHTML = `
        ${sectionCards}
    `;
}

function renderNotesPanel(timeline: Timeline, state: AppState, section: Section): void {
    const positions = flattenPositions(timeline);
    const currentIndex = positions.findIndex(
        p => p.chapterIndex === state.currentChapterIndex && p.sectionIndex === state.currentSectionIndex,
    );

    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < positions.length - 1;

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
    const chapter = getCurrentChapter(timeline, state);
    const section = getCurrentSection(timeline, state);
    const chapterTitle = getCurrentChapterTitle(timeline, state);
    const nextPosition = getNextPosition(timeline, state);

    const renderKey = [
        state.currentChapterIndex,
        state.currentSectionIndex,
        state.rightPanelMode,
    ].join('|');

    const rightPanelChanged = renderKey !== lastRenderKey;
    if (rightPanelChanged) {
        lastRenderKey = renderKey;
    }

    const chapterTotalSeconds = getCurrentChapterTotalSeconds(timeline, state);
    const chapterSecondsRemaining = getCurrentChapterRemainingSeconds(timeline, state);

    elTimer.textContent = formatTime(chapterSecondsRemaining);
    elTitle.textContent = chapter.title;
    elSegmentBadgeText.textContent = String(state.currentChapterIndex + 1);

    const elapsed = (chapterTotalSeconds - Math.max(chapterSecondsRemaining, 0)) / chapterTotalSeconds;
    elProgressFill.style.width = `${Math.min(100, Math.max(0, elapsed * 100)).toFixed(2)}%`;

    const stateClass =
        chapterSecondsRemaining < 0 ? 'state-over' :
        chapterSecondsRemaining <= chapterTotalSeconds * 0.2 ? 'state-warn' :
        'state-ok';
    STATE_CLASSES.forEach(c => document.body.classList.remove(c));
    document.body.classList.add(stateClass);

    const timerStateText =
        state.isPaused ? 'Paused' :
        chapterSecondsRemaining < 0 ? 'Overtime' :
        chapterSecondsRemaining <= chapterTotalSeconds * 0.2 ? 'Wrapping up' :
        'On track';
    elTimerState.textContent = timerStateText;

    const kickerStatus = state.isPaused
        ? (state.hasStarted ? 'paused' : 'ready')
        : 'in progress';
    elSegmentKicker.textContent = `${timeline.title} · chapter ${state.currentChapterIndex + 1}/${timeline.chapters.length} · ${kickerStatus}`;

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

    // Enable/disable prev/next buttons based on chapter position
    const prevBtn = document.getElementById('btn-prev') as HTMLButtonElement | null;
    const nextBtn = document.getElementById('btn-next') as HTMLButtonElement | null;
    if (prevBtn) {
        prevBtn.disabled = state.currentChapterIndex === 0;
    }
    if (nextBtn) {
        nextBtn.disabled = state.currentChapterIndex >= timeline.chapters.length - 1;
    }

    const nextChapter = timeline.chapters[state.currentChapterIndex + 1];
    if (nextChapter) {
        elNextSegment.textContent = nextChapter.title;
    } else {
        elNextSegment.textContent = 'Last chapter';
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
    const hasAnyTranscript = timeline.chapters.some(chapter =>
        chapter.sections.some(s => typeof s.transcript === 'string' && s.transcript.trim().length > 0),
    );
    elRightPanel?.classList.toggle('panel-notes-available', hasAnyTranscript || state.rightPanelMode === 'notes');
    elRightPanel?.classList.toggle('panel-notes-open', state.rightPanelMode === 'notes');

    // Only re-render right panel content when state changes to avoid flicker and preserve interactions
    if (rightPanelChanged) {
        if (state.rightPanelMode === 'notes') {
            renderNotesPanel(timeline, state, section);
        } else {
            renderSectionsPanel(timeline, state, hasAnyTranscript);
        }
    }
}
