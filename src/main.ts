import { Timeline } from './models/types.js';
import { goldfishState, advanceSegment, previousSegment, pauseResume } from './core/state.js';
import { render } from './ui/renderer.js';

const VALID_COURSES = ['gh-300', 'az-110', 'ds-150', 'pm-130', 'sec-260', 'wd-210'] as const;

function getCourseId(): string {
    const params = new URLSearchParams(window.location.search);
    const course = params.get('course');
    if (course && (VALID_COURSES as readonly string[]).includes(course)) {
        return course;
    }
    return 'gh-300';
}

async function loadTimeline(courseId: string): Promise<Timeline> {
    const modules: Record<string, () => Promise<{ default: Timeline }>> = {
        'gh-300': () => import('./data/gh-300.json'),
        'az-110': () => import('./data/az-110.json'),
        'ds-150': () => import('./data/ds-150.json'),
        'pm-130': () => import('./data/pm-130.json'),
        'sec-260': () => import('./data/sec-260.json'),
        'wd-210': () => import('./data/wd-210.json'),
    };
    const loader = modules[courseId];
    const mod = await loader();
    return mod.default as Timeline;
}

async function init(): Promise<void> {
    const courseId = getCourseId();
    const timeline = await loadTimeline(courseId);
    function tick(): void {
        render(timeline, goldfishState);
    }

    document.addEventListener('keydown', (e: KeyboardEvent) => {
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                pauseResume();
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
        pauseResume();
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
