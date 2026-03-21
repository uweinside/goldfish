import { Timeline } from '../models/types.js';

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

    const results = await Promise.all(
        jsonFiles.map(async (entry) => {
            const id = entry.name.replace(/\.json$/, '');
            const data = await fetchTimeline(entry.download_url!);
            return { id, data };
        }),
    );

    return results;
}

/**
 * Load a single course by ID from the GitHub repo.
 */
export async function loadCourse(courseId: string): Promise<Timeline> {
    const url = `${RAW_BASE}${encodeURIComponent(courseId)}.json`;
    return fetchTimeline(url);
}

async function fetchTimeline(url: string): Promise<Timeline> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Failed to fetch course data: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.segments)) {
        throw new Error('Invalid course data: missing segments array');
    }
    return data as Timeline;
}
