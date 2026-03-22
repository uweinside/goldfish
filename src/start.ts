import { listCourses, CourseEntry } from './core/data-loader.js';

const PAGE_SIZE = 6;
let allCourses: CourseEntry[] = [];
let currentPage = 0;

function totalPages(): number {
    return Math.max(1, Math.ceil(allCourses.length / PAGE_SIZE));
}

function formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
}

function renderPage(page: number): void {
    const grid = document.getElementById('course-grid');
    if (!grid) return;

    currentPage = Math.max(0, Math.min(page, totalPages() - 1));
    const start = currentPage * PAGE_SIZE;
    const pageCourses = allCourses.slice(start, start + PAGE_SIZE);

    grid.classList.remove('grid-loaded');
    grid.innerHTML = '';

    for (const course of pageCourses) {
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

    requestAnimationFrame(() => grid.classList.add('grid-loaded'));
    renderPaginationControls();
}

function renderPaginationControls(): void {
    const container = document.getElementById('pagination-controls');
    if (!container) return;

    const pages = totalPages();
    if (allCourses.length <= PAGE_SIZE) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.textContent = '\u2039';
    prevBtn.disabled = currentPage === 0;
    prevBtn.setAttribute('aria-label', 'Previous page');
    prevBtn.addEventListener('click', () => renderPage(currentPage - 1));

    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `Page ${currentPage + 1} of ${pages}`;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.textContent = '\u203A';
    nextBtn.disabled = currentPage >= pages - 1;
    nextBtn.setAttribute('aria-label', 'Next page');
    nextBtn.addEventListener('click', () => renderPage(currentPage + 1));

    container.append(prevBtn, info, nextBtn);
}

function renderCourseGrid(courses: CourseEntry[]): void {
    allCourses = courses;
    currentPage = 0;

    if (courses.length === 0) {
        const grid = document.getElementById('course-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'course-empty';
        empty.textContent = 'No courses available';
        grid.appendChild(empty);
        grid.classList.add('grid-loaded');
        return;
    }

    renderPage(0);
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

    document.addEventListener('keydown', (e) => {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        if (allCourses.length <= PAGE_SIZE) return;

        if (e.key === 'ArrowLeft' && currentPage > 0) {
            e.preventDefault();
            renderPage(currentPage - 1);
        } else if (e.key === 'ArrowRight' && currentPage < totalPages() - 1) {
            e.preventDefault();
            renderPage(currentPage + 1);
        }
    });
});
