import { goldfishState, advanceSegment, previousSegment, pauseResume } from './core/state.js';
import { render } from './ui/renderer.js';
async function init() {
    const response = await fetch('/data/gh-300.json');
    const timeline = await response.json();
    function tick() {
        render(timeline, goldfishState);
    }
    document.addEventListener('keydown', (e) => {
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
    tick();
    setInterval(tick, 100);
}
document.addEventListener('DOMContentLoaded', () => {
    init().catch(console.error);
});
//# sourceMappingURL=main.js.map