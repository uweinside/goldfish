import { Timeline } from './models/types.js';
import { goldfishState, advanceSegment, previousSegment, pauseResume } from './core/state.js';
import { render } from './ui/renderer.js';
import timelineData from './data/gh-300.json';

const timeline = timelineData as Timeline;

function init(): void {
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

    tick(); // render immediately before first interval
    setInterval(tick, 100);
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});
