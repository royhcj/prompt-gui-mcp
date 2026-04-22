# Prompt Timeout + Wait-For-Prompt Tasks

## 1. Types And Contract Tasks

- [ ] Add wait lifecycle fields (`promptUuid`, deadline metadata, extension flag) to backend task types in [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts).
- [ ] Mirror wait lifecycle fields in desktop shared types in [apps/desktop/src/lib/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/types.ts).
- [ ] Add typed result unions for `keep-waiting` and `timeout` responses in [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts).
- [ ] Add `wait-for-prompt` input/output types in [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts).

## 2. Backend Queue/Lifecycle Tasks

- [ ] Refactor [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts) to track per-prompt waiting state and timers.
- [ ] Generate and store `promptUuid` for each new prompt task in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts).
- [ ] Implement 90-second keep-waiting tick behavior in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts).
- [ ] Implement default 5-minute timeout and terminal timeout result behavior in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts).
- [ ] Implement one-time extension to 10 minutes total in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts).
- [ ] Implement gap buffering: store user reply/timeout when no wait call is open, and return it on next `wait-for-prompt`, in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts).
- [ ] Enforce single concurrent waiter per `promptUuid` in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts).
- [ ] Ensure terminal results are consumed exactly once in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts).
- [ ] Confirm [apps/backend/src/services/runtime.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/runtime.ts) exports remain correct for new queue methods.

## 3. MCP Tool Tasks

- [ ] Update [apps/backend/src/mcp/tell-human-to-do.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/mcp/tell-human-to-do.ts) to return wait-aware responses with `promptUuid`.
- [ ] Update [apps/backend/src/mcp/prompt-form.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/mcp/prompt-form.ts) to return wait-aware responses with `promptUuid`.
- [ ] Add new MCP handler file `apps/backend/src/mcp/wait-for-prompt.ts` with schema validation for `promptUuid`.
- [ ] Register `wait-for-prompt` in [apps/backend/src/index.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/index.ts).
- [ ] Ensure all three tools return `content` + `structuredContent` consistently in [apps/backend/src/index.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/index.ts).

## 4. HTTP Transport Tasks

- [ ] Update [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts) to include wait metadata in `/api/state` and `/api/events` payloads.
- [ ] Add a desktop extension endpoint (for example `POST /api/tasks/:id/extend-wait`) in [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts).
- [ ] Validate extension requests (active task, not timed out, extension not already used) in [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts).
- [ ] Return explicit `400` errors for invalid extension attempts in [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts).

## 5. Desktop Bridge And UI Tasks

- [ ] Add an API method to request wait extension in [apps/desktop/src/lib/api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts).
- [ ] Expose the new method in `DesktopBridge` type in [apps/desktop/src/lib/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/types.ts).
- [ ] In [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte), derive remaining seconds from backend deadline metadata.
- [ ] Render `timeout in XX s` only when remaining time is <= 60 seconds in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [ ] Render `Keep waiting` as underlined text on the right side of countdown in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [ ] Wire `Keep waiting` click to extension API call in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [ ] Hide/disable `Keep waiting` when extension was already used in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [ ] Add countdown/extend styles in [apps/desktop/src/styles/app.css](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/styles/app.css).

## 6. Logging And Error Handling Tasks

- [ ] Add structured logs for keep-waiting emissions and timeout transitions in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts).
- [ ] Add structured logs for `wait-for-prompt` calls and invalid prompt UUID errors in `apps/backend/src/mcp/wait-for-prompt.ts`.
- [ ] Ensure logs do not include raw prompt-form answer values across backend files.

## 7. Simulation Tasks

- [ ] Update [apps/backend/scripts/simulate-tool-call.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/scripts/simulate-tool-call.ts) to support invoking `wait-for-prompt`.
- [ ] Add a simulation scenario showing `keep-waiting` loop behavior in [apps/backend/scripts/simulate-tool-call.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/scripts/simulate-tool-call.ts).
- [ ] Add a simulation scenario showing terminal `timeout` behavior in [apps/backend/scripts/simulate-tool-call.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/scripts/simulate-tool-call.ts).

## 8. Verification Tasks

- [ ] Verify prompt creation responses include `promptUuid`.
- [ ] Verify `keep-waiting` is returned after 90 seconds when user has not replied.
- [ ] Verify `wait-for-prompt(promptUuid)` continues waiting loop and returns repeated `keep-waiting` until terminal outcome.
- [ ] Verify user reply before first keep-waiting returns terminal user result.
- [ ] Verify user reply during keep-waiting gap is returned by the next `wait-for-prompt` call.
- [ ] Verify timeout at 5 minutes returns terminal `timeout`.
- [ ] Verify coding agent behavior expectation is documented and respected: after `timeout`, it stops waiting for that prompt.
- [ ] Verify countdown text appears in final 60 seconds and updates every second.
- [ ] Verify `Keep waiting` extends max wait to 10 minutes total and can only be used once.
- [ ] Verify timeout during gap is buffered and returned on next `wait-for-prompt`.
- [ ] Verify invalid `promptUuid` returns clear errors.
- [ ] Verify concurrent `wait-for-prompt` calls for same prompt are rejected.
