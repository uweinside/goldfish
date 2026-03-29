import { listCourses, CourseEntry } from './core/data-loader.js';
import { listLocalCourses, saveCourseDocument } from './core/course-authoring-api.js';
import { CourseSummary } from './models/course-authoring.js';
import { Timeline } from './models/types.js';

const PAGE_SIZE = 6;
const START_SPLASH_MIN_VISIBLE_MS = 1200;
const START_SPLASH_EXIT_MS = 380;
let allCourses: CourseEntry[] = [];
let currentPage = 0;

function shouldSkipStartSplash(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.get('from') === 'editor';
}

function hideStartSplashImmediately(): void {
    const splash = document.getElementById('startup-splash') as HTMLElement | null;
    if (!splash) {
        return;
    }

    splash.hidden = true;
    splash.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('start-splash-active');
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createStartSplashController(startedAt: number): { dismiss: () => Promise<void> } {
    const splash = document.getElementById('startup-splash') as HTMLElement | null;
    const logo = document.getElementById('startup-splash-logo') as HTMLImageElement | null;

    if (logo) {
        logo.src = new URL('../src-tauri/icons/icon.png', import.meta.url).href;
    }

    let dismissed = false;
    const dismiss = async (): Promise<void> => {
        if (!splash || dismissed) return;
        dismissed = true;

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, START_SPLASH_MIN_VISIBLE_MS - elapsed);
        if (remaining > 0) {
            await delay(remaining);
        }

        splash.classList.add('start-splash-exit');
        document.body.classList.remove('start-splash-active');

        await new Promise<void>((resolve) => {
            let settled = false;
            const finish = (): void => {
                if (settled) return;
                settled = true;
                splash.removeEventListener('transitionend', onTransitionEnd);
                splash.hidden = true;
                splash.setAttribute('aria-hidden', 'true');
                resolve();
            };

            const onTransitionEnd = (event: TransitionEvent): void => {
                if (event.target === splash && event.propertyName === 'opacity') {
                    finish();
                }
            };

            splash.addEventListener('transitionend', onTransitionEnd);
            setTimeout(finish, START_SPLASH_EXIT_MS + 80);
        });
    };

    return { dismiss };
}

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
        const title = data.title || id.toUpperCase();
        const chapterCount = data.chapters.length;
        const sectionCount = data.chapters.reduce((sum, chapter) => sum + chapter.sections.length, 0);
        const totalDuration = data.chapters
            .flatMap(chapter => chapter.sections)
            .reduce((sum, section) => sum + section.durationSeconds, 0);
        const timerHref = `timer.html?course=${encodeURIComponent(id)}`;
        const editorHref = `editor.html?course=${encodeURIComponent(id)}`;

        const card = document.createElement('article');
        card.className = 'course-card';

        const primaryLink = document.createElement('a');
        primaryLink.href = timerHref;
        primaryLink.className = 'course-card-main';
        primaryLink.setAttribute('aria-label', `Run course ${title}`);
        primaryLink.innerHTML = `
            <span class="course-code">${id.toUpperCase()}</span>
            <span class="course-title">${title}</span>
            <span class="course-meta">${chapterCount} chapters · ${sectionCount} sections · ${formatDuration(totalDuration)}</span>
        `;

        const actions = document.createElement('div');
        actions.className = 'course-card-actions';

        const runLink = document.createElement('a');
        runLink.href = timerHref;
        runLink.className = 'course-card-action';
        runLink.textContent = 'Run';
        runLink.setAttribute('aria-label', `Run course ${title}`);

        const editLink = document.createElement('a');
        editLink.href = editorHref;
        editLink.className = 'course-card-action course-card-action-edit';
        editLink.textContent = 'Edit';
        editLink.setAttribute('aria-label', `Edit course ${title}`);

        actions.append(runLink, editLink);
        card.append(primaryLink, actions);

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

function slugifyCourseId(title: string): string {
    return title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'course';
}

function renderLocalCourses(summaries: CourseSummary[]): void {
    const section = document.getElementById('local-courses-section') as HTMLElement | null;
    const grid = document.getElementById('local-course-grid') as HTMLElement | null;
    const githubLabel = document.getElementById('github-courses-label') as HTMLElement | null;
    if (!section || !grid) return;

    section.hidden = false;
    if (githubLabel) githubLabel.hidden = false;

    if (summaries.length === 0) {
        grid.innerHTML = '<div class="course-empty">No local courses yet. Create one to get started.</div>';
        return;
    }

    grid.innerHTML = '';
    for (const summary of summaries) {
        const title = summary.title || summary.id.toUpperCase();
        const timerHref = `timer.html?course=${encodeURIComponent(summary.id)}`;
        const editorHref = `editor.html?course=${encodeURIComponent(summary.id)}`;

        const card = document.createElement('article');
        card.className = 'course-card';

        const primaryLink = document.createElement('a');
        primaryLink.href = editorHref;
        primaryLink.className = 'course-card-main';
        primaryLink.setAttribute('aria-label', `Edit course ${title}`);
        primaryLink.innerHTML = `
            <span class="course-code">${summary.id.toUpperCase()}</span>
            <span class="course-title">${title}</span>
            <span class="course-meta">${summary.chapter_count} chapters · ${summary.section_count} sections · ${formatDuration(summary.total_duration)}</span>
        `;

        const actions = document.createElement('div');
        actions.className = 'course-card-actions';

        const runLink = document.createElement('a');
        runLink.href = timerHref;
        runLink.className = 'course-card-action';
        runLink.textContent = 'Run';
        runLink.setAttribute('aria-label', `Run course ${title}`);

        const editLink = document.createElement('a');
        editLink.href = editorHref;
        editLink.className = 'course-card-action course-card-action-edit';
        editLink.textContent = 'Edit';
        editLink.setAttribute('aria-label', `Edit course ${title}`);

        actions.append(runLink, editLink);
        card.append(primaryLink, actions);
        grid.appendChild(card);
    }
}

function showNewCourseDialog(): void {
    const overlay = document.createElement('div');
    overlay.className = 'new-course-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'New Course');
    overlay.innerHTML = `
        <div class="new-course-dialog">
            <h2 class="new-course-heading">New Course</h2>
            <div class="new-course-field">
                <label for="new-course-title" class="new-course-label">Course Title</label>
                <input
                    id="new-course-title"
                    class="new-course-input"
                    type="text"
                    placeholder="e.g. GitHub Copilot Fundamentals"
                    maxlength="200"
                    autocomplete="off"
                />
            </div>
            <div class="new-course-error" id="new-course-error" hidden></div>
            <div class="new-course-actions">
                <button type="button" id="new-course-cancel" class="editor-btn">Cancel</button>
                <button type="button" id="new-course-create" class="editor-btn editor-btn-primary" disabled>Create</button>
            </div>
        </div>
    `;

    const input = overlay.querySelector('#new-course-title') as HTMLInputElement;
    const createBtn = overlay.querySelector('#new-course-create') as HTMLButtonElement;
    const cancelBtn = overlay.querySelector('#new-course-cancel') as HTMLButtonElement;
    const errorEl = overlay.querySelector('#new-course-error') as HTMLElement;

    const close = (): void => {
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
    };

    input.addEventListener('input', () => {
        createBtn.disabled = input.value.trim().length === 0;
        errorEl.hidden = true;
    });

    const onCreate = async (): Promise<void> => {
        const title = input.value.trim();
        if (!title) return;

        createBtn.disabled = true;
        createBtn.textContent = 'Creating…';

        const id = slugifyCourseId(title);
        const initialTimeline: Timeline = {
            title,
            chapters: [{
                title: 'Introduction',
                sections: [{
                    title: 'Overview',
                    type: 'Narration',
                    durationSeconds: 300,
                    instructions: 'Add your instructions here.',
                }],
            }],
        };

        try {
            await saveCourseDocument(id, initialTimeline);
            window.location.href = `editor.html?course=${encodeURIComponent(id)}`;
        } catch (err) {
            console.error('Failed to create course:', err);
            const message = err instanceof Error ? err.message : String(err);
            errorEl.textContent = `Could not create course: ${message}`;
            errorEl.hidden = false;
            createBtn.disabled = false;
            createBtn.textContent = 'Create';
        }
    };

    createBtn.addEventListener('click', onCreate);
    cancelBtn.addEventListener('click', close);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !createBtn.disabled) {
            onCreate();
        }
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    const onKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 50);
}

document.addEventListener('DOMContentLoaded', async () => {
    const skipSplash = shouldSkipStartSplash();
    if (skipSplash) {
        hideStartSplashImmediately();
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const splashController = skipSplash ? null : createStartSplashController(Date.now());
    document.getElementById('new-course-btn')?.addEventListener('click', showNewCourseDialog);

    // Fetch local and GitHub course lists together so the start screen renders as one update.
    const [localResult, githubResult] = await Promise.allSettled([
        listLocalCourses(),
        listCourses(),
    ]);

    if (localResult.status === 'fulfilled') {
        renderLocalCourses(localResult.value);
    }

    if (githubResult.status === 'fulfilled') {
        renderCourseGrid(githubResult.value);
    } else {
        const reason = githubResult.reason;
        const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unknown error');
        renderError(`Could not load courses: ${msg}`);
    }

    if (splashController) {
        await splashController.dismiss();
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
