# CuePilot (codename: goldfish) — Copilot Instructions

## 🧭 Project Overview

CuePilot is a **glanceable presentation timing assistant** designed for instructors delivering structured sessions.

It runs as a **Tauri v2 native desktop app** on a secondary monitor and provides real-time situational awareness:

* Where am I in the flow?
* How much time is left in the current section?
* What comes next?
* Am I ahead or behind schedule?

The app must be optimized for **<1 second visual parsing** with **zero cognitive overhead**.

---

## 🎯 Core Design Principles

### 1. Glanceability First

* UI must be readable in under 1 second
* Large typography, minimal text
* Prefer visual cues (color, layout) over wording

### 2. Time is Primary

* The countdown timer is the dominant UI element
* Section information is secondary
* Future context is tertiary

### 3. Zero Interaction During Delivery

* No mouse interaction required during presentation
* Keyboard shortcuts only (minimal set)

### 4. Calm Guidance

* Avoid stress-inducing UX (no harsh alarms)
* Use subtle visual transitions (color shifts, progress)

---

## 🏗️ Application Structure

The app has **three pages**, each with its own TypeScript entry:

### 1. Course Selection (`index.html` → `start.ts`)

A grid of course cards from two sources:
- **Local courses** — stored via Tauri backend, shown in "My Courses" section
- **GitHub courses** — fetched from `uweinside/goldfish-data` repo

Each card shows course code, title, chapter/section counts, and total duration. Actions: Run or Edit.

### 2. Timer (`timer.html` → `main.ts`)

The main presentation view with two-panel layout:
- **Left panel** — Timer, progress bar, navigation controls, session metadata
- **Right panel** — Instructions and talking points for current section

### 3. Editor (`editor.html` → `editor.ts`)

Course authoring with three-panel layout:
- **Left** — Chapter list with drag-and-drop reordering
- **Middle** — Section outline for selected chapter
- **Right** — Section detail editor (type, duration, instructions, transcript)

---

## 🧠 Data Model

Courses follow a **hierarchical structure**: Timeline → Chapters → Sections.

```ts
type SectionType = 'Narration' | 'Demo' | 'Prompt' | 'Rule';

interface Section {
  title: string;
  type: SectionType;
  durationSeconds: number;
  instructions: string;
  transcript?: string;
}

interface Chapter {
  title: string;
  sections: Section[];
}

interface Timeline {
  title: string;
  chapters: Chapter[];
}
```

Runtime state:

```ts
interface AppState {
  currentChapterIndex: number;
  currentSectionIndex: number;
  sectionStartTime: number;    // Date.now() when section started (adjusted for pauses)
  isPaused: boolean;
  pausedAt?: number;           // Date.now() when paused
  hasStarted: boolean;         // true once user starts the timer
  sessionEndTime: number;      // fixed wall-clock endpoint (shifts on pause/resume)
  rightPanelMode: 'info' | 'notes';
}
```

---

## ⏱ Timer Behavior

* Timer is **countdown by default**
* When time < 0 → switch to **count-up (overtime)**
* Must be accurate and drift-resistant

Uses `Date.now()` deltas instead of relying solely on `setInterval`:

```
secondsRemaining = section.durationSeconds − (now − sectionStartTime) / 1000
```

**Session tracking:**
- `sessionEndTime` is anchored on first start
- Pause/resume shifts `sessionEndTime` forward by pause duration
- Schedule drift = actual remaining vs planned remaining

---

## 🎨 UI Requirements

### Timer View Layout

**Left panel** — Timing & flow:

* Header: chapter kicker, section title, section type badge
* Timer row: label, state text ("On track" / "Wrapping up" / "Overtime" / "Paused"), large countdown
* Progress bar (visual only)
* Meta row: next section title + session remaining + drift indicator
* Controls row: Pause/Resume, Prev, Next, Exit buttons

**Right panel** — Supporting information:

* Header showing chapter progress (e.g., "Section 2 of 5")
* Instructions for current section (markdown-rendered)
* Optional: notes panel mode

### Color System

Use color to communicate state on `document.body`:

* `state-ok` (green) → on track
* `state-warn` (yellow) → last 20% of section
* `state-over` (red) → overtime

Section type visual indicators:
* `Narration` → blue accent
* `Demo` → purple accent
* `Prompt` → amber accent
* `Rule` → red accent

---

## 🦀 Rust Backend Commands

The Tauri backend handles all local course persistence:

| Command | Description |
|---|---|
| `list_local_courses` | Returns summaries of all courses in `src-tauri/courses/` |
| `load_local_course` | Reads and parses a course JSON file |
| `validate_course_document` | Validates a course against the schema |
| `save_course_document` | Atomically writes a course to disk |
| `delete_local_course` | Removes a course file |

Frontend calls these via `@tauri-apps/api/core` invoke.

---

## 🧩 Behavior Rules

### Section Transitions

* Automatically advance to next section when time reaches 0
* Arrow keys navigate by **chapter**, not section
* Allow manual override via controls

### Pause

* Freezes timer without losing elapsed time
* Shifts `sessionEndTime` forward on resume

### Overtime

* Does NOT auto-advance immediately
* Timer switches to count-up display
* Red color state indicates overtime

---

## ⚡ Tech Stack

* **Runtime**: Tauri v2 native desktop app (Rust backend + WebView frontend)
* **Frontend**: Vanilla TypeScript + Vite (no UI framework)
* **Target**: `x86_64-pc-windows-gnu` (MinGW/GNU toolchain)
* **Dependencies**:
  - `@tauri-apps/api` — Tauri IPC
  - `sortablejs` — drag-and-drop in editor
  - `vite`, `typescript` — build tooling
* Must run smoothly fullscreen on a secondary monitor

---

## 📁 Project Structure

```
/src
  /core         → state management, timer logic, data loading
  /ui           → DOM rendering
  /models       → TypeScript types
  start.ts      → course selection page entry
  main.ts       → timer page entry
  editor.ts     → editor page entry

/src-tauri
  /src          → Rust backend (commands, course model, file I/O)
  /courses      → local course JSON storage
```

---

## 🧼 Code Style Guidelines

* Keep functions small and readable
* Prefer explicit naming over clever abstractions
* Avoid over-engineering
* No unnecessary state management libraries
* Use `goldfishState` as the single mutable state object (timer page)

---

## 🚫 Anti-Goals

Do NOT implement:

* Complex configuration UIs
* Authentication
* Backend services (beyond Tauri IPC)
* Real-time collaboration
* Fancy animations

This is a **focused single-user tool**.

---

## 🔮 Future Extensions (do not implement yet)

* Catch-up mode / pace adjustment suggestions
* Presenter notes overlay
* Import from external formats
* Analytics (timing patterns)
* Hardware integrations (external displays, dials)

---

## 🧠 Copilot Guidance

When generating code:

* Prioritize **clarity over abstraction**
* Prefer **working implementation** over extensible architecture
* Keep UI **minimal and distraction-free**
* Avoid adding features not explicitly requested
* Follow existing patterns in codebase

If unsure:
→ Choose the simplest implementation that preserves correctness and readability

---

## 🏁 Current State (beyond MVP)

The app now includes:

* ✅ Timeline JSON loading (local + GitHub)
* ✅ Accurate countdown timer with overtime
* ✅ Automatic section transitions
* ✅ Chapter/section navigation
* ✅ Glanceable two-panel timer view
* ✅ Schedule drift indicator
* ✅ Course editor with drag-and-drop
* ✅ Rust backend for course persistence

---

## 🧪 Example Course

```json
{
  "title": "GitHub Copilot Workshop",
  "chapters": [
    {
      "title": "Welcome & Setup",
      "sections": [
        {
          "title": "Course Overview",
          "type": "Narration",
          "durationSeconds": 300,
          "instructions": "Introduce the course objectives and agenda."
        },
        {
          "title": "Environment Setup",
          "type": "Demo",
          "durationSeconds": 600,
          "instructions": "Walk through VS Code extension installation."
        }
      ]
    },
    {
      "title": "Copilot Fundamentals",
      "sections": [
        {
          "title": "How Copilot Works",
          "type": "Narration",
          "durationSeconds": 900,
          "instructions": "Explain the LLM-based completion model."
        }
      ]
    }
  ]
}
```

---

## 🪬 Issue Tracking

This project uses **bd (beads)** for local issue tracking alongside GitHub Issues.

Run `bd prime` at the start of an agent session for workflow context.

**Quick reference:**

```
bd ready                              # Find unblocked work to pick up
bd create "Title" -t task -p 2       # Create a new issue (priority 0–3)
bd create "Title" -t bug -p 1        # Create a bug
bd update <id> --claim                # Claim a task (marks in-progress)
bd show <id>                          # View task details
bd close <id> --reason "Done"         # Complete an issue
bd list                               # List all open issues
bd dep add <child> <parent>           # Mark <child> blocked by <parent>
```

**Workflow for new features:**

1. `bd create "Feature: <title>" -t task -p 2` — create a beads issue
2. `bd update <id> --claim` — claim it before starting work
3. Create the corresponding GitHub issue (for external visibility)
4. Reference both IDs in commits: `Add foo (bd-abc, #42)`
5. `bd close <id>` when done

---

## 🐙 GitHub Flow

### Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production / release |
| `dev` | Integration — all features merge here first |
| `feature/<issue#>-<slug>` | One branch per issue, branched from `dev` |

### Workflow for New Features

1. **Create a GitHub issue** describing the feature before writing any code
2. **Branch from `dev`**: `git checkout -b feature/<issue#>-short-slug dev`
3. Implement the feature on the branch
4. **Open a PR targeting `dev`** with `Closes #<issue>` in the description body
5. Merge the PR into `dev`
6. `dev` → `main` is a separate release PR when ready to ship

### Naming Conventions

* Branch slug: lowercase, hyphen-separated, ≤ 4 words (e.g. `feature/42-overtime-grace-period`)
* PR title: imperative mood, matches issue title (e.g. `Add overtime grace period`)
* Commit messages: imperative mood, reference issue where relevant (e.g. `Add grace period config (#42)`)

### Copilot Guidance

When helping with a new feature:

1. Confirm or create a GitHub issue for it first
2. Ensure work is on a `feature/*` branch, not directly on `dev` or `main`
3. PR description must include `Closes #<issue>` so the issue auto-closes on merge
4. Target PR at `dev`, never directly at `main`

---

## �🐟 Codename

Internal codename: **goldfish**

Use in:

* variable names (e.g., `goldfishState`)
* internal comments if helpful

Do NOT expose in UI.

