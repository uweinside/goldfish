import { Chapter, Section, SectionType, Timeline } from './models/types.js';
import { loadLocalCourse, saveCourseDocument } from './core/course-authoring-api.js';

interface EditorViewState {
    selectedChapterIndex: number;
    selectedSectionIndex: number | null;
    timeline: Timeline | null;
}

const elCourseTitle = document.getElementById('editor-course-title') as HTMLElement | null;
const elTotalSegments = document.getElementById('editor-total-segments') as HTMLElement | null;
const elTotalDuration = document.getElementById('editor-total-duration') as HTMLElement | null;
const elChapterList = document.getElementById('editor-segment-list') as HTMLElement | null;
const elSectionsList = document.getElementById('editor-info-sections') as HTMLElement | null;
const elSectionEditor = document.getElementById('editor-info-editor-content') as HTMLElement | null;
const elRunLink = document.getElementById('editor-run-link') as HTMLAnchorElement | null;
const elEditorContent = document.querySelector('.editor-content') as HTMLElement | null;
const elDivider1 = document.getElementById('editor-divider-1') as HTMLElement | null;
const elDivider2 = document.getElementById('editor-divider-2') as HTMLElement | null;
const elAddSectionBtn = document.getElementById('editor-add-info-btn') as HTMLButtonElement | null;
const elAddChapterBtn = document.getElementById('editor-add-chapter-btn') as HTMLButtonElement | null;

const state: EditorViewState = {
    selectedChapterIndex: 0,
    selectedSectionIndex: null,
    timeline: null,
};

let dragState: { sourceIndex: number; dragType: 'chapter' | 'section' | null } = {
    sourceIndex: -1,
    dragType: null,
};

const SECTION_TYPE_OPTIONS: SectionType[] = ['Narration', 'Demo', 'Prompt', 'Rule'];
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
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
}

function formatMinutesSeconds(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function totalDuration(timeline: Timeline): number {
    return timeline.chapters
        .flatMap(chapter => chapter.sections)
        .reduce((sum, section) => sum + section.durationSeconds, 0);
}

function chapterDuration(chapter: Chapter): number {
    return chapter.sections.reduce((sum, section) => sum + section.durationSeconds, 0);
}

function getSelectedChapter(): Chapter | null {
    const timeline = state.timeline;
    if (!timeline) {
        return null;
    }
    return timeline.chapters[state.selectedChapterIndex] ?? null;
}

function getSelectedSection(): Section | null {
    const chapter = getSelectedChapter();
    if (!chapter || state.selectedSectionIndex === null) {
        return null;
    }
    return chapter.sections[state.selectedSectionIndex] ?? null;
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
            const left = clientX - rect.left;
            const leftAfterDiv1 = left - (editorSplits.split1 + 0.2);
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
            }
        } else if (divider === 'divider2') {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setEditorSplits(editorSplits.split1, editorSplits.split2 - 2);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                setEditorSplits(editorSplits.split1, editorSplits.split2 + 2);
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

function renderChapterList(timeline: Timeline): void {
    if (!elChapterList) return;

    elChapterList.innerHTML = '';

    timeline.chapters.forEach((chapter, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `editor-segment-card${index === state.selectedChapterIndex ? ' selected' : ''}`;
        button.dataset.chapterIndex = String(index);
        button.draggable = true;
        button.innerHTML = `
            <span class="editor-segment-handle" aria-hidden="true">::</span>
            <span class="editor-segment-title">${escapeHtml(chapter.title)}</span>
            <span class="editor-segment-duration">${formatMinutesSeconds(chapterDuration(chapter))}</span>
        `;

        button.addEventListener('click', () => {
            state.selectedChapterIndex = index;
            state.selectedSectionIndex = null;
            render(timeline);
        });

        button.addEventListener('dragstart', (e) => {
            dragState = { sourceIndex: index, dragType: 'chapter' };
            button.classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        button.addEventListener('dragend', () => {
            button.classList.remove('dragging');
            dragState = { sourceIndex: -1, dragType: null };
        });

        button.addEventListener('dragover', (e) => {
            if (dragState.dragType !== 'chapter' || dragState.sourceIndex === index) {
                return;
            }
            e.preventDefault();
            button.classList.add('drag-over');
        });

        button.addEventListener('dragleave', () => {
            button.classList.remove('drag-over');
        });

        button.addEventListener('drop', (e) => {
            e.preventDefault();
            button.classList.remove('drag-over');
            if (dragState.dragType !== 'chapter' || dragState.sourceIndex < 0 || dragState.sourceIndex === index) {
                return;
            }

            const [removed] = timeline.chapters.splice(dragState.sourceIndex, 1);
            const targetIndex = dragState.sourceIndex < index ? index - 1 : index;
            timeline.chapters.splice(targetIndex, 0, removed);

            if (state.selectedChapterIndex === dragState.sourceIndex) {
                state.selectedChapterIndex = targetIndex;
            }
            state.selectedSectionIndex = null;
            saveCourse();
            render(timeline);
        });

        const row = document.createElement('div');
        row.className = 'editor-card-row';
        row.appendChild(button);

        if (index === state.selectedChapterIndex && timeline.chapters.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'editor-card-delete';
            deleteBtn.title = 'Delete chapter';
            deleteBtn.setAttribute('aria-label', `Delete chapter: ${chapter.title}`);
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', () => removeChapter(index, timeline));
            row.appendChild(deleteBtn);
        }

        elChapterList.appendChild(row);
    });
}

function renderSectionList(timeline: Timeline): void {
    if (!elSectionsList) return;

    const chapter = timeline.chapters[state.selectedChapterIndex];
    if (!chapter) {
        elSectionsList.innerHTML = '<div class="editor-info-editor-empty">No chapter selected</div>';
        return;
    }

    if (chapter.sections.length === 0) {
        elSectionsList.innerHTML = '<div class="editor-info-editor-empty">No sections yet. Add one to define the chapter flow.</div>';
        return;
    }

    elSectionsList.innerHTML = '';

    chapter.sections.forEach((section, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `editor-info-card${index === state.selectedSectionIndex ? ' selected' : ''}`;
        card.dataset.sectionIndex = String(index);
        card.draggable = true;
        card.innerHTML = `
            <span class="editor-info-handle" aria-hidden="true">::</span>
            <span class="editor-info-card-label">${escapeHtml(section.title)}</span>
            <span class="editor-info-card-type">${escapeHtml(section.type)}</span>
            <span class="editor-info-card-count">${formatMinutesSeconds(section.durationSeconds)}</span>
        `;

        card.addEventListener('click', () => {
            state.selectedSectionIndex = index;
            render(timeline);
        });

        card.addEventListener('dragstart', (e) => {
            dragState = { sourceIndex: index, dragType: 'section' };
            card.classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            dragState = { sourceIndex: -1, dragType: null };
        });

        card.addEventListener('dragover', (e) => {
            if (dragState.dragType !== 'section' || dragState.sourceIndex === index) {
                return;
            }
            e.preventDefault();
            card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            if (dragState.dragType !== 'section' || dragState.sourceIndex < 0 || dragState.sourceIndex === index) {
                return;
            }

            const [removed] = chapter.sections.splice(dragState.sourceIndex, 1);
            const targetIndex = dragState.sourceIndex < index ? index - 1 : index;
            chapter.sections.splice(targetIndex, 0, removed);

            if (state.selectedSectionIndex === dragState.sourceIndex) {
                state.selectedSectionIndex = targetIndex;
            }
            saveCourse();
            render(timeline);
        });

        const row = document.createElement('div');
        row.className = 'editor-card-row';
        row.appendChild(card);

        if (index === state.selectedSectionIndex) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'editor-card-delete';
            deleteBtn.title = 'Remove section';
            deleteBtn.setAttribute('aria-label', `Remove section: ${section.title}`);
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', () => {
                removeSection(index);
                if (state.timeline) {
                    render(state.timeline);
                }
            });
            row.appendChild(deleteBtn);
        }

        elSectionsList.appendChild(row);
    });
}

function renderSectionEditor(timeline: Timeline): void {
    if (!elSectionEditor) return;

    const chapter = timeline.chapters[state.selectedChapterIndex];
    if (!chapter) {
        elSectionEditor.innerHTML = '<div class="editor-info-editor-empty">Select a chapter to edit its sections.</div>';
        return;
    }

    const section = getSelectedSection();
    if (!section || state.selectedSectionIndex === null) {
        renderChapterEditor(timeline);
        return;
    }

    const index = state.selectedSectionIndex;
    const durationMinutes = Math.floor(section.durationSeconds / 60);
    const durationSeconds = section.durationSeconds % 60;

    elSectionEditor.innerHTML = `
        <div class="editor-info-editor-form">
            <div class="editor-info-editor-panel">
                <div class="editor-field-row editor-segment-meta-row">
                    <div class="editor-field">
                        <label for="section-type-${index}">Type</label>
                        <select id="section-type-${index}" data-field="section-type">
                            ${SECTION_TYPE_OPTIONS.map(type => `<option value="${type}"${type === section.type ? ' selected' : ''}>${type}</option>`).join('')}
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
                    <label for="section-title-${index}">Title</label>
                    <input id="section-title-${index}" data-field="section-title" type="text" value="${escapeHtml(section.title)}" />
                </div>
                <div class="editor-field">
                    <div class="editor-field-header">
                        <label for="section-instructions-${index}">Instructions</label>
                        <button type="button" class="editor-expand-btn" data-action="expand-markdown" data-field="section-instructions">Expand</button>
                    </div>
                    <textarea id="section-instructions-${index}" data-field="section-instructions" rows="6">${escapeHtml(section.instructions)}</textarea>
                </div>
                <div class="editor-field">
                    <div class="editor-field-header">
                        <label for="section-transcript-${index}">Transcript</label>
                        <button type="button" class="editor-expand-btn" data-action="expand-markdown" data-field="section-transcript">Expand</button>
                    </div>
                    <textarea id="section-transcript-${index}" data-field="section-transcript" rows="6">${escapeHtml(section.transcript ?? '')}</textarea>
                </div>
            </div>
        </div>
    `;
}

function renderChapterEditor(timeline: Timeline): void {
    if (!elSectionEditor) return;

    const chapter = getSelectedChapter();
    if (!chapter) {
        elSectionEditor.innerHTML = '<div class="editor-info-editor-empty">Select a chapter to view its details.</div>';
        return;
    }

    elSectionEditor.innerHTML = `
        <div class="editor-info-editor-form">
            <div class="editor-info-editor-panel">
                <div class="editor-field">
                    <label for="chapter-title">Chapter Title</label>
                    <input
                        id="chapter-title"
                        data-field="chapter-title"
                        type="text"
                        value="${escapeHtml(chapter.title)}"
                        placeholder="Chapter title"
                    />
                </div>
                <div class="editor-chapter-meta">
                    <span class="editor-chapter-meta-pill">${formatMinutesSeconds(chapterDuration(chapter))} · ${chapter.sections.length} section${chapter.sections.length === 1 ? '' : 's'}</span>
                </div>
            </div>
        </div>
    `;
}

function openMarkdownEditor(field: 'section-instructions' | 'section-transcript'): void {
    const section = getSelectedSection();
    if (!section) {
        return;
    }

    const heading = field === 'section-instructions' ? 'Edit Instructions (Markdown)' : 'Edit Transcript (Markdown)';
    const value = field === 'section-instructions' ? section.instructions : (section.transcript ?? '');

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

        if (field === 'section-instructions') {
            section.instructions = textarea.value;
        } else {
            section.transcript = textarea.value.trim().length > 0 ? textarea.value : undefined;
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

function render(timeline: Timeline): void {
    if (elCourseTitle && document.activeElement !== elCourseTitle) {
        elCourseTitle.textContent = timeline.title || 'Untitled Course';
    }

    const sectionCount = timeline.chapters.reduce((sum, chapter) => sum + chapter.sections.length, 0);
    if (elTotalSegments) {
        elTotalSegments.textContent = `${timeline.chapters.length} chapter${timeline.chapters.length === 1 ? '' : 's'} · ${sectionCount} section${sectionCount === 1 ? '' : 's'}`;
    }
    if (elTotalDuration) {
        elTotalDuration.textContent = formatDuration(totalDuration(timeline));
    }

    renderChapterList(timeline);
    renderSectionList(timeline);
    renderSectionEditor(timeline);

    if (elAddSectionBtn) {
        elAddSectionBtn.disabled = state.selectedChapterIndex < 0;
    }
}

function handleEditorInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
        return;
    }

    const timeline = state.timeline;
    if (!timeline) {
        return;
    }

    const field = target.dataset.field;

    if (field === 'chapter-title' && target instanceof HTMLInputElement) {
        const chapter = getSelectedChapter();
        if (chapter) {
            chapter.title = target.value;
            saveCourse();
            renderChapterList(timeline);
        }
        return;
    }

    const section = getSelectedSection();
    if (!section) {
        return;
    }

    if (field === 'section-type' && target instanceof HTMLSelectElement) {
        if (SECTION_TYPE_OPTIONS.includes(target.value as SectionType)) {
            section.type = target.value as SectionType;
            saveCourse();
            renderSectionList(timeline);
        }
    } else if ((field === 'duration-minutes' || field === 'duration-seconds') && target instanceof HTMLInputElement) {
        const minutesInput = elSectionEditor?.querySelector('input[data-field="duration-minutes"]') as HTMLInputElement | null;
        const secondsInput = elSectionEditor?.querySelector('input[data-field="duration-seconds"]') as HTMLInputElement | null;

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
                    section.durationSeconds = duration;
                    if (elTotalDuration) {
                        elTotalDuration.textContent = formatDuration(totalDuration(timeline));
                    }
                    saveCourse();
                    renderSectionList(timeline);
                    renderChapterList(timeline);
                }
            }
        }
    } else if (field === 'section-title') {
        section.title = target.value;
        saveCourse();
    } else if (field === 'section-instructions') {
        section.instructions = target.value;
        saveCourse();
    } else if (field === 'section-transcript') {
        section.transcript = target.value.trim().length > 0 ? target.value : undefined;
        saveCourse();
    }
}

function removeChapter(index: number, timeline: Timeline): void {
    if (timeline.chapters.length <= 1) {
        return;
    }
    timeline.chapters.splice(index, 1);
    state.selectedChapterIndex = Math.min(state.selectedChapterIndex, timeline.chapters.length - 1);
    state.selectedSectionIndex = null;
    saveCourse();
    render(timeline);
}

function addSection(): void {
    const chapter = getSelectedChapter();
    if (!chapter) {
        return;
    }

    const nextSection: Section = {
        title: 'New Section',
        type: 'Narration',
        durationSeconds: 300,
        instructions: 'Add your instructions here.',
    };

    chapter.sections.push(nextSection);
    state.selectedSectionIndex = chapter.sections.length - 1;
    saveCourse();

    if (state.timeline) {
        render(state.timeline);
    }
}

function removeSection(index: number): void {
    const chapter = getSelectedChapter();
    if (!chapter || index < 0 || index >= chapter.sections.length) {
        return;
    }

    chapter.sections.splice(index, 1);

    if (state.selectedSectionIndex === index) {
        state.selectedSectionIndex = chapter.sections.length > 0 ? Math.min(index, chapter.sections.length - 1) : null;
    } else if (state.selectedSectionIndex !== null && state.selectedSectionIndex > index) {
        state.selectedSectionIndex -= 1;
    }

    saveCourse();
}

function addChapter(): void {
    const timeline = state.timeline;
    if (!timeline) {
        return;
    }

    timeline.chapters.push({
        title: 'New Chapter',
        sections: [{
            title: 'New Section',
            type: 'Narration',
            durationSeconds: 300,
            instructions: 'Add your instructions here.',
        }],
    });
    state.selectedChapterIndex = timeline.chapters.length - 1;
    state.selectedSectionIndex = null;
    saveCourse();
    render(timeline);
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
    if (action === 'expand-markdown') {
        const field = button.dataset.field;
        if (field === 'section-instructions' || field === 'section-transcript') {
            openMarkdownEditor(field);
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
        await saveCourseDocument(courseId, state.timeline);
    } catch (err) {
        console.error('Error saving course:', err);
    }
}

function ensureValidTimeline(timeline: Timeline): Timeline {
    if (!timeline.title) {
        timeline.title = 'Untitled Course';
    }

    if (!Array.isArray(timeline.chapters) || timeline.chapters.length === 0) {
        timeline.chapters = [{
            title: 'Chapter 1',
            sections: [{
                title: 'Section 1',
                type: 'Narration',
                durationSeconds: 300,
                instructions: 'Add your instructions here.',
            }],
        }];
    }

        for (const chapter of timeline.chapters) {
        if (!Array.isArray(chapter.sections) || chapter.sections.length === 0) {
            chapter.sections = [{
                title: 'Section 1',
                type: 'Narration',
                durationSeconds: 300,
                instructions: 'Add your instructions here.',
            }];
        }
    }

    return timeline;
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
        timeline = await loadLocalCourse(courseId);
    } catch {
        window.location.href = '/';
        return;
    }

    state.timeline = timeline;

    setupEditorDividers();

    if (elCourseTitle) {
        elCourseTitle.addEventListener('blur', () => {
            if (!state.timeline) return;
            const newTitle = elCourseTitle.textContent?.trim() ?? '';
            state.timeline.title = newTitle || 'Untitled Course';
            if (!newTitle) {
                elCourseTitle.textContent = state.timeline.title;
            }
            saveCourse();
        });
        elCourseTitle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                elCourseTitle.blur();
            }
        });
    }

    elSectionEditor?.addEventListener('input', handleEditorInput);
    elSectionEditor?.addEventListener('click', handleEditorClick);
    elAddSectionBtn?.addEventListener('click', addSection);
    elAddChapterBtn?.addEventListener('click', addChapter);

    render(timeline);

    document.addEventListener('keydown', (event) => {
        const activeEl = document.activeElement;
        if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'SELECT' || (activeEl as HTMLElement | null)?.isContentEditable) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            state.selectedChapterIndex = Math.min(state.selectedChapterIndex + 1, timeline.chapters.length - 1);
            state.selectedSectionIndex = null;
            render(timeline);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            state.selectedChapterIndex = Math.max(state.selectedChapterIndex - 1, 0);
            state.selectedSectionIndex = null;
            render(timeline);
        } else if (event.key === 'Tab' && elSectionsList && elSectionsList.children.length > 0) {
            const sectionCards = Array.from(elSectionsList.querySelectorAll('.editor-info-card'));
            if (sectionCards.length === 0) {
                return;
            }

            if (state.selectedSectionIndex === null) {
                state.selectedSectionIndex = 0;
            } else if (event.shiftKey) {
                state.selectedSectionIndex = Math.max(state.selectedSectionIndex - 1, 0);
            } else {
                state.selectedSectionIndex = Math.min(state.selectedSectionIndex + 1, sectionCards.length - 1);
            }
            render(timeline);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});
