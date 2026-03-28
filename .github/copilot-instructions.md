# CuePilot (codename: goldfish) — Copilot Instructions

## 🧭 Project Overview

CuePilot is a **glanceable presentation timing assistant** designed for instructors delivering structured sessions.

It runs as a **Tauri v2 native desktop app** on a secondary monitor and provides real-time situational awareness:

* Where am I in the flow?
* How much time is left in the current segment?
* What comes next?

The app must be optimized for **<1 second visual parsing** with **zero cognitive overhead**.

---

## 🎯 Core Design Principles

### 1. Glanceability First

* UI must be readable in under 1 second
* Large typography, minimal text
* Prefer visual cues (color, layout) over wording

### 2. Time is Primary

* The countdown timer is the dominant UI element
* Segment information is secondary
* Future context is tertiary

### 3. Zero Interaction During Delivery

* No mouse interaction required during presentation
* Keyboard shortcuts only (minimal set)

### 4. Calm Guidance

* Avoid stress-inducing UX (no harsh alarms)
* Use subtle visual transitions (color shifts, progress)

---

## 🧱 MVP Scope

Implement the smallest useful version first:

* Load a timeline from JSON
* Display:

  * Current segment title
  * Countdown timer (primary)
  * Progress bar
  * Next segment
* Automatically advance to next segment
* Keyboard controls:

  * Space → pause/resume
  * ArrowRight → next segment
  * ArrowLeft → previous segment

---

## 🧠 Data Model

Use a simple, strongly typed structure.

```ts
interface InfoSection {
  label: string;
  items: string[];
}

interface Segment {
  title: string;
  duration: number; // seconds
  type?: "lecture" | "demo" | "break";
  info?: InfoSection[];
}

interface Timeline {
  segments: Segment[];
}
```

Runtime state:

```ts
interface AppState {
  currentSegmentIndex: number;
  segmentStartTime: number; // Date.now() when segment effectively started (adjusted for pauses)
  isPaused: boolean;
  pausedAt?: number; // Date.now() when paused
}
```

---

## ⏱ Timer Behavior

* Timer is **countdown by default**
* When time < 0 → switch to **count-up (overtime)**
* Must be accurate and drift-resistant

Preferred approach:

* Use `Date.now()` deltas instead of relying solely on `setInterval`

---

## 🎨 UI Requirements

### Layout (two-panel, fullscreen)

**Left panel** — Timing & flow:

* Header: segment kicker (type + status), title, segment type badge
* Timer row: label, state text ("On track" / "Wrapping up" / "Overtime" / "Paused"), large countdown
* Progress bar (visual only)
* Meta row: next segment title + session remaining
* Controls row: Pause/Resume, Prev, Next buttons

**Right panel** — Supporting information:

* `info` sections for the current segment, rendered as labelled lists
* First section is primary (largest), subsequent sections are secondary/tertiary
* Each section has a color accent derived from its label keyword

---

### Color System

Use color to communicate state on `document.body`:

* `state-ok` (green) → on track
* `state-warn` (yellow) → last 20% of segment
* `state-over` (red) → overtime

Segment type classes on `document.body`:

* `type-lecture` → blue accent
* `type-demo` → purple accent
* `type-break` → neutral/gray accent

Info section accent colors (derived from `label` keyword):

* `focus` / `objective` → `#60A5FA` (blue)
* `talking` → `#2DD4BF` (teal)
* `prompt` → `#FBBF24` (amber)
* `demo` → `#A78BFA` (purple)
* `rule` → `#F87171` (red)
* (default) → `#6B7280` (gray)

---

## 🧩 Behavior Rules

### Segment Transitions

* Automatically move to next segment when time reaches 0
* Allow manual override via keyboard

### Pause

* Freezes timer without losing elapsed time

### Overtime

* Do NOT auto-advance immediately
* Allow configurable grace period (future enhancement)

---

## ⚡ Tech Stack & Performance Constraints

* **Runtime**: Tauri v2 native desktop app (Rust backend + WebView frontend)
* **Frontend**: Vanilla TypeScript + Vite (no UI framework)
* **Target**: `x86_64-pc-windows-gnu` (MinGW/GNU toolchain)
* **Dependencies**: minimal — `@tauri-apps/cli`, `vite`, `typescript` only
* Must run smoothly fullscreen on a secondary monitor
* Avoid heavy frameworks unless justified

---

## 🧼 Code Style Guidelines

* Keep functions small and readable
* Prefer explicit naming over clever abstractions
* Avoid over-engineering
* No unnecessary state management libraries

Structure:

```
/src
  /core       → timer logic, state
  /ui         → rendering
  /models     → types
  /data       → sample timelines
```

---

## 🧪 Example Timeline

```json
{
  "segments": [
    {
      "title": "Welcome & Framing",
      "duration": 600,
      "type": "lecture"
    },
    {
      "title": "Copilot Fundamentals",
      "duration": 1500,
      "type": "lecture"
    }
  ]
}
```

---

## 🚫 Anti-Goals

Do NOT implement:

* Complex configuration UIs
* Authentication
* Backend services
* Real-time collaboration
* Fancy animations

This is a **focused single-user tool**.

---

## 🔮 Future Extensions (do not implement yet)

* Catch-up mode (schedule drift detection)
* Presenter notes overlay
* Import from PDF / agenda
* Analytics (timing patterns)
* Hardware integrations (external displays, dials)

---

## 🧠 Copilot Guidance

When generating code:

* Prioritize **clarity over abstraction**
* Prefer **working MVP** over extensible architecture
* Keep UI **minimal and distraction-free**
* Avoid adding features not explicitly requested

If unsure:
→ Choose the simplest implementation that preserves correctness and readability

---

## 🏁 Definition of Done (MVP)

The app is complete when:

* A timeline JSON can be loaded
* The timer runs accurately
* Segments transition correctly
* The UI is readable at a glance from a distance
* The presenter can run it fullscreen on a second monitor without interaction

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

