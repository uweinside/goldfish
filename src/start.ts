import { Timeline } from './models/types.js';
import gh300 from './data/gh-300.json';
import az110 from './data/az-110.json';
import ds150 from './data/ds-150.json';
import pm130 from './data/pm-130.json';
import sec260 from './data/sec-260.json';
import wd210 from './data/wd-210.json';

interface CourseEntry {
    id: string;
    data: Timeline;
}

const courses: CourseEntry[] = [
    { id: 'gh-300', data: gh300 as Timeline },
    { id: 'az-110', data: az110 as Timeline },
    { id: 'ds-150', data: ds150 as Timeline },
    { id: 'pm-130', data: pm130 as Timeline },
    { id: 'sec-260', data: sec260 as Timeline },
    { id: 'wd-210', data: wd210 as Timeline },
];

function formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
}

function renderCourseGrid(): void {
    const grid = document.getElementById('course-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (courses.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'course-empty';
        empty.textContent = 'No courses available';
        grid.appendChild(empty);
        grid.classList.add('grid-loaded');
        return;
    }

    for (const course of courses) {
        const { id, data } = course;
        const title = data.title ?? id.toUpperCase();
        const segmentCount = data.segments.length;
        const totalDuration = data.segments.reduce((sum, s) => sum + s.duration, 0);

        const card = document.createElement('a');
        card.href = `timer.html?course=${encodeURIComponent(id)}`;
        card.className = 'course-card';

        card.innerHTML = `
            <span class="course-code">${id.toUpperCase()}</span>
            <span class="course-title">${title}</span>
            <span class="course-meta">${segmentCount} segments · ${formatDuration(totalDuration)}</span>
        `;

        grid.appendChild(card);
    }

    grid.classList.add('grid-loaded');
}

document.addEventListener('DOMContentLoaded', () => {
    renderCourseGrid();
});
