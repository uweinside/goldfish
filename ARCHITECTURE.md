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

**Vite** is the frontend build tool. It compiles TypeScript, resolves imports, bundles JSON data files, and serves the result. During development it runs a hot-reloading dev server on `localhost:1420`. For production it outputs optimized static files to `dist/`.

**Tauri** is the desktop shell. It launches a native window containing a WebView that loads the Vite output. In dev mode, the WebView points at the Vite dev server URL. In production, it loads the bundled files from `dist/`. The Rust backend is minimal — it just sets up the window and an optional logging plugin. All application logic lives in the frontend.

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
├── vite.config.ts          ← Vite config (multi-page, port 1420)
├── tsconfig.json           ← TypeScript strict mode, ES2020
├── package.json            ← Scripts and dev dependencies
│
├── src/                    ← All application TypeScript
│   ├── start.ts            ← Course selection page logic
│   ├── main.ts             ← Timer page logic (init, keyboard, buttons)
│   ├── models/
│   │   └── types.ts        ← Data types (Timeline, Segment, AppState)
│   ├── core/
│   │   ├── state.ts        ← Mutable app state + state transitions
│   │   └── timer.ts        ← Pure time calculations (no side effects)
│   ├── ui/
│   │   └── renderer.ts     ← DOM rendering (reads state, writes to DOM)
│   └── data/
│       ├── gh-300.json     ← Course timeline files
│       ├── az-110.json
│       └── ...
│
├── wwwroot/                ← Static assets (served at / by Vite)
│   └── css/
│       └── site.css        ← All styling (layout, colors, typography)
│
└── src-tauri/              ← Tauri / Rust shell
    ├── tauri.conf.json     ← Window config, build settings, app identity
    ├── src/
    │   ├── main.rs         ← Rust entry point (calls lib::run)
    │   └── lib.rs          ← Tauri builder setup (window + logging)
    └── icons/              ← App icons for packaging
```

---

## Two Pages, Two Entry Points

The app has two HTML pages, each with its own TypeScript entry:

### 1. Course Selection (`index.html` → `start.ts`)

A grid of course cards. Each card shows the course code, title, segment count, and total duration. Clicking a card navigates to:

```
timer.html?course=gh-300
```

### 2. Timer (`timer.html` → `main.ts`)

The main presentation view. Reads the `?course=` query parameter, dynamically imports the matching JSON timeline, and starts the render loop.

---

## Data Flow

```
  JSON file (e.g. gh-300.json)
        │
        ▼
  loadTimeline() ──→ Timeline object (segments[])
        │
        ▼
  goldfishState (AppState)     ◄── pauseResume / advanceSegment / previousSegment
        │
        ▼
  render() called every 100ms
        │
        ├── getSecondsRemaining()       → segment countdown
        ├── getSessionActualRemaining() → clock-based session remaining
        ├── getScheduleDrift()          → ahead/behind indicator
        │
        ▼
  DOM updates (timer text, progress bar, colors, drift label)
```

### Key data types

**Timeline** — A course definition loaded from JSON. Contains a title and an array of segments.

**Segment** — One block of content: a title, duration in seconds, an optional type (`lecture` / `demo` / `break`), and optional info sections displayed in the right panel.

**AppState** — Mutable runtime state: which segment is active, when it started, whether the timer is paused, and the fixed session end time.

---

## State Management

All mutable state lives in a single exported object (`goldfishState`) in `state.ts`. There is no state management library. Three functions mutate it:

| Function | Trigger | What it does |
|---|---|---|
| `pauseResume(timeline)` | Space key or Pause button | Toggles pause. On first start, anchors `sessionEndTime`. On resume, shifts both `segmentStartTime` and `sessionEndTime` forward by the pause duration. |
| `advanceSegment(timeline)` | → key or Next button | Moves to the next segment. Resets segment timer. Does **not** change `sessionEndTime`. |
| `previousSegment(timeline)` | ← key or Prev button | Moves to the previous segment. Same behavior as advance but backwards. |

---

## Timer Logic

All time functions are **pure** (no side effects) and live in `timer.ts`.

### Segment timer

Each segment counts down from its own `duration`. The countdown uses `Date.now()` deltas (not `setInterval` counting) to avoid drift:

```
secondsRemaining = segment.duration − (now − segmentStartTime) / 1000
```

When `secondsRemaining` goes negative, the segment is in **overtime** and the display switches to count-up.

### Session timer (fixed end time)

The total session end time is anchored when the session first starts:

```
sessionEndTime = Date.now() + totalDuration
```

This value is **fixed** — clicking Next early or overrunning a segment does not change it. Pauses shift it forward so only active presentation time counts.

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
