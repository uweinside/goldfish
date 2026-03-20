import { goldfishState, advanceSegment, previousSegment, pauseResume } from './core/state.js';
import { render } from './ui/renderer.js';
async function init() {
    const response = await fetch('/data/gh-300.json');
    const timeline = await response.json();
    let infoVisible = true;
    function tick() {
        render(timeline, goldfishState, infoVisible);
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
            case 'KeyI':
                e.preventDefault();
                infoVisible = !infoVisible;
                break;
        }
    });
    tick();
    setInterval(tick, 100);
}
document.addEventListener('DOMContentLoaded', () => {
    init().catch(console.error);
});
//# sourceMappingURL=main.js.map