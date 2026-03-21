import { listCourses, CourseEntry } from './core/data-loader.js';

function formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
}

function renderCourseGrid(courses: CourseEntry[]): void {
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

function renderError(message: string): void {
    const grid = document.getElementById('course-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'course-empty';
    el.textContent = message;
    grid.appendChild(el);
    grid.classList.add('grid-loaded');
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const courses = await listCourses();
        renderCourseGrid(courses);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        renderError(`Could not load courses: ${msg}`);
    }
});
