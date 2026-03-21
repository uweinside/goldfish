import { goldfishState, advanceSegment, previousSegment, pauseResume } from './core/state.js';
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

    tick(); // render immediately before first interval
    setInterval(tick, 100);
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});
