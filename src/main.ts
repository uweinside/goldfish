import { goldfishState, advanceSegment, previousSegment, advanceChapter, previousChapter, pauseResume, openNotesPanel, closeNotesPanel, advanceNotesSection, previousNotesSection, navigateToSectionInChapter } from './core/state.js';
import { render } from './ui/renderer.js';
import { loadCourse } from './core/data-loader.js';
import { Timeline } from './models/types.js';

function getCourseId(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('course');
}

function getStartReturnUrl(): string {
    const params = new URLSearchParams(window.location.search);
    return params.get('returnTo') === 'editor' ? '/?from=editor' : '/';
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
                advanceChapter(timeline);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                previousChapter(timeline);
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
        previousChapter(timeline);
    });

    btnPause?.addEventListener('click', () => {
        pauseResume(timeline);
    });

    btnNext?.addEventListener('click', () => {
        advanceChapter(timeline);
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
        window.location.href = getStartReturnUrl();
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

        // Handle section card clicks to navigate and optionally open transcript
        const sectionCard = target.closest('.info-section[data-section-index]') as HTMLElement | null;
        if (sectionCard) {
            const sectionIndexStr = sectionCard.dataset.sectionIndex;
            if (sectionIndexStr !== undefined) {
                const sectionIndex = parseInt(sectionIndexStr, 10);
                if (!isNaN(sectionIndex)) {
                    navigateToSectionInChapter(sectionIndex, timeline);
                    const chapter = timeline.chapters[goldfishState.currentChapterIndex];
                    const targetSection = chapter.sections[sectionIndex];
                    if (typeof targetSection?.transcript === 'string' && targetSection.transcript.trim().length > 0) {
                        openNotesPanel();
                    }
                }
            }
            return;
        }

        if (target.closest('#outline-view-transcript')) {
            const chapter = timeline.chapters[goldfishState.currentChapterIndex];
            const section = chapter.sections[goldfishState.currentSectionIndex];
            const hasCurrentTranscript = typeof section.transcript === 'string' && section.transcript.trim().length > 0;
            if (hasCurrentTranscript) {
                openNotesPanel();
            } else {
                advanceNotesSection(timeline);
            }
            return;
        }

        if (goldfishState.rightPanelMode === 'notes') {
            return;
        }

        const chapter = timeline.chapters[goldfishState.currentChapterIndex];
        const section = chapter.sections[goldfishState.currentSectionIndex];
        if (typeof section.transcript === 'string' && section.transcript.trim().length > 0) {
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

        const sectionCard = target.closest('.info-section[data-section-index]') as HTMLElement | null;
        if (sectionCard) {
            keyboardEvent.preventDefault();
            const sectionIndexStr = sectionCard.dataset.sectionIndex;
            if (sectionIndexStr !== undefined) {
                const sectionIndex = parseInt(sectionIndexStr, 10);
                if (!isNaN(sectionIndex)) {
                    navigateToSectionInChapter(sectionIndex, timeline);
                    const chapter = timeline.chapters[goldfishState.currentChapterIndex];
                    const targetSection = chapter.sections[sectionIndex];
                    if (typeof targetSection?.transcript === 'string' && targetSection.transcript.trim().length > 0) {
                        openNotesPanel();
                    }
                }
            }
        }
    });

    tick(); // render immediately before first interval
    
    // Fade in after first render to prevent flicker
    requestAnimationFrame(() => {
        document.body.classList.remove('timer-loading');
    });
    
    setInterval(tick, 100);
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});
