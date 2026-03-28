import { loadCourse } from './core/data-loader.js';
import { InfoSection, Segment, Timeline } from './models/types.js';

interface EditorViewState {
    selectedSegmentIndex: number;
    selectedInfoSectionIndex: number | null;
    timeline: Timeline | null;
}

const elCourseTitle = document.getElementById('editor-course-title') as HTMLElement | null;
const elTotalSegments = document.getElementById('editor-total-segments') as HTMLElement | null;
const elTotalDuration = document.getElementById('editor-total-duration') as HTMLElement | null;
const elSegmentList = document.getElementById('editor-segment-list') as HTMLElement | null;
const elInfoSectionsList = document.getElementById('editor-info-sections') as HTMLElement | null;
const elInfoEditor = document.getElementById('editor-info-editor-content') as HTMLElement | null;
const elRunLink = document.getElementById('editor-run-link') as HTMLAnchorElement | null;
const elEditorContent = document.querySelector('.editor-content') as HTMLElement | null;
const elDivider1 = document.getElementById('editor-divider-1') as HTMLElement | null;
const elDivider2 = document.getElementById('editor-divider-2') as HTMLElement | null;
const elAddInfoBtn = document.getElementById('editor-add-info-btn') as HTMLButtonElement | null;

const state: EditorViewState = {
    selectedSegmentIndex: 0,
    selectedInfoSectionIndex: null,
    timeline: null,
};

let dragState: { sourceIndex: number; isDragging: boolean; dragType: 'segment' | 'info' } = {
    sourceIndex: -1,
    isDragging: false,
    dragType: 'segment',
};

const SEGMENT_TYPES: Array<NonNullable<Segment['type']>> = ['lecture', 'demo', 'break'];
const SECTION_TYPE_OPTIONS = ['Narration', 'Demo', 'Prompt', 'Rule'];
const DEFAULT_EDITOR_SPLITS = { split1: 33, split2: 33 };
let editorSplits = { ...DEFAULT_EDITOR_SPLITS };

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

function formatMinutesSeconds(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function totalDuration(timeline: Timeline): number {
    return timeline.segments.reduce((sum, segment) => sum + segment.duration, 0);
}

function parseMarkdownLines(value: string): string[] {
    const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalized.length === 0 ? [] : normalized.split('\n');
}

function toLineList(value: string[] | undefined): string {
    return (value ?? []).join('\n');
}

function openMarkdownEditor(field: 'info-items' | 'info-transcript', infoIndex: number): void {
    const selected = getSelectedSegment();
    if (!selected) {
        return;
    }

    const section = selected.info?.[infoIndex];
    if (!section) {
        return;
    }

    const heading = field === 'info-items' ? 'Edit Instructions (Markdown)' : 'Edit Transcript (Markdown)';
    const value = field === 'info-items' ? toLineList(section.items) : toLineList(section.transcript);

    const overlay = document.createElement('div');
    overlay.className = 'editor-markdown-overlay';
    overlay.innerHTML = `
        <div class="editor-markdown-dialog" role="dialog" aria-modal="true" aria-label="${heading}">
            <div class="editor-markdown-header">
                <h3>${heading}</h3>
                <button type="button" class="editor-btn" data-action="close-markdown">Close</button>
            </div>
            <textarea class="editor-markdown-textarea">${escapeHtml(value)}</textarea>
            <div class="editor-markdown-actions">
                <button type="button" class="editor-btn" data-action="cancel-markdown">Cancel</button>
                <button type="button" class="editor-btn editor-btn-primary" data-action="apply-markdown">Apply</button>
            </div>
        </div>
    `;

    const textarea = overlay.querySelector('.editor-markdown-textarea') as HTMLTextAreaElement | null;
    const closeBtn = overlay.querySelector('[data-action="close-markdown"]') as HTMLButtonElement | null;
    const cancelBtn = overlay.querySelector('[data-action="cancel-markdown"]') as HTMLButtonElement | null;
    const applyBtn = overlay.querySelector('[data-action="apply-markdown"]') as HTMLButtonElement | null;

    const close = (): void => {
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
    };

    const apply = (): void => {
        if (!textarea) {
            close();
            return;
        }

        if (field === 'info-items') {
            section.items = parseMarkdownLines(textarea.value);
        } else {
            section.transcript = parseMarkdownLines(textarea.value);
        }

        saveCourse();
        if (state.timeline) {
            render(state.timeline);
        }
        close();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    applyBtn?.addEventListener('click', apply);
    overlay.addEventListener('click', event => {
        if (event.target === overlay) {
            close();
        }
    });

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);

    if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
}

function getSectionUiType(section: InfoSection): string {
    const explicitType = (section as InfoSection & { type?: string }).type;
    if (explicitType && SECTION_TYPE_OPTIONS.includes(explicitType)) {
        return explicitType;
    }

    const label = section.label.trim().toLowerCase();
    if (label.includes('demo')) {
        return 'Demo';
    }
    if (label.includes('prompt') || label.includes('question')) {
        return 'Prompt';
    }
    if (label.includes('rule')) {
        return 'Rule';
    }
    return 'Narration';
}

function getSelectedSegment(): Segment | null {
    const timeline = state.timeline;
    if (!timeline) {
        return null;
    }
    return timeline.segments[state.selectedSegmentIndex] ?? null;
}

function setSelectedInfoSection(index: number | null): void {
    state.selectedInfoSectionIndex = index;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function setEditorSplits(split1: number, split2: number): void {
    if (!elEditorContent) {
        return;
    }

    split1 = clamp(split1, 20, 50);
    split2 = clamp(split2, 20, 50);

    // Ensure total doesn't exceed reasonable bounds
    if (split1 + split2 > 80) {
        split2 = 80 - split1;
    }

    editorSplits = { split1, split2 };
    const split3 = Math.max(20, 100 - split1 - split2 - 0.4);

    if (window.innerWidth <= 980) {
        elEditorContent.style.removeProperty('grid-template-columns');
    } else {
        elEditorContent.style.gridTemplateColumns = 
            `minmax(260px, ${split1}fr) 2px minmax(260px, ${split2}fr) 2px minmax(260px, ${split3}fr)`;
    }

    if (elDivider1) {
        elDivider1.setAttribute('aria-valuenow', String(Math.round(split1)));
    }
    if (elDivider2) {
        elDivider2.setAttribute('aria-valuenow', String(Math.round(split2)));
    }
}

function setupEditorDividers(): void {
    if (!elDivider1 || !elDivider2 || !elEditorContent) {
        return;
    }

    type DividerType = 'divider1' | 'divider2';
    let isDragging = false;
    let activeDivider: DividerType | null = null;
    let activePointerId: number | null = null;

    const updateFromClientX = (clientX: number, divider: DividerType): void => {
        const rect = elEditorContent.getBoundingClientRect();
        if (rect.width <= 0) {
            return;
        }

        if (divider === 'divider1') {
            const left = clientX - rect.left;
            const percent = (left / rect.width) * 100;
            setEditorSplits(percent, editorSplits.split2);
        } else {
            // For divider2, we need to account for divider1's position
            const left = clientX - rect.left;
            const leftAfterDiv1 = left - (editorSplits.split1 + 0.2); // Account for divider 1 width
            const remainingWidth = rect.width - (editorSplits.split1 + 0.2);
            const percent = remainingWidth > 0 ? (leftAfterDiv1 / remainingWidth) * 100 : 0;
            setEditorSplits(editorSplits.split1, percent);
        }
    };

    const stopDrag = (): void => {
        if (!isDragging) {
            return;
        }
        isDragging = false;
        activeDivider = null;
        activePointerId = null;
        document.body.classList.remove('editor-resizing');
    };

    const makePointerDown = (divider: DividerType) => (event: PointerEvent) => {
        if (window.innerWidth <= 980) {
            return;
        }

        isDragging = true;
        activeDivider = divider;
        activePointerId = event.pointerId;
        const el = divider === 'divider1' ? elDivider1 : elDivider2;
        el?.setPointerCapture(event.pointerId);
        document.body.classList.add('editor-resizing');
        updateFromClientX(event.clientX, divider);
        event.preventDefault();
    };

    const makePointerMove = (divider: DividerType) => (event: PointerEvent) => {
        if (!isDragging || activeDivider !== divider || activePointerId !== event.pointerId) {
            return;
        }
        updateFromClientX(event.clientX, divider);
    };

    const makePointerUp = (divider: DividerType) => (event: PointerEvent) => {
        if (activeDivider === divider && activePointerId === event.pointerId) {
            stopDrag();
        }
    };

    const makeKeyDown = (divider: DividerType) => (event: KeyboardEvent) => {
        if (event.target !== (divider === 'divider1' ? elDivider1 : elDivider2)) {
            return;
        }

        if (divider === 'divider1') {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setEditorSplits(editorSplits.split1 - 2, editorSplits.split2);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                setEditorSplits(editorSplits.split1 + 2, editorSplits.split2);
            } else if (event.key === 'Home') {
                event.preventDefault();
                setEditorSplits(20, editorSplits.split2);
            } else if (event.key === 'End') {
                event.preventDefault();
                setEditorSplits(50, editorSplits.split2);
            }
        } else if (divider === 'divider2') {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setEditorSplits(editorSplits.split1, editorSplits.split2 - 2);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                setEditorSplits(editorSplits.split1, editorSplits.split2 + 2);
            } else if (event.key === 'Home') {
                event.preventDefault();
                setEditorSplits(editorSplits.split1, 20);
            } else if (event.key === 'End') {
                event.preventDefault();
                setEditorSplits(editorSplits.split1, 50);
            }
        }
    };

    elDivider1.addEventListener('pointerdown', makePointerDown('divider1'));
    elDivider1.addEventListener('pointermove', makePointerMove('divider1'));
    elDivider1.addEventListener('pointerup', makePointerUp('divider1'));
    elDivider1.addEventListener('pointercancel', makePointerUp('divider1'));
    elDivider1.addEventListener('lostpointercapture', stopDrag);
    elDivider1.addEventListener('keydown', makeKeyDown('divider1'));

    elDivider2.addEventListener('pointerdown', makePointerDown('divider2'));
    elDivider2.addEventListener('pointermove', makePointerMove('divider2'));
    elDivider2.addEventListener('pointerup', makePointerUp('divider2'));
    elDivider2.addEventListener('pointercancel', makePointerUp('divider2'));
    elDivider2.addEventListener('lostpointercapture', stopDrag);
    elDivider2.addEventListener('keydown', makeKeyDown('divider2'));

    window.addEventListener('resize', () => {
        setEditorSplits(editorSplits.split1, editorSplits.split2);
    });

    setEditorSplits(DEFAULT_EDITOR_SPLITS.split1, DEFAULT_EDITOR_SPLITS.split2);
}

function renderTimeline(timeline: Timeline): void {
    if (!elSegmentList) return;

    elSegmentList.innerHTML = '';

    timeline.segments.forEach((segment, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `editor-segment-card${index === state.selectedSegmentIndex ? ' selected' : ''}`;
        button.dataset.segmentIndex = String(index);
        button.draggable = true;
        button.innerHTML = `
            <span class="editor-segment-handle" aria-hidden="true">::</span>
            <span class="editor-segment-title">${escapeHtml(segment.title)}</span>
            <span class="editor-segment-duration">${formatMinutesSeconds(segment.duration)}</span>
        `;

        button.addEventListener('click', () => {
            state.selectedSegmentIndex = index;
            state.selectedInfoSectionIndex = null;
            render(timeline);
        });

        // Drag/drop handlers for segments
        button.addEventListener('dragstart', (e) => {
            dragState = { sourceIndex: index, isDragging: true, dragType: 'segment' };
            button.classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        button.addEventListener('dragend', () => {
            button.classList.remove('dragging');
            dragState = { sourceIndex: -1, isDragging: false, dragType: 'segment' };
        });

        button.addEventListener('dragover', (e) => {
            if (dragState.dragType !== 'segment' || dragState.sourceIndex === index) {
                return;
            }
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
            button.classList.add('drag-over');
        });

        button.addEventListener('dragleave', () => {
            button.classList.remove('drag-over');
        });

        button.addEventListener('drop', (e) => {
            e.preventDefault();
            button.classList.remove('drag-over');
            if (dragState.dragType === 'segment' && dragState.sourceIndex >= 0 && dragState.sourceIndex !== index) {
                // Swap segments
                const [removed] = timeline.segments.splice(dragState.sourceIndex, 1);
                const targetIndex = dragState.sourceIndex < index ? index - 1 : index;
                timeline.segments.splice(targetIndex, 0, removed);
                
                if (state.selectedSegmentIndex === dragState.sourceIndex) {
                    state.selectedSegmentIndex = targetIndex;
                }
                state.selectedInfoSectionIndex = null;
                saveCourse();
                render(timeline);
            }
        });

        const row = document.createElement('div');
        row.className = 'editor-card-row';
        row.appendChild(button);

        if (index === state.selectedSegmentIndex && timeline.segments.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'editor-card-delete';
            deleteBtn.title = 'Delete segment';
            deleteBtn.setAttribute('aria-label', `Delete segment: ${segment.title}`);
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', () => removeSegment(index, timeline));
            row.appendChild(deleteBtn);
        }

        elSegmentList.appendChild(row);
    });
}

function renderInfoList(timeline: Timeline): void {
    if (!elInfoSectionsList) return;

    const selected = timeline.segments[state.selectedSegmentIndex];
    if (!selected) {
        elInfoSectionsList.innerHTML = '<div class="editor-info-editor-empty">No segment selected</div>';
        return;
    }

    const infoSections = selected.info ?? [];
    if (infoSections.length === 0) {
        elInfoSectionsList.innerHTML = '<div class="editor-info-editor-empty">No info sections yet. Add one to define prompts or talking points.</div>';
        return;
    }

    elInfoSectionsList.innerHTML = '';
    const sectionDurationSeconds = infoSections.length > 0
        ? Math.round(selected.duration / infoSections.length)
        : 0;

    infoSections.forEach((section, index) => {
        const sectionType = getSectionUiType(section);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `editor-info-card${index === state.selectedInfoSectionIndex ? ' selected' : ''}`;
        card.dataset.infoIndex = String(index);
        card.draggable = true;
        card.innerHTML = `
            <span class="editor-info-handle" aria-hidden="true">::</span>
            <span class="editor-info-card-label">${escapeHtml(section.label)}</span>
            <span class="editor-info-card-type">${escapeHtml(sectionType)}</span>
            <span class="editor-info-card-count">${formatMinutesSeconds(sectionDurationSeconds)}</span>
        `;

        card.addEventListener('click', () => {
            state.selectedInfoSectionIndex = index;
            render(timeline);
        });

        // Drag/drop handlers for info sections
        card.addEventListener('dragstart', (e) => {
            dragState = { sourceIndex: index, isDragging: true, dragType: 'info' };
            card.classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            dragState = { sourceIndex: -1, isDragging: false, dragType: 'info' };
        });

        card.addEventListener('dragover', (e) => {
            if (dragState.dragType !== 'info' || dragState.sourceIndex === index) {
                return;
            }
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
            card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            if (dragState.dragType === 'info' && dragState.sourceIndex >= 0 && dragState.sourceIndex !== index && selected.info) {
                // Swap info sections
                const [removed] = selected.info.splice(dragState.sourceIndex, 1);
                const targetIndex = dragState.sourceIndex < index ? index - 1 : index;
                selected.info.splice(targetIndex, 0, removed);
                
                if (state.selectedInfoSectionIndex === dragState.sourceIndex) {
                    state.selectedInfoSectionIndex = targetIndex;
                }
                saveCourse();
                render(timeline);
            }
        });

        const row = document.createElement('div');
        row.className = 'editor-card-row';
        row.appendChild(card);

        if (index === state.selectedInfoSectionIndex) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'editor-card-delete';
            deleteBtn.title = 'Remove info section';
            deleteBtn.setAttribute('aria-label', `Remove info section: ${section.label}`);
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', () => {
                removeInfoBlock(index);
                if (state.timeline) render(state.timeline);
            });
            row.appendChild(deleteBtn);
        }

        elInfoSectionsList.appendChild(row);
    });
}

function renderInfoEditor(timeline: Timeline): void {
    if (!elInfoEditor) return;

    const selected = timeline.segments[state.selectedSegmentIndex];
    if (!selected) {
        elInfoEditor.innerHTML = '<div class="editor-info-editor-empty">Select a segment to edit its info sections.</div>';
        return;
    }

    const infoSections = selected.info ?? [];
    const selectedInfo = state.selectedInfoSectionIndex !== null ? infoSections[state.selectedInfoSectionIndex] : null;

    if (!selectedInfo) {
        elInfoEditor.innerHTML = '<div class="editor-info-editor-empty">Select an info section to edit it.</div>';
        return;
    }

    const index = state.selectedInfoSectionIndex!;
    const sectionType = getSectionUiType(selectedInfo);
    const durationMinutes = Math.floor(selected.duration / 60);
    const durationSeconds = selected.duration % 60;
    elInfoEditor.innerHTML = `
        <div class="editor-info-editor-form">
            <div class="editor-info-editor-panel">
                <div class="editor-field-row editor-segment-meta-row">
                    <div class="editor-field">
                        <label for="info-type-${index}">Type</label>
                        <select id="info-type-${index}" data-field="info-type">
                            ${SECTION_TYPE_OPTIONS.map(type => `<option value="${type}"${type === sectionType ? ' selected' : ''}>${type}</option>`).join('')}
                        </select>
                    </div>
                    <div class="editor-field editor-duration-part">
                        <label for="duration-minutes">Minutes</label>
                        <input id="duration-minutes" data-field="duration-minutes" type="number" min="0" step="1" value="${durationMinutes}" />
                    </div>
                    <div class="editor-field editor-duration-part">
                        <label for="duration-seconds">Seconds</label>
                        <input id="duration-seconds" data-field="duration-seconds" type="number" min="0" max="59" step="1" value="${durationSeconds}" />
                    </div>
                </div>
                <div class="editor-field">
                    <label for="info-label-${index}">Label</label>
                    <input id="info-label-${index}" data-field="info-label" data-info-index="${index}" type="text" value="${escapeHtml(selectedInfo.label)}" />
                </div>
                <div class="editor-field">
                    <div class="editor-field-header">
                        <label for="info-items-${index}">Instructions</label>
                        <button type="button" class="editor-expand-btn" data-action="expand-markdown" data-field="info-items" data-info-index="${index}">Expand</button>
                    </div>
                    <textarea id="info-items-${index}" data-field="info-items" data-info-index="${index}" rows="6">${escapeHtml(toLineList(selectedInfo.items))}</textarea>
                </div>
                <div class="editor-field">
                    <div class="editor-field-header">
                        <label for="info-transcript-${index}">Transcript</label>
                        <button type="button" class="editor-expand-btn" data-action="expand-markdown" data-field="info-transcript" data-info-index="${index}">Expand</button>
                    </div>
                    <textarea id="info-transcript-${index}" data-field="info-transcript" data-info-index="${index}" rows="6">${escapeHtml(toLineList(selectedInfo.transcript))}</textarea>
                </div>
            </div>
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

    renderTimeline(timeline);
    renderInfoList(timeline);
    renderInfoEditor(timeline);

    if (elAddInfoBtn) {
        elAddInfoBtn.disabled = state.selectedSegmentIndex < 0;
    }
}

function handleEditorInput(event: Event): void {
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

    if (field === 'info-type' && target instanceof HTMLSelectElement && infoIndex >= 0) {
        const section = selected.info?.[infoIndex];
        if (section && SECTION_TYPE_OPTIONS.includes(target.value)) {
            (section as InfoSection & { type?: string }).type = target.value;
            saveCourse();
            renderInfoList(timeline);
        }
    } else if ((field === 'duration-minutes' || field === 'duration-seconds') && target instanceof HTMLInputElement) {
        const minutesInput = elInfoEditor?.querySelector('input[data-field="duration-minutes"]') as HTMLInputElement | null;
        const secondsInput = elInfoEditor?.querySelector('input[data-field="duration-seconds"]') as HTMLInputElement | null;

        if (minutesInput && secondsInput) {
            const minutesRaw = Number.parseInt(minutesInput.value, 10);
            const secondsRaw = Number.parseInt(secondsInput.value, 10);

            if (!Number.isNaN(minutesRaw) && !Number.isNaN(secondsRaw)) {
                const minutes = Math.max(0, minutesRaw);
                const seconds = Math.min(59, Math.max(0, secondsRaw));

                if (seconds !== secondsRaw) {
                    secondsInput.value = String(seconds);
                }

                const duration = minutes * 60 + seconds;
                if (duration > 0) {
                    selected.duration = duration;
                    if (elTotalDuration) {
                        elTotalDuration.textContent = formatDuration(totalDuration(timeline));
                    }
                    saveCourse();
                }
            }
        }
    } else if (field === 'info-label' && infoIndex >= 0) {
        const section = selected.info?.[infoIndex];
        if (section) {
            section.label = target.value;
            saveCourse();
        }
    } else if (field === 'info-items' && infoIndex >= 0) {
        const section = selected.info?.[infoIndex];
        if (section) {
            section.items = parseMarkdownLines(target.value);
            saveCourse();
        }
    } else if (field === 'info-transcript' && infoIndex >= 0) {
        const section = selected.info?.[infoIndex];
        if (section) {
            section.transcript = parseMarkdownLines(target.value);
            saveCourse();
        }
    }
}

function removeSegment(index: number, timeline: Timeline): void {
    if (timeline.segments.length <= 1) return;
    timeline.segments.splice(index, 1);
    state.selectedSegmentIndex = Math.min(state.selectedSegmentIndex, timeline.segments.length - 1);
    state.selectedInfoSectionIndex = null;
    saveCourse();
    render(timeline);
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
        label: 'New Info Section',
        items: [],
        transcript: [],
    };
    selected.info.push(nextBlock);
    state.selectedInfoSectionIndex = selected.info.length - 1;
    saveCourse();
}

function removeInfoBlock(index: number): void {
    const selected = getSelectedSegment();
    if (!selected?.info || index < 0 || index >= selected.info.length) {
        return;
    }
    selected.info.splice(index, 1);
    
    if (state.selectedInfoSectionIndex === index) {
        state.selectedInfoSectionIndex = selected.info.length > 0 ? Math.min(index, selected.info.length - 1) : null;
    } else if (state.selectedInfoSectionIndex !== null && state.selectedInfoSectionIndex > index) {
        state.selectedInfoSectionIndex -= 1;
    }
    
    saveCourse();
}

function handleEditorClick(event: MouseEvent): void {
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
    } else if (action === 'expand-markdown') {
        const field = button.dataset.field;
        const rawIndex = button.dataset.infoIndex;
        const index = rawIndex ? Number(rawIndex) : -1;
        if ((field === 'info-items' || field === 'info-transcript') && index >= 0) {
            openMarkdownEditor(field, index);
            return;
        }
    }

    if (state.timeline) {
        render(state.timeline);
    }
}

async function saveCourse(): Promise<void> {
    if (!state.timeline) {
        return;
    }

    const courseId = getCourseId();
    if (!courseId) {
        return;
    }

    try {
        const response = await fetch('/api/courses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, timeline: state.timeline }),
        });
        if (!response.ok) {
            console.error('Failed to save course');
        }
    } catch (err) {
        console.error('Error saving course:', err);
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

    setupEditorDividers();

    elInfoEditor?.addEventListener('input', handleEditorInput);
    elInfoEditor?.addEventListener('click', handleEditorClick);
    elAddInfoBtn?.addEventListener('click', addInfoBlock);

    render(timeline);

    document.addEventListener('keydown', (event) => {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            state.selectedSegmentIndex = Math.min(state.selectedSegmentIndex + 1, timeline.segments.length - 1);
            state.selectedInfoSectionIndex = null;
            render(timeline);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            state.selectedSegmentIndex = Math.max(state.selectedSegmentIndex - 1, 0);
            state.selectedInfoSectionIndex = null;
            render(timeline);
        } else if (event.key === 'Tab' && elInfoSectionsList && elInfoSectionsList.children.length > 0) {
            // Tab navigation within info sections (optional enhancement)
            const infoCards = Array.from(elInfoSectionsList.querySelectorAll('.editor-info-card'));
            if (infoCards.length === 0) return;

            if (state.selectedInfoSectionIndex === null) {
                state.selectedInfoSectionIndex = 0;
            } else if (event.shiftKey) {
                state.selectedInfoSectionIndex = Math.max(state.selectedInfoSectionIndex - 1, 0);
            } else {
                state.selectedInfoSectionIndex = Math.min(state.selectedInfoSectionIndex + 1, infoCards.length - 1);
            }
            render(timeline);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});
