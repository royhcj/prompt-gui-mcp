# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What This Project Is

**prompt-gui-mcp** is a monorepo implementing an MCP (Model Context Protocol) server with a Tauri desktop companion app. It lets AI agents delegate real-world tasks to humans via two MCP tools:
- `tell-human-to-do` — ask the human to complete a task and return status + feedback
- `prompt-form` — display a structured form to collect validated user input

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev:desktop:app      # Full Tauri dev (frontend + sidecar backend)
pnpm dev:backend          # Backend only (MCP + HTTP server on port 43118)
pnpm dev:desktop          # Vite dev server only (no Tauri shell)

# Build
pnpm build                # Build all packages

# Test / Simulate
pnpm simulate             # Run desktop app + backend tool-call simulator
pnpm simulate:backend     # Backend simulator only (no desktop)

# Type checking
pnpm --filter backend check   # TypeScript check (backend)
pnpm --filter desktop check   # Svelte type check (desktop)
```

## Architecture

### Monorepo Structure
- `apps/backend/` — Node.js + TypeScript MCP server
- `apps/desktop/` — Svelte + Vite frontend + Tauri v2 Rust shell

### Data Flow

```
MCP Host → (stdio) → Backend → HTTP API ↔ Desktop UI → User
                         ↓          ↓           ↓
                    Queue Task   SSE Stream   Form/Text
                         ↑          ↑           ↓
                    Resolve     HTTP POST ← User Input
```

### Backend (`apps/backend/src/`)

| File | Role |
|------|------|
| `index.ts` | Entry point — creates MCP server, starts HTTP on port 43118 |
| `mcp/tell-human-to-do.ts` | MCP tool — validates and enqueues simple instruction task |
| `mcp/prompt-form.ts` | MCP tool — validates form schema (Zod), enqueues structured form task |
| `services/task-queue.ts` | Core state machine — single active task + queue, Promise-based resolution |
| `services/runtime.ts` | Singleton `taskQueue` instance |
| `transport/http.ts` | HTTP API: `GET /api/state`, `GET /api/events` (SSE), `POST /api/tasks/:id/result`, `POST /mcp` |

The task queue is Promise-based: `enqueue()` returns a Promise that resolves when the user submits a result.

### Desktop (`apps/desktop/src/`)

| File | Role |
|------|------|
| `App.svelte` | Main UI — renders active task, keyboard shortcuts, theme switching |
| `lib/api.ts` | `DesktopBridge` — abstracts HTTP vs. Tauri command invocation |
| `lib/types.ts` | Shared task/form/result types |
| `lib/Markdown.svelte` | Renders markdown with syntax highlighting |

The bridge in `lib/api.ts` uses Tauri command invocation when running in the Tauri shell (`window.__TAURI__`), falling back to direct HTTP for browser/dev.

### Tauri Shell (`apps/desktop/src-tauri/src/main.rs`)

- Spawns the Node.js backend as a **sidecar** process
- Polls backend state every 500ms — auto-shows window when an active task appears
- Window is always-on-top, transparent titlebar, 280×400px
- Close button hides the window instead of quitting (`prevent_close`)
- Exposes Tauri commands: `get_backend_origin`, `set_window_theme`, `resize_window_to_content`, `present_window`, `hide_window`, `open_url`

### Sidecar Build

`apps/desktop/scripts/prepare-sidecar.mjs` builds the backend and copies the Node.js binary as `src-tauri/bin/prompt-gui-mcp-node-{target}` for the current platform. This runs automatically before `tauri:dev` and `tauri:build`.

## Key Config

- Backend HTTP port: `I_AM_MCP_SERVER_PORT` env var (default `43118`)
- Vite backend override: `VITE_I_AM_MCP_BACKEND_ORIGIN`
- Tauri config: `apps/desktop/src-tauri/tauri.conf.json` — window size, sidecar path, frontend dist
