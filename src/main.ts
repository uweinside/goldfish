import { goldfishState, advanceSegment, previousSegment, pauseResume, openNotesPanel, closeNotesPanel, advanceNotesSection, previousNotesSection } from './core/state.js';
import { render } from './ui/renderer.js';
import { loadCourse } from './core/data-loader.js';
import { Timeline } from './models/types.js';

function getCourseId(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('course');
}

async function init(): Promise<void> {
    const courseId = getCourseId();
    if (!courseId) {
        window.location.href = '/';
        return;
    }

    let timeline: Timeline;
    try {
        timeline = await loadCourse(courseId);
    } catch {
        window.location.href = '/';
        return;
    }
    function tick(): void {
        render(timeline, goldfishState);
    }

    document.addEventListener('keydown', (e: KeyboardEvent) => {
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                pauseResume(timeline);
                break;
            case 'ArrowRight':
                e.preventDefault();
                advanceSegment(timeline);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                previousSegment(timeline);
                break;
            case 'Escape':
                if (goldfishState.rightPanelMode === 'notes') {
                    e.preventDefault();
                    closeNotesPanel();
                }
                break;
        }
    });

    // Prevent Space keyup from triggering a synthetic click on focused buttons
    document.addEventListener('keyup', (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault();
        }
    });

    const btnPrev = document.getElementById('btn-prev');
    const btnPause = document.getElementById('btn-pause');
    const btnNext = document.getElementById('btn-next');

    btnPrev?.addEventListener('click', () => {
        previousSegment(timeline);
    });

    btnPause?.addEventListener('click', () => {
        pauseResume(timeline);
    });

    btnNext?.addEventListener('click', () => {
        advanceSegment(timeline);
    });

    const btnExit = document.getElementById('btn-exit');
    const exitModal = document.getElementById('exit-modal');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');

    btnExit?.addEventListener('click', () => {
        exitModal?.removeAttribute('hidden');
    });

    modalCancel?.addEventListener('click', () => {
        exitModal?.setAttribute('hidden', '');
    });

    modalConfirm?.addEventListener('click', () => {
        window.location.href = '/';
    });

    exitModal?.addEventListener('click', (e) => {
        if (e.target === exitModal) {
            exitModal.setAttribute('hidden', '');
        }
    });

    const rightPanel = document.querySelector('.panel-right');
    rightPanel?.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) {
            return;
        }

        const notesBack = target.closest('#notes-back');
        if (notesBack) {
            closeNotesPanel();
            return;
        }

        const notesPrev = target.closest('#notes-prev');
        if (notesPrev) {
            previousNotesSection(timeline);
            return;
        }

        const notesNext = target.closest('#notes-next');
        if (notesNext) {
            advanceNotesSection(timeline);
            return;
        }

        const notesSection = target.closest('.info-section-notes-enabled') as HTMLElement | null;
        if (notesSection) {
            const sectionIndex = Number(notesSection.dataset.notesSectionIndex);
            if (!Number.isNaN(sectionIndex)) {
                openNotesPanel(sectionIndex);
                return;
            }
        }

        if (goldfishState.rightPanelMode === 'notes') {
            return;
        }

        const segment = timeline.segments[goldfishState.currentSegmentIndex];
        const firstSectionWithNotes = segment.info?.findIndex(section =>
            Array.isArray(section.notes) && section.notes.some(block => typeof block === 'string' && block.trim().length > 0),
        ) ?? -1;

        if (firstSectionWithNotes >= 0) {
            openNotesPanel(firstSectionWithNotes);
            return;
        }

        if (typeof segment.notes === 'string' && segment.notes.trim().length > 0) {
            openNotesPanel();
        }
    });

    rightPanel?.addEventListener('keydown', (e) => {
        const keyboardEvent = e as KeyboardEvent;
        if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') {
            return;
        }

        const target = e.target instanceof Element ? e.target : null;
        if (!target) {
            return;
        }

        const notesSection = target.closest('.info-section-notes-enabled') as HTMLElement | null;
        if (!notesSection) {
            return;
        }

        const sectionIndex = Number(notesSection.dataset.notesSectionIndex);
        if (!Number.isNaN(sectionIndex)) {
            keyboardEvent.preventDefault();
            openNotesPanel(sectionIndex);
        }
    });

    tick(); // render immediately before first interval
    setInterval(tick, 100);
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});
