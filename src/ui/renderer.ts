import { Timeline, AppState } from '../models/types.js';
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
const TYPE_CLASSES = ['type-lecture', 'type-demo', 'type-break'] as const;
let lastRenderedSegmentIndex = -1;
let lastRightPanelRenderKey = '';

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

function renderNotesMarkdown(markdown: string): string {
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

function hasSectionNotes(segment: Timeline['segments'][number], sectionIndex: number): boolean {
    const notes = segment.info?.[sectionIndex]?.transcript;
    return Array.isArray(notes) && notes.some(block => typeof block === 'string' && block.trim().length > 0);
}

function renderInfoPanel(segment: Timeline['segments'][number], hasNotes: boolean): void {
    elInfoPanel.innerHTML = '';
    elPanelRightHeader.innerHTML = '';

    const topRow = document.createElement('div');
    topRow.className = 'notes-top-row';
    const modeLabel = document.createElement('span');
    modeLabel.className = 'notes-mode-label';
    modeLabel.textContent = 'Outline View';
    topRow.appendChild(modeLabel);
    if (hasNotes) {
        const switchBtn = document.createElement('button');
        switchBtn.id = 'outline-view-transcript';
        switchBtn.className = 'outline-view-transcript-btn';
        switchBtn.type = 'button';
        switchBtn.setAttribute('aria-label', 'Switch to Transcript View');
        switchBtn.innerHTML = '<span>Transcript</span><span aria-hidden="true">&rarr;</span>';
        topRow.appendChild(switchBtn);
    }
    elPanelRightHeader.appendChild(topRow);

    if (!segment.info || segment.info.length === 0) {
        return;
    }

    for (let i = 0; i < segment.info.length; i++) {
        const section = segment.info[i];
        const sectionEl = document.createElement('div');
        const priority = i === 0 ? 'info-section-primary' : i === 1 ? 'info-section-secondary' : 'info-section-tertiary';
        sectionEl.className = `info-section ${priority}`;
        sectionEl.style.setProperty('--section-accent', getSectionColor(section.label));

        const sectionHasNotes = hasSectionNotes(segment, i);
        if (sectionHasNotes) {
            sectionEl.classList.add('info-section-notes-enabled');
            sectionEl.dataset.notesSectionIndex = String(i);
            sectionEl.setAttribute('role', 'button');
            sectionEl.setAttribute('tabindex', '0');
        }

        const labelRow = document.createElement('div');
        labelRow.className = 'info-label-row';

        const labelEl = document.createElement('h3');
        labelEl.className = 'info-label';
        labelEl.textContent = section.label;
        labelRow.appendChild(labelEl);

        if (sectionHasNotes) {
            const notesMarker = document.createElement('span');
            notesMarker.className = 'notes-marker';
            notesMarker.setAttribute('aria-hidden', 'true');
            notesMarker.textContent = 'T';
            labelRow.appendChild(notesMarker);
        }

        sectionEl.appendChild(labelRow);

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

interface NotesNavContext {
    hasPrev: boolean;
    hasNext: boolean;
}

function renderNotesNav(nav: NotesNavContext): string {
    return `
        <div class="notes-nav-row">
            <button id="notes-prev" class="notes-nav-btn" type="button" aria-label="Previous section"${nav.hasPrev ? '' : ' disabled'}>
                <span aria-hidden="true">&larr;</span>
                <span>Prev</span>
            </button>
            <button id="notes-next" class="notes-nav-btn" type="button" aria-label="Next section"${nav.hasNext ? '' : ' disabled'}>
                <span>Next</span>
                <span aria-hidden="true">&rarr;</span>
            </button>
        </div>
    `;
}

function renderNotesPanel(segmentTitle: string, notesTitle: string, notesBlocks: string[], nav: NotesNavContext): void {
    const safeSegmentTitle = escapeHtml(segmentTitle);
    const safeNotesTitle = escapeHtml(notesTitle);
    const renderedBlocks = notesBlocks
        .filter(block => typeof block === 'string' && block.trim().length > 0)
        .map(block => `<section class="notes-block">${renderNotesMarkdown(block.trim())}</section>`)
        .join('');

    elPanelRightHeader.innerHTML = `
        <div class="notes-top-row">
            <span class="notes-mode-label">Transcript View</span>
            <div class="notes-top-row-actions">
                <button id="notes-back" class="notes-back-btn" type="button" aria-label="Back to Outline View">
                    <span aria-hidden="true">&larr;</span>
                    <span>Outline</span>
                </button>
                ${renderNotesNav(nav)}
            </div>
        </div>
    `;
    elInfoPanel.innerHTML = `
        <div class="notes-view" aria-live="polite">
            <div class="notes-header">
                <p class="notes-kicker">Transcript</p>
                <h3>${safeSegmentTitle}</h3>
                <p class="notes-subtitle">${safeNotesTitle}</p>
            </div>
            <div class="notes-content">${renderedBlocks}</div>
        </div>
    `;
}

function renderNotesPanelItems(segmentTitle: string, sectionLabel: string, items: string[], accentColor: string, nav: NotesNavContext): void {
    const safeSegmentTitle = escapeHtml(segmentTitle);
    const safeSectionLabel = escapeHtml(sectionLabel);
    const listItems = items.map(item => `<li>${escapeHtml(item)}</li>`).join('');

    elPanelRightHeader.innerHTML = `
        <div class="notes-top-row">
            <span class="notes-mode-label">Transcript View</span>
            <div class="notes-top-row-actions">
                <button id="notes-back" class="notes-back-btn" type="button" aria-label="Back to Outline View">
                    <span aria-hidden="true">&larr;</span>
                    <span>Outline</span>
                </button>
                ${renderNotesNav(nav)}
            </div>
        </div>
    `;
    elInfoPanel.innerHTML = `
        <div class="notes-view" aria-live="polite">
            <div class="notes-header">
                <p class="notes-kicker">Segment Info</p>
                <h3>${safeSegmentTitle}</h3>
                <p class="notes-subtitle">${safeSectionLabel}</p>
            </div>
            <section class="notes-block" style="--section-accent: ${accentColor}; border-left: 4px solid ${accentColor}">
                <ul class="info-items">${listItems}</ul>
            </section>
        </div>
    `;
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

    // Right panel: info view or notes view
    const sectionWithNotesIndex = segment.info?.findIndex((_section, index) => hasSectionNotes(segment, index)) ?? -1;
    const hasSectionNotesAvailable = sectionWithNotesIndex >= 0;
    const hasSegmentNotes = typeof segment.transcript === 'string' && segment.transcript.trim().length > 0;
    const hasNotes = hasSectionNotesAvailable || hasSegmentNotes;
    elRightPanel?.classList.toggle('panel-notes-available', hasNotes || state.rightPanelMode === 'notes');
    elRightPanel?.classList.toggle('panel-notes-open', state.rightPanelMode === 'notes');

    const rightPanelRenderKey = [
        state.currentSegmentIndex,
        state.rightPanelMode,
        state.notesSectionIndex ?? -1,
        hasNotes ? 'has-notes' : 'no-notes',
    ].join('|');

    if (rightPanelRenderKey !== lastRightPanelRenderKey) {
        if (state.rightPanelMode === 'notes') {
            // Determine if prev/next notes exist anywhere in the timeline
            const currentSectionIndex = state.notesSectionIndex;
            let hasPrevNotes = false;
            let hasNextNotes = false;

            // Check for next section with notes in current segment
            if (currentSectionIndex !== undefined) {
                for (let i = currentSectionIndex + 1; i < (segment.info?.length ?? 0); i++) {
                    if (hasSectionNotes(segment, i)) { hasNextNotes = true; break; }
                }
            }
            if (!hasNextNotes) {
                for (let s = state.currentSegmentIndex + 1; s < timeline.segments.length; s++) {
                    const seg = timeline.segments[s];
                    const secNotes = seg.info?.some((_sec, idx) => hasSectionNotes(seg, idx)) ?? false;
                    const segNotes = typeof seg.transcript === 'string' && seg.transcript.trim().length > 0;
                    if (secNotes || segNotes) { hasNextNotes = true; break; }
                }
            }

            // Check for prev section with notes in current segment
            if (currentSectionIndex !== undefined) {
                for (let i = currentSectionIndex - 1; i >= 0; i--) {
                    if (hasSectionNotes(segment, i)) { hasPrevNotes = true; break; }
                }
            }
            if (!hasPrevNotes) {
                for (let s = state.currentSegmentIndex - 1; s >= 0; s--) {
                    const seg = timeline.segments[s];
                    const secNotes = seg.info?.some((_sec, idx) => hasSectionNotes(seg, idx)) ?? false;
                    const segNotes = typeof seg.transcript === 'string' && seg.transcript.trim().length > 0;
                    if (secNotes || segNotes) { hasPrevNotes = true; break; }
                }
            }

            const nav: NotesNavContext = { hasPrev: hasPrevNotes, hasNext: hasNextNotes };

            const selectedIndex = state.notesSectionIndex;
            const selectedSection = selectedIndex !== undefined ? segment.info?.[selectedIndex] : undefined;

            if (selectedSection) {
                const sectionNotes = selectedSection.transcript?.filter(block => block.trim().length > 0) ?? [];
                if (sectionNotes.length > 0) {
                    renderNotesPanel(segment.title, selectedSection.label, sectionNotes, nav);
                } else {
                    renderNotesPanel(segment.title, segment.title, ['No notes available for this section.'], nav);
                }
            } else if (hasSegmentNotes) {
                renderNotesPanel(segment.title, 'General', [segment.transcript!.trim()], nav);
            } else if (hasSectionNotesAvailable) {
                const fallbackSection = segment.info![sectionWithNotesIndex];
                const fallbackNotes = fallbackSection.transcript!.filter(block => block.trim().length > 0);
                renderNotesPanel(segment.title, fallbackSection.label, fallbackNotes, nav);
            } else {
                renderNotesPanel(segment.title, segment.title, ['No notes available for this segment.'], nav);
            }
        } else {
            renderInfoPanel(segment, hasNotes);
        }

        lastRightPanelRenderKey = rightPanelRenderKey;
    }
}
