# Prompt Form Backend Tasks

## 1. Type And Contract Tasks

- [x] Update [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts) to add `kind`-discriminated `HumanTask` variants for `tell-human-to-do` and `prompt-form`.
- [x] Add prompt-form type definitions for `PromptFormOption`, `PromptFormField`, `PromptFormDefinition`, and `PromptFormResult` in [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts).
- [x] Replace the existing single-shape `SubmitTaskResult` with a discriminated union in [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts).
- [x] Keep `HumanTaskState` stable while updating it to reference the new union task type in [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts).

## 2. Queue Tasks

- [x] Refactor [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts) so pending tasks can resolve either `TellHumanToDoResult` or `PromptFormResult`.
- [x] Add a dedicated `enqueueTellHumanToDo()` path in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts), or keep `enqueue()` only if its type safety remains clear after the refactor.
- [x] Add a new `enqueuePromptForm()` path in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts).
- [x] Update queue submission logic in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts) to validate active task id and task kind before resolving.
- [x] Verify [apps/backend/src/services/runtime.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/runtime.ts) needs no further changes beyond updated types and queue exports.

## 3. MCP Tool Tasks

- [x] Create `apps/backend/src/mcp/prompt-form.ts` with the new tool input schema and handler.
- [x] Define `zod` field schemas for `markdown`, `image`, `text`, `textarea`, `radio`, and `select` in `apps/backend/src/mcp/prompt-form.ts`.
- [x] Add cross-field validation for duplicate field ids in `apps/backend/src/mcp/prompt-form.ts`.
- [x] Add validation for invalid option sets and invalid `defaultValue` references in `apps/backend/src/mcp/prompt-form.ts`.
- [x] Normalize `submitLabel` and `cancelLabel` defaults in `apps/backend/src/mcp/prompt-form.ts`.
- [x] Register the `prompt-form` tool in [apps/backend/src/index.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/index.ts).
- [x] Ensure the new MCP tool returns both `content` and `structuredContent` in [apps/backend/src/index.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/index.ts).

## 4. HTTP Transport Tasks

- [x] Update request parsing in [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts) to accept prompt-form result payloads.
- [x] Validate `kind`, `status`, and `values` for prompt-form submissions in [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts).
- [x] Keep `/api/state` and `/api/events` unchanged while confirming they serialize the new union task shape correctly in [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts).
- [x] Return explicit `400` errors for invalid or mismatched prompt-form submissions in [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts).

## 5. Logging Tasks

- [x] Add tool-call logging for `prompt-form` in `apps/backend/src/mcp/prompt-form.ts`.
- [x] Include task kind in queue submission logs in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts).
- [x] Avoid logging raw prompt-form values in success or error logs across backend files.

## 6. Development And Simulation Tasks

- [x] Review [apps/backend/scripts/simulate-tool-call.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/scripts/simulate-tool-call.ts) for assumptions that only one tool exists.
- [x] Add or document a prompt-form simulation path in [apps/backend/scripts/simulate-tool-call.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/scripts/simulate-tool-call.ts) if it improves verification speed.

## 7. Verification Tasks

- [x] Build the backend after the refactor.
- [x] Verify `tell-human-to-do` still works end-to-end after the queue/type changes.
- [x] Verify a valid prompt-form request appears in `/api/state` and `/api/events`.
- [x] Verify submitting a prompt-form result resolves the MCP request with `status`, `feedback`, and `values`.
- [x] Verify invalid prompt-form schemas are rejected before queueing.
- [x] Verify invalid prompt-form result payloads return HTTP `400` without mutating queue state.
