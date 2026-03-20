# CuePilot (codename: goldfish) — Copilot Instructions

## 🧭 Project Overview

CuePilot is a **glanceable presentation timing assistant** designed for instructors delivering structured sessions.

It runs as a **web app** on a secondary screen and provides real-time situational awareness:

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
interface Segment {
  title: string;
  duration: number; // seconds
  type?: "lecture" | "demo" | "break";
  notes?: string[];
}

interface Timeline {
  segments: Segment[];
}
```

Runtime state:

```ts
interface AppState {
  currentSegmentIndex: number;
  segmentStartTime: number;
  isPaused: boolean;
  pausedAt?: number;
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

### Layout (single screen, fullscreen)

Top:

* Current segment title (large, bold)

Center:

* Countdown timer (very large, dominant)

Below:

* Progress bar (visual only)

Bottom:

* Next segment (single line)

Optional (small text):

* Total remaining time

---

### Color System

Use color to communicate state:

* Green → on track
* Yellow → last 20% of segment
* Red → overtime

Segment type accents:

* Lecture → blue
* Demo → purple
* Break → neutral/gray

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

## ⚡ Performance Constraints

* Must run smoothly in a browser tab on a secondary monitor
* Avoid heavy frameworks unless justified
* Prefer:

  * Vanilla TypeScript
  * Minimal dependencies

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

## 🐟 Codename

Internal codename: **goldfish**

Use in:

* variable names (e.g., `goldfishState`)
* internal comments if helpful

Do NOT expose in UI.

