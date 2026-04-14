# CuePilot — Architecture Overview

CuePilot is a glanceable presentation timer built as a **Tauri v2** desktop app. Its frontend is vanilla TypeScript bundled by **Vite**, rendered inside a native window via Tauri's WebView. There is no UI framework — just DOM manipulation, CSS, and a clean module structure.

---

## How Tauri and Vite Work Together

```
┌─────────────────────────────────────────────────┐
│  Tauri (Rust)                                   │
│  ┌───────────────────────────────────────────┐  │
│  │  Native window (WebView)                  │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Frontend (HTML + TypeScript + CSS)  │  │  │
│  │  │  Bundled by Vite                     │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Vite** is the frontend build tool. It compiles TypeScript, resolves imports, and serves the result. During development it runs a hot-reloading dev server on `localhost:1420`. For production it outputs optimized static files to `dist/`.

**Tauri** is the desktop shell. It launches a native window containing a WebView that loads the Vite output. In dev mode, the WebView points at the Vite dev server URL. In production, it loads the bundled files from `dist/`. The Rust backend provides local course persistence via IPC commands.

### Build commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server only (no native window) |
| `npm run tauri:dev` | Starts Vite dev server **+** launches the Tauri native window pointing at it |
| `npm run tauri:build` | Runs `vite build` then packages everything into a native `.exe` installer |

---

## Project Structure

```
goldfish/
├── index.html              ← Course selection page (entry point 1)
├── timer.html              ← Timer/presentation page (entry point 2)
├── editor.html             ← Course editor page (entry point 3)
├── vite.config.ts          ← Vite config (multi-page, port 1420)
├── tsconfig.json           ← TypeScript strict mode, ES2020
├── package.json            ← Scripts and dev dependencies
├── course.schema.json      ← JSON Schema for course files
│
├── src/                    ← All application TypeScript
│   ├── start.ts            ← Course selection page logic
│   ├── main.ts             ← Timer page logic (init, keyboard, buttons)
│   ├── editor.ts           ← Course editor logic (drag-drop, panel management)
│   ├── models/
│   │   ├── types.ts        ← Data types (Timeline, Chapter, Section, AppState)
│   │   └── course-authoring.ts  ← Backend API types
│   ├── core/
│   │   ├── state.ts        ← Mutable app state + state transitions
│   │   ├── timer.ts        ← Pure time calculations (no side effects)
│   │   ├── data-loader.ts  ← Course loading (GitHub + local)
│   │   └── course-authoring-api.ts  ← Tauri IPC wrapper
│   └── ui/
│       └── renderer.ts     ← DOM rendering (reads state, writes to DOM)
│
├── wwwroot/                ← Static assets (served at / by Vite)
│   └── css/
│       └── site.css        ← All styling (layout, colors, typography)
│
└── src-tauri/              ← Tauri / Rust backend
    ├── tauri.conf.json     ← Window config, build settings, app identity
    ├── src/
    │   ├── main.rs         ← Rust entry point (calls lib::run)
    │   ├── lib.rs          ← Tauri builder setup
    │   ├── commands.rs     ← IPC command handlers
    │   ├── course_model.rs ← Rust course types and validation
    │   └── course_store.rs ← File I/O for courses
    ├── courses/            ← Local course JSON storage
    └── icons/              ← App icons for packaging
```

---

## Three Pages, Three Entry Points

The app has three HTML pages, each with its own TypeScript entry:

### 1. Course Selection (`index.html` → `start.ts`)

A grid of course cards from two sources:
- **Local courses** — fetched via Tauri `list_local_courses` command
- **GitHub courses** — fetched from `uweinside/goldfish-data` repo

Each card shows the course code, title, chapter/section counts, and total duration. Actions: Run or Edit.

### 2. Timer (`timer.html` → `main.ts`)

The main presentation view. Reads the `?course=` query parameter, loads the course via `loadCourse()`, and starts the render loop.

### 3. Editor (`editor.html` → `editor.ts`)

Course authoring with three-panel layout:
- **Left** — Chapter list with drag-and-drop (SortableJS)
- **Middle** — Section outline for selected chapter
- **Right** — Section detail editor

---

## Data Flow

```
  Course JSON (local or GitHub)
        │
        ▼
  loadCourse() ──→ Timeline object (chapters[].sections[])
        │
        ▼
  goldfishState (AppState)     ◄── pauseResume / advanceChapter / previousChapter
        │
        ▼
  render() called every 100ms
        │
        ├── getSecondsRemaining()       → section countdown
        ├── getSessionActualRemaining() → clock-based session remaining
        ├── getScheduleDrift()          → ahead/behind indicator
        │
        ▼
  DOM updates (timer text, progress bar, colors, drift label)
```

### Key data types

**Timeline** — A course definition loaded from JSON. Contains a title and an array of chapters.

**Chapter** — A logical grouping of sections with a title.

**Section** — One block of content: a title, type (`Narration` / `Demo` / `Prompt` / `Rule`), duration in seconds, and instructions content.

**AppState** — Mutable runtime state: which chapter/section is active, when it started, whether the timer is paused, and the fixed session end time.

---

## State Management

All mutable state lives in a single exported object (`goldfishState`) in `state.ts`. There is no state management library. Key functions mutate it:

| Function | Trigger | What it does |
|---|---|---|
| `pauseResume(timeline)` | Space key or Pause button | Toggles pause. On first start, anchors `sessionEndTime`. On resume, shifts both `sectionStartTime` and `sessionEndTime` forward by the pause duration. |
| `advanceChapter(timeline)` | → key or Next button | Moves to the next chapter's first section. Does **not** change `sessionEndTime`. |
| `previousChapter(timeline)` | ← key or Prev button | Moves to the previous chapter's first section. |
| `advanceSegment(timeline)` | Auto-advance or manual | Moves to the next section (within or across chapters). |

---

## Timer Logic

All time functions are **pure** (no side effects) and live in `timer.ts`.

### Section timer

Each section counts down from its own `durationSeconds`. The countdown uses `Date.now()` deltas (not `setInterval` counting) to avoid drift:

```
secondsRemaining = section.durationSeconds − (now − sectionStartTime) / 1000
```

When `secondsRemaining` goes negative, the section is in **overtime** and the display switches to count-up.

### Session timer (fixed end time)

The total session end time is anchored when the session first starts:

```
sessionEndTime = Date.now() + totalDuration
```

This value is **fixed** — clicking Next early or overrunning a section does not change it. Pauses shift it forward so only active presentation time counts.

**Session remaining** is simply `sessionEndTime − now`.

### Schedule drift

Drift is the difference between where you *actually* are and where the *plan* says you should be:

```
drift = actualRemaining − plannedRemaining
```

- **Positive drift** → you're ahead of schedule (finished segments early)
- **Negative drift** → you're behind schedule (overran segments)
- **Within ±30 seconds** → displayed as "On schedule" to avoid jitter

---

## Rendering

`renderer.ts` exports a single `render(timeline, state)` function called every 100ms by `setInterval` in `main.ts`. It reads state and writes to the DOM. There is no virtual DOM or diffing — it directly sets `.textContent`, `.style`, and class lists.

### Left panel (timing & flow)

| Element | Content |
|---|---|
| Kicker | Segment type + status ("Lecture segment in progress") |
| Title | Current segment name |
| Timer | Large countdown (or overtime count-up) |
| State label | "On track" / "Wrapping up" / "Overtime" / "Paused" |
| Progress bar | Visual fill from 0% → 100% |
| Next card | Title of the upcoming segment |
| Session remaining | Clock-based time until session end |
| Drift indicator | "X:XX ahead" (green) / "X:XX behind" (red) / "On schedule" |
| Controls | Pause/Resume, Prev, Next, Exit |

### Right panel (info)

Displays the current segment's `info` sections as labeled, color-accented lists. The first section renders largest (primary), subsequent ones are progressively smaller.

### Color system

Body CSS classes drive the entire color theme:

- **State**: `state-ok` (green) → `state-warn` (yellow, last 20%) → `state-over` (red, overtime)
- **Type**: `type-lecture` (blue title) / `type-demo` (purple) / `type-break` (neutral)

---

## Keyboard Controls

| Key | Action |
|---|---|
| Space | Start / Pause / Resume |
| → | Next segment |
| ← | Previous segment |

Button clicks mirror the same actions. During delivery, only keyboard is needed.

---

## Course Data

Timelines are JSON files in `src/data/`. Each file defines a course with an array of segments. Vite imports them as ES modules at build time — they're bundled into the app, no runtime file loading.

Example structure:
```json
{
  "title": "GitHub Copilot Masterclass",
  "segments": [
    {
      "title": "Welcome & Framing",
      "duration": 600,
      "type": "lecture",
      "info": [
        {
          "label": "Trainer Focus",
          "items": ["Set expectations", "Introduce format"]
        }
      ]
    }
  ]
}
```
