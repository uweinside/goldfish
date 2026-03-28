import { loadCourse } from './core/data-loader.js';
import { InfoSection, Segment, Timeline } from './models/types.js';

interface EditorViewState {
    selectedSegmentIndex: number;
    timeline: Timeline | null;
}

const elCourseTitle = document.getElementById('editor-course-title') as HTMLElement | null;
const elTotalSegments = document.getElementById('editor-total-segments') as HTMLElement | null;
const elTotalDuration = document.getElementById('editor-total-duration') as HTMLElement | null;
const elSegmentList = document.getElementById('editor-segment-list') as HTMLElement | null;
const elInspector = document.getElementById('editor-inspector-content') as HTMLElement | null;
const elRunLink = document.getElementById('editor-run-link') as HTMLAnchorElement | null;
const elEditorContent = document.querySelector('.editor-content') as HTMLElement | null;
const elEditorDivider = document.getElementById('editor-divider') as HTMLElement | null;

const state: EditorViewState = {
    selectedSegmentIndex: 0,
    timeline: null,
};

const SEGMENT_TYPES: Array<NonNullable<Segment['type']>> = ['lecture', 'demo', 'break'];
const MIN_EDITOR_LEFT_PERCENT = 28;
const MAX_EDITOR_LEFT_PERCENT = 72;
const DEFAULT_EDITOR_LEFT_PERCENT = 36;
let editorLeftPercent = DEFAULT_EDITOR_LEFT_PERCENT;

function getCourseId(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('course');
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    return `${remainingSeconds}s`;
}

function totalDuration(timeline: Timeline): number {
    return timeline.segments.reduce((sum, segment) => sum + segment.duration, 0);
}

function parseLineList(value: string): string[] {
    return value
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

function toLineList(value: string[] | undefined): string {
    return (value ?? []).join('\n');
}

function getSelectedSegment(): Segment | null {
    const timeline = state.timeline;
    if (!timeline) {
        return null;
    }
    return timeline.segments[state.selectedSegmentIndex] ?? null;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function setEditorSplit(leftPercent: number): void {
    if (!elEditorContent) {
        return;
    }

    editorLeftPercent = clamp(leftPercent, MIN_EDITOR_LEFT_PERCENT, MAX_EDITOR_LEFT_PERCENT);

    if (window.innerWidth <= 980) {
        elEditorContent.style.removeProperty('grid-template-columns');
    } else {
        elEditorContent.style.gridTemplateColumns = `minmax(260px, ${editorLeftPercent}%) 10px minmax(360px, ${100 - editorLeftPercent}%)`;
    }

    if (elEditorDivider) {
        elEditorDivider.setAttribute('aria-valuenow', String(Math.round(editorLeftPercent)));
    }
}

function setupEditorDivider(): void {
    if (!elEditorDivider || !elEditorContent) {
        return;
    }

    let isDragging = false;
    let activePointerId: number | null = null;

    const updateFromClientX = (clientX: number): void => {
        const rect = elEditorContent.getBoundingClientRect();
        if (rect.width <= 0) {
            return;
        }
        const left = clientX - rect.left;
        const percent = (left / rect.width) * 100;
        setEditorSplit(percent);
    };

    const stopDrag = (): void => {
        if (!isDragging) {
            return;
        }
        isDragging = false;
        activePointerId = null;
        document.body.classList.remove('editor-resizing');
    };

    elEditorDivider.addEventListener('pointerdown', event => {
        if (window.innerWidth <= 980) {
            return;
        }

        isDragging = true;
        activePointerId = event.pointerId;
        elEditorDivider.setPointerCapture(event.pointerId);
        document.body.classList.add('editor-resizing');
        updateFromClientX(event.clientX);
        event.preventDefault();
    });

    elEditorDivider.addEventListener('pointermove', event => {
        if (!isDragging || activePointerId !== event.pointerId) {
            return;
        }
        updateFromClientX(event.clientX);
    });

    elEditorDivider.addEventListener('pointerup', event => {
        if (activePointerId === event.pointerId) {
            stopDrag();
        }
    });

    elEditorDivider.addEventListener('pointercancel', event => {
        if (activePointerId === event.pointerId) {
            stopDrag();
        }
    });

    elEditorDivider.addEventListener('lostpointercapture', stopDrag);

    elEditorDivider.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            setEditorSplit(editorLeftPercent - 2);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            setEditorSplit(editorLeftPercent + 2);
        } else if (event.key === 'Home') {
            event.preventDefault();
            setEditorSplit(MIN_EDITOR_LEFT_PERCENT);
        } else if (event.key === 'End') {
            event.preventDefault();
            setEditorSplit(MAX_EDITOR_LEFT_PERCENT);
        }
    });

    window.addEventListener('resize', () => {
        setEditorSplit(editorLeftPercent);
    });

    setEditorSplit(DEFAULT_EDITOR_LEFT_PERCENT);
}

function renderSegmentList(timeline: Timeline): void {
    if (!elSegmentList) return;

    elSegmentList.innerHTML = '';

    timeline.segments.forEach((segment, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `editor-segment-card${index === state.selectedSegmentIndex ? ' selected' : ''}`;
        button.dataset.segmentIndex = String(index);
        button.innerHTML = `
            <span class="editor-segment-handle" aria-hidden="true">::</span>
            <span class="editor-segment-title">${escapeHtml(segment.title)}</span>
            <span class="editor-segment-duration">${formatDuration(segment.duration)}</span>
            <span class="editor-segment-type">${escapeHtml(segment.type ?? 'lecture')}</span>
        `;

        button.addEventListener('click', () => {
            state.selectedSegmentIndex = index;
            render(timeline);
        });

        elSegmentList.appendChild(button);
    });
}

function renderInspector(timeline: Timeline): void {
    if (!elInspector) return;

    const selected = timeline.segments[state.selectedSegmentIndex];
    const infoCount = selected.info?.length ?? 0;
    const transcriptCount = selected.info?.reduce((sum, section) => {
        const count = section.transcript?.filter(block => block.trim().length > 0).length ?? 0;
        return sum + count;
    }, 0) ?? 0;
    const segmentTranscriptCount = selected.transcript?.trim().length ? 1 : 0;
    const infoSections = selected.info ?? [];
    const infoMarkup = infoSections.length === 0
        ? '<p class="editor-empty-state">No info blocks yet. Add one to define prompts, talking points, or demos.</p>'
        : infoSections
            .map((section, index) => `
                <div class="editor-info-section" data-info-index="${index}">
                    <div class="editor-info-section-header">
                        <strong>Info Block ${index + 1}</strong>
                        <button type="button" class="editor-btn editor-btn-danger" data-action="remove-info-block" data-info-index="${index}">Remove</button>
                    </div>
                    <div class="editor-field">
                        <label for="info-label-${index}">Label</label>
                        <input id="info-label-${index}" data-field="info-label" data-info-index="${index}" type="text" value="${escapeHtml(section.label)}" />
                    </div>
                    <div class="editor-field">
                        <label for="info-items-${index}">Items, one per line</label>
                        <textarea id="info-items-${index}" data-field="info-items" data-info-index="${index}" rows="4">${escapeHtml(toLineList(section.items))}</textarea>
                    </div>
                    <div class="editor-field">
                        <label for="info-transcript-${index}">Transcript lines, one per line</label>
                        <textarea id="info-transcript-${index}" data-field="info-transcript" data-info-index="${index}" rows="4">${escapeHtml(toLineList(section.transcript))}</textarea>
                    </div>
                </div>
            `)
            .join('');

    elInspector.innerHTML = `
        <div class="editor-field">
            <label>Title</label>
            <input data-field="title" type="text" value="${escapeHtml(selected.title)}" />
        </div>
        <div class="editor-field-row">
            <div class="editor-field">
                <label>Type</label>
                <select data-field="type">
                    ${SEGMENT_TYPES.map(type => `<option value="${type}"${(selected.type ?? 'lecture') === type ? ' selected' : ''}>${type}</option>`).join('')}
                </select>
            </div>
            <div class="editor-field">
                <label>Duration (seconds)</label>
                <input data-field="duration" type="number" min="1" step="15" value="${selected.duration}" />
            </div>
        </div>
        <div class="editor-field">
            <label>Segment Transcript</label>
            <textarea data-field="segment-transcript" rows="4" placeholder="Optional notes for the entire segment">${escapeHtml(selected.transcript ?? '')}</textarea>
        </div>
        <div class="editor-field">
            <label>Info Sections</label>
            <div class="editor-subheader-row">
                <div class="editor-readonly-box">${infoCount} section${infoCount === 1 ? '' : 's'}</div>
                <button type="button" class="editor-btn" data-action="add-info-block">Add Info Block</button>
            </div>
            <div class="editor-info-list">
                ${infoMarkup}
            </div>
        </div>
        <div class="editor-field">
            <label>Transcript Blocks</label>
            <div class="editor-readonly-box">${transcriptCount + segmentTranscriptCount} block${transcriptCount + segmentTranscriptCount === 1 ? '' : 's'}</div>
        </div>
        <div class="editor-field">
            <label>Validation</label>
            <ul class="editor-validation-list">
                <li>${selected.title.trim().length > 0 ? 'OK' : 'Missing title'}</li>
                <li>${selected.duration > 0 ? 'OK' : 'Duration must be greater than 0'}</li>
            </ul>
        </div>
    `;
}

function render(timeline: Timeline): void {
    if (elCourseTitle) {
        elCourseTitle.textContent = timeline.title ?? 'Untitled Course';
    }
    if (elTotalSegments) {
        elTotalSegments.textContent = `${timeline.segments.length} segment${timeline.segments.length === 1 ? '' : 's'}`;
    }
    if (elTotalDuration) {
        elTotalDuration.textContent = formatDuration(totalDuration(timeline));
    }

    renderSegmentList(timeline);
    renderInspector(timeline);
}

function handleInspectorInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
        return;
    }

    const selected = getSelectedSegment();
    const timeline = state.timeline;
    if (!selected || !timeline) {
        return;
    }

    const field = target.dataset.field;
    const infoIndexRaw = target.dataset.infoIndex;
    const infoIndex = infoIndexRaw !== undefined ? Number(infoIndexRaw) : -1;

    if (field === 'title') {
        selected.title = target.value;
    } else if (field === 'type' && target instanceof HTMLSelectElement) {
        if (SEGMENT_TYPES.includes(target.value as NonNullable<Segment['type']>)) {
            selected.type = target.value as NonNullable<Segment['type']>;
        }
    } else if (field === 'duration' && target instanceof HTMLInputElement) {
        const duration = Number.parseInt(target.value, 10);
        if (!Number.isNaN(duration) && duration > 0) {
            selected.duration = duration;
        }
    } else if (field === 'segment-transcript' && target instanceof HTMLTextAreaElement) {
        selected.transcript = target.value;
    } else if (field === 'info-label' && target instanceof HTMLInputElement && infoIndex >= 0) {
        const section = selected.info?.[infoIndex];
        if (section) {
            section.label = target.value;
        }
    } else if (field === 'info-items' && target instanceof HTMLTextAreaElement && infoIndex >= 0) {
        const section = selected.info?.[infoIndex];
        if (section) {
            section.items = parseLineList(target.value);
        }
    } else if (field === 'info-transcript' && target instanceof HTMLTextAreaElement && infoIndex >= 0) {
        const section = selected.info?.[infoIndex];
        if (section) {
            section.transcript = parseLineList(target.value);
        }
    }

    if (elCourseTitle) {
        elCourseTitle.textContent = timeline.title ?? 'Untitled Course';
    }
    if (elTotalDuration) {
        elTotalDuration.textContent = formatDuration(totalDuration(timeline));
    }
    renderSegmentList(timeline);
}

function addInfoBlock(): void {
    const selected = getSelectedSegment();
    if (!selected) {
        return;
    }
    if (!selected.info) {
        selected.info = [];
    }

    const nextBlock: InfoSection = {
        label: 'New Info Block',
        items: [],
        transcript: [],
    };
    selected.info.push(nextBlock);
}

function removeInfoBlock(index: number): void {
    const selected = getSelectedSegment();
    if (!selected?.info || index < 0 || index >= selected.info.length) {
        return;
    }
    selected.info.splice(index, 1);
}

function handleInspectorClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
        return;
    }

    const button = target.closest('[data-action]') as HTMLButtonElement | null;
    if (!button) {
        return;
    }

    const action = button.dataset.action;
    if (action === 'add-info-block') {
        addInfoBlock();
    } else if (action === 'remove-info-block') {
        const rawIndex = button.dataset.infoIndex;
        const index = rawIndex ? Number(rawIndex) : -1;
        removeInfoBlock(index);
    }

    if (state.timeline) {
        render(state.timeline);
    }
}

async function init(): Promise<void> {
    const courseId = getCourseId();
    if (!courseId) {
        window.location.href = '/';
        return;
    }

    if (elRunLink) {
        elRunLink.href = `timer.html?course=${encodeURIComponent(courseId)}`;
    }

    let timeline: Timeline;
    try {
        timeline = await loadCourse(courseId);
    } catch {
        window.location.href = '/';
        return;
    }

    if (timeline.segments.length === 0) {
        timeline.segments = [{ title: 'Untitled Segment', duration: 300, type: 'lecture', info: [] }];
    }

    state.timeline = timeline;

    setupEditorDivider();

    elInspector?.addEventListener('input', handleInspectorInput);
    elInspector?.addEventListener('click', handleInspectorClick);

    render(timeline);

    document.addEventListener('keydown', (event) => {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            state.selectedSegmentIndex = Math.min(state.selectedSegmentIndex + 1, timeline.segments.length - 1);
            render(timeline);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            state.selectedSegmentIndex = Math.max(state.selectedSegmentIndex - 1, 0);
            render(timeline);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});
