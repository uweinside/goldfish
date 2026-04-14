# CuePilot (codename: goldfish)

A **glanceable presentation timing assistant** for instructors delivering structured sessions. Built as a Tauri v2 native desktop app optimized for secondary monitors.

## What It Does

CuePilot provides real-time situational awareness during presentations:

- **Where am I?** — Current chapter and section
- **How much time?** — Countdown timer with overtime tracking
- **What's next?** — Upcoming section preview
- **Am I on track?** — Schedule drift indicator

The UI is designed for **<1 second visual parsing** with **zero cognitive overhead**.

## Screenshots

| Course Selection | Timer View | Course Editor |
|------------------|------------|---------------|
| Grid of available courses from local storage and GitHub | Two-panel glanceable timer with instructions | Three-panel editor for authoring courses |

## Project Structure

```
goldfish/
├── index.html              # Course selection page
├── timer.html              # Presentation timer page
├── editor.html             # Course authoring page
├── vite.config.ts          # Vite multi-page config
├── package.json            # Dependencies and scripts
├── course.schema.json      # Course file JSON schema
│
├── src/                    # TypeScript application code
│   ├── start.ts            # Course selection logic
│   ├── main.ts             # Timer page logic
│   ├── editor.ts           # Course editor logic
│   ├── models/
│   │   ├── types.ts        # Core data types (Timeline, Chapter, Section, AppState)
│   │   └── course-authoring.ts  # Backend API types
│   ├── core/
│   │   ├── state.ts        # Mutable app state management
│   │   ├── timer.ts        # Pure time calculation functions
│   │   ├── data-loader.ts  # Course loading (GitHub + local)
│   │   └── course-authoring-api.ts  # Tauri IPC wrapper
│   └── ui/
│       └── renderer.ts     # DOM rendering for timer view
│
├── wwwroot/                # Static assets
│   └── css/site.css        # All styling
│
├── src-tauri/              # Tauri / Rust backend
│   ├── tauri.conf.json     # App config and window settings
│   ├── src/
│   │   ├── main.rs         # Rust entry point
│   │   ├── lib.rs          # Tauri builder setup
│   │   ├── commands.rs     # IPC command handlers
│   │   ├── course_model.rs # Course data structures
│   │   └── course_store.rs # File I/O operations
│   └── courses/            # Local course storage
│
└── courses/                # Development course files (Vite-served)
```

## Getting Started

### Prerequisites

- Node.js 18+
- Rust toolchain (rustup with `x86_64-pc-windows-gnu` target)
- Tauri CLI

### Setup

```bash
npm install
```

### Development

Launch the app with hot-reload:

```bash
npm run tauri:dev
```

This starts Vite dev server on `localhost:1420` and launches the Tauri native window.

### Build

Create a production executable:

```bash
npm run tauri:build
```

Outputs to `src-tauri/target/release/`.

## Features

### Timer View

- **Large countdown timer** — primary visual element
- **Progress bar** — visual segment completion
- **Color-coded states** — green (on track), yellow (wrapping up), red (overtime)
- **Schedule drift indicator** — shows ahead/behind schedule
- **Right panel** — instructions and talking points for current section
- **Keyboard controls** — Space (pause), ←/→ (navigate chapters)

### Course Editor

- **Three-panel layout** — Chapters | Sections | Section Details
- **Drag-and-drop reordering** — powered by SortableJS
- **Auto-save** — changes persist via Tauri backend
- **Validation** — enforces schema constraints

### Course Sources

- **Local courses** — stored in `src-tauri/courses/`, managed by Rust backend
- **GitHub courses** — fetched from `uweinside/goldfish-data` repository

## Data Model

```typescript
interface Section {
  title: string;
  type: 'Narration' | 'Demo' | 'Prompt' | 'Rule';
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

## Keyboard Shortcuts (Timer)

| Key | Action |
|-----|--------|
| `Space` | Pause / Resume |
| `→` | Next chapter |
| `←` | Previous chapter |
| `Escape` | Close notes panel |

## Tech Stack

- **Runtime**: Tauri v2 (Rust backend + WebView frontend)
- **Frontend**: Vanilla TypeScript + Vite
- **Styling**: Custom CSS (no framework)
- **Backend**: Rust with serde for JSON handling
- **Target**: Windows (MinGW/GNU toolchain)

## License

© 2026 Uwe Baumann