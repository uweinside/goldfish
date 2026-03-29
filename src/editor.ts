import Sortable from 'sortablejs';
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

let chapterSortable: Sortable | null = null;
let sectionSortable: Sortable | null = null;
let editingChapterIndex: number | null = null;

function createDefaultSection(title = 'Section 1'): Section {
    return {
        title,
        type: 'Narration',
        durationSeconds: 300,
        instructions: 'Add your instructions here.',
    };
}

function createDefaultChapter(title = 'Chapter 1'): Chapter {
    return {
        title,
        sections: [createDefaultSection()],
    };
}

function sanitizeIndex(value: number, fallback: number): number {
    return Number.isInteger(value) ? value : fallback;
}

export function normalizeTimelineAndSelection(
    timeline: Timeline,
    selectedChapterIndex: number,
    selectedSectionIndex: number | null,
): { selectedChapterIndex: number; selectedSectionIndex: number | null } {
    if (!timeline.title) {
        timeline.title = 'Untitled Course';
    }

    if (!Array.isArray(timeline.chapters) || timeline.chapters.length === 0) {
        timeline.chapters = [createDefaultChapter()];
    }

    for (const chapter of timeline.chapters) {
        if (!Array.isArray(chapter.sections) || chapter.sections.length === 0) {
            chapter.sections = [createDefaultSection()];
        }
    }

    const normalizedChapterIndex = clamp(
        sanitizeIndex(selectedChapterIndex, 0),
        0,
        timeline.chapters.length - 1,
    );

    const selectedChapter = timeline.chapters[normalizedChapterIndex];
    const maxSectionIndex = selectedChapter.sections.length - 1;

    let normalizedSectionIndex: number | null = selectedSectionIndex;
    if (normalizedSectionIndex !== null) {
        normalizedSectionIndex = clamp(
            sanitizeIndex(normalizedSectionIndex, 0),
            0,
            maxSectionIndex,
        );
    }

    return {
        selectedChapterIndex: normalizedChapterIndex,
        selectedSectionIndex: normalizedSectionIndex,
    };
}

function normalizeEditorState(timeline: Timeline): void {
    const normalized = normalizeTimelineAndSelection(
        timeline,
        state.selectedChapterIndex,
        state.selectedSectionIndex,
    );
    state.selectedChapterIndex = normalized.selectedChapterIndex;
    state.selectedSectionIndex = normalized.selectedSectionIndex;
}

function reorderList<T>(items: T[], fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) {
        return;
    }

    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
}

function remapSelectedIndex(
    selectedIndex: number | null,
    fromIndex: number,
    toIndex: number,
): number | null {
    if (selectedIndex === null) {
        return null;
    }

    if (selectedIndex === fromIndex) {
        return toIndex;
    }

    if (fromIndex < toIndex && selectedIndex > fromIndex && selectedIndex <= toIndex) {
        return selectedIndex - 1;
    }

    if (fromIndex > toIndex && selectedIndex >= toIndex && selectedIndex < fromIndex) {
        return selectedIndex + 1;
    }

    return selectedIndex;
}

const SECTION_TYPE_OPTIONS: SectionType[] = ['Narration', 'Demo', 'Prompt', 'Rule'];
const DEFAULT_EDITOR_SPLITS = { split1: 33, split2: 33 };
let editorSplits = { ...DEFAULT_EDITOR_SPLITS };

function getCourseId(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('course');
}

function buildEditorReturnUrl(): string {
    return '/?from=editor';
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatMinutesSeconds(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatSessionDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`;
    }

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

function selectSectionForActiveChapter(preferredIndex = 0): void {
    const chapter = getSelectedChapter();
    if (!chapter || chapter.sections.length === 0) {
        state.selectedSectionIndex = null;
        return;
    }

    state.selectedSectionIndex = clamp(preferredIndex, 0, chapter.sections.length - 1);
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
            const percent = (left / rect.width) * 100;
            const split2 = percent - editorSplits.split1;
            setEditorSplits(editorSplits.split1, split2);
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
        const row = document.createElement('div');
        row.className = 'editor-card-row';

        if (index === editingChapterIndex) {
            const card = document.createElement('div');
            card.className = `editor-segment-card editing${index === state.selectedChapterIndex ? ' selected' : ''}`;

            const handle = document.createElement('span');
            handle.className = 'editor-segment-handle';
            handle.setAttribute('aria-hidden', 'true');
            handle.textContent = '::';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'editor-segment-rename-input';
            input.value = chapter.title;
            input.setAttribute('aria-label', 'Chapter title');

            const duration = document.createElement('span');
            duration.className = 'editor-segment-duration';
            duration.textContent = formatMinutesSeconds(chapterDuration(chapter));

            card.appendChild(handle);
            card.appendChild(input);
            card.appendChild(duration);
            row.appendChild(card);

            let committed = false;
            const commit = (): void => {
                if (committed) return;
                committed = true;
                const trimmed = input.value.trim();
                if (trimmed) {
                    chapter.title = trimmed;
                    saveCourse();
                }
                editingChapterIndex = null;
                render(timeline);
            };
            const cancel = (): void => {
                if (committed) return;
                committed = true;
                editingChapterIndex = null;
                render(timeline);
            };

            input.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            });
            input.addEventListener('blur', commit);

            requestAnimationFrame(() => { input.focus(); input.select(); });
        } else {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `editor-segment-card${index === state.selectedChapterIndex ? ' selected' : ''}`;
            button.dataset.chapterIndex = String(index);
            button.innerHTML = `
                <span class="editor-segment-handle" aria-hidden="true">::</span>
                <span class="editor-segment-title">${escapeHtml(chapter.title)}</span>
                <span class="editor-segment-duration">${formatMinutesSeconds(chapterDuration(chapter))}</span>
            `;

            button.addEventListener('click', () => {
                state.selectedChapterIndex = index;
                selectSectionForActiveChapter();
                render(timeline);
            });

            row.appendChild(button);

            if (index === state.selectedChapterIndex) {
                const actions = document.createElement('div');
                actions.className = 'editor-card-actions';

                const renameBtn = document.createElement('button');
                renameBtn.type = 'button';
                renameBtn.className = 'editor-card-rename';
                renameBtn.title = 'Rename chapter';
                renameBtn.setAttribute('aria-label', `Rename chapter: ${chapter.title}`);
                renameBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    editingChapterIndex = index;
                    renderChapterList(timeline);
                });
                actions.appendChild(renameBtn);

                if (timeline.chapters.length > 1) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.type = 'button';
                    deleteBtn.className = 'editor-card-delete';
                    deleteBtn.title = 'Delete chapter';
                    deleteBtn.setAttribute('aria-label', `Delete chapter: ${chapter.title}`);
                    deleteBtn.textContent = '×';
                    deleteBtn.addEventListener('click', () => removeChapter(index, timeline));
                    actions.appendChild(deleteBtn);
                }

                row.appendChild(actions);
            }
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
        elSectionsList.innerHTML = '<div class="editor-info-editor-empty">No sections yet. Add one to build the outline.</div>';
        return;
    }

    elSectionsList.innerHTML = '';

    chapter.sections.forEach((section, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `editor-info-card${index === state.selectedSectionIndex ? ' selected' : ''}`;
        card.dataset.sectionIndex = String(index);
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

        const row = document.createElement('div');
        row.className = 'editor-card-row';
        row.appendChild(card);

        if (index === state.selectedSectionIndex && chapter.sections.length > 1) {
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

function setupSortables(timeline: Timeline): void {
    chapterSortable?.destroy();
    sectionSortable?.destroy();
    chapterSortable = null;
    sectionSortable = null;

    if (elChapterList) {
        chapterSortable = Sortable.create(elChapterList, {
            animation: 140,
            forceFallback: true,
            fallbackOnBody: true,
            fallbackTolerance: 3,
            handle: '.editor-segment-card',
            draggable: '.editor-card-row',
            filter: '.editor-card-delete',
            ghostClass: 'dragging',
            chosenClass: 'drag-over',
            onEnd: (evt: Sortable.SortableEvent) => {
                if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) {
                    return;
                }

                reorderList(timeline.chapters, evt.oldIndex, evt.newIndex);
                state.selectedChapterIndex = remapSelectedIndex(
                    state.selectedChapterIndex,
                    evt.oldIndex,
                    evt.newIndex,
                ) ?? 0;
                selectSectionForActiveChapter();
                normalizeEditorState(timeline);
                saveCourse();
                render(timeline);
            },
        });
    }

    const chapter = timeline.chapters[state.selectedChapterIndex];
    if (elSectionsList && chapter && chapter.sections.length > 0) {
        sectionSortable = Sortable.create(elSectionsList, {
            animation: 140,
            forceFallback: true,
            fallbackOnBody: true,
            fallbackTolerance: 3,
            handle: '.editor-info-card',
            draggable: '.editor-card-row',
            filter: '.editor-card-delete',
            ghostClass: 'dragging',
            chosenClass: 'drag-over',
            onEnd: (evt: Sortable.SortableEvent) => {
                if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) {
                    return;
                }

                reorderList(chapter.sections, evt.oldIndex, evt.newIndex);
                state.selectedSectionIndex = remapSelectedIndex(
                    state.selectedSectionIndex,
                    evt.oldIndex,
                    evt.newIndex,
                );
                normalizeEditorState(timeline);
                saveCourse();
                render(timeline);
            },
        });
    }
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
    normalizeEditorState(timeline);

    if (elCourseTitle && document.activeElement !== elCourseTitle) {
        elCourseTitle.textContent = timeline.title || 'Untitled Course';
    }

    const sectionCount = timeline.chapters.reduce((sum, chapter) => sum + chapter.sections.length, 0);
    if (elTotalSegments) {
        elTotalSegments.textContent = `${timeline.chapters.length} chapter${timeline.chapters.length === 1 ? '' : 's'} · ${sectionCount} section${sectionCount === 1 ? '' : 's'}`;
    }
    if (elTotalDuration) {
        elTotalDuration.textContent = formatSessionDuration(totalDuration(timeline));
    }

    renderChapterList(timeline);
    renderSectionList(timeline);
    setupSortables(timeline);
    renderSectionEditor(timeline);

    if (elAddSectionBtn) {
        elAddSectionBtn.disabled = !getSelectedChapter();
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
                        elTotalDuration.textContent = formatSessionDuration(totalDuration(timeline));
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
    normalizeEditorState(timeline);
    saveCourse();
    render(timeline);
}

function addSection(): void {
    const chapter = getSelectedChapter();
    if (!chapter) {
        return;
    }

    const nextSection: Section = createDefaultSection('New Section');

    chapter.sections.push(nextSection);
    state.selectedSectionIndex = chapter.sections.length - 1;
    if (state.timeline) {
        normalizeEditorState(state.timeline);
    }
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

    if (chapter.sections.length <= 1) {
        return;
    }

    chapter.sections.splice(index, 1);

    if (state.selectedSectionIndex === index) {
        state.selectedSectionIndex = chapter.sections.length > 0 ? Math.min(index, chapter.sections.length - 1) : null;
    } else if (state.selectedSectionIndex !== null && state.selectedSectionIndex > index) {
        state.selectedSectionIndex -= 1;
    }

    if (state.timeline) {
        normalizeEditorState(state.timeline);
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
        sections: [createDefaultSection('New Section')],
    });
    state.selectedChapterIndex = timeline.chapters.length - 1;
    state.selectedSectionIndex = null;
    normalizeEditorState(timeline);
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

async function init(): Promise<void> {
    const courseId = getCourseId();
    if (!courseId) {
        window.location.href = '/';
        return;
    }

    const backLink = document.querySelector('.editor-back-link') as HTMLAnchorElement | null;
    if (backLink) {
        backLink.href = buildEditorReturnUrl();
    }

    if (elRunLink) {
        elRunLink.href = `timer.html?course=${encodeURIComponent(courseId)}&returnTo=editor`;
    }

    let timeline: Timeline;
    try {
        timeline = await loadLocalCourse(courseId);
    } catch {
        window.location.href = '/';
        return;
    }

    state.selectedChapterIndex = timeline.chapters.length - 1;
    const initialChapter = timeline.chapters[state.selectedChapterIndex];
    state.selectedSectionIndex = initialChapter ? initialChapter.sections.length - 1 : null;
    normalizeEditorState(timeline);
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
            selectSectionForActiveChapter();
            normalizeEditorState(timeline);
            render(timeline);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            state.selectedChapterIndex = Math.max(state.selectedChapterIndex - 1, 0);
            selectSectionForActiveChapter();
            normalizeEditorState(timeline);
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
            normalizeEditorState(timeline);
            render(timeline);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});
