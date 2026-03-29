import { Timeline } from '../models/types.js';
import { loadLocalCourse } from './course-authoring-api.js';

export interface CourseEntry {
    id: string;
    data: Timeline;
}

const GITHUB_OWNER = 'uweinside';
const GITHUB_REPO = 'goldfish-data';
const GITHUB_BRANCH = 'main';

const CONTENTS_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/`;
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/`;

interface GitHubContentEntry {
    name: string;
    type: string;
    download_url: string | null;
}

function isTimeline(data: unknown): data is Timeline {
    if (!data || typeof data !== 'object') {
        return false;
    }

    const value = data as Partial<Timeline>;
    if (!Array.isArray(value.chapters)) {
        return false;
    }

    return value.chapters.every(chapter =>
        !!chapter &&
        typeof chapter === 'object' &&
        typeof chapter.title === 'string' &&
        Array.isArray(chapter.sections),
    );
}

/**
 * Enumerate all .json course files in the GitHub repo and fetch their contents.
 */
export async function listCourses(): Promise<CourseEntry[]> {
    const res = await fetch(CONTENTS_URL, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        cache: 'no-store',
    });
    if (!res.ok) {
        throw new Error(`Failed to list courses: ${res.status} ${res.statusText}`);
    }

    const entries: GitHubContentEntry[] = await res.json();
    const jsonFiles = entries.filter(
        (e) => e.type === 'file' && e.name.endsWith('.json') && e.download_url,
    );

    const settled = await Promise.allSettled(
        jsonFiles.map(async (entry) => {
            const id = entry.name.replace(/\.json$/, '');
            const data = await fetchTimeline(entry.download_url!, id);
            return { id, data };
        }),
    );

    const courses: CourseEntry[] = [];
    for (const result of settled) {
        if (result.status === 'fulfilled') {
            courses.push(result.value);
            continue;
        }

        // Ignore non-course JSON files in the repo root and continue loading valid courses.
        console.warn('Skipping invalid course JSON file:', result.reason);
    }

    courses.sort((a, b) => a.id.localeCompare(b.id));
    return courses;
}

/**
 * Load a single course by ID from the GitHub repo.
 */
export async function loadCourse(courseId: string): Promise<Timeline> {
    // In the Tauri app, user-authored courses live in local storage.
    // Try local first, then fall back to GitHub-hosted courses.
    try {
        return await loadLocalCourse(courseId);
    } catch {
        const url = `${RAW_BASE}${encodeURIComponent(courseId)}.json`;
        return fetchTimeline(url, courseId);
    }
}

async function fetchTimeline(url: string, sourceId?: string): Promise<Timeline> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Failed to fetch course data: ${res.status} ${res.statusText}`);
    }

    const data: unknown = await res.json();
    if (!isTimeline(data)) {
        const source = sourceId ? ` for '${sourceId}'` : '';
        throw new Error(`Invalid course data${source}: missing chapters array`);
    }

    return data as Timeline;
}
