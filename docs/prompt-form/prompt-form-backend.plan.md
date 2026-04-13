# Prompt Form Backend Implementation Plan

## 1. Goal

Implement backend support for the new MCP tool `prompt-form` without breaking the existing `tell-human-to-do` flow.

The backend outcome should be:
- the MCP server exposes `prompt-form`
- the backend validates and queues form tasks
- the desktop receives prompt-form tasks through the existing state and SSE endpoints
- the backend accepts prompt-form submissions and resolves the original MCP call
- both task kinds share one queue and one HTTP control API

## 2. Scope

In scope:
- MCP tool registration
- input schema validation
- shared backend type changes
- queue generalization for multiple task kinds
- HTTP submit contract update
- logging and error handling updates
- backend simulation updates if they rely on tool names or payload shape

Out of scope:
- frontend rendering
- persistence beyond process lifetime
- dynamic conditional forms
- new transport endpoints

## 3. Dependencies

This backend plan depends on the agreed contracts in:
- [prompt-form-design.md](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/docs/prompt-form/prompt-form-design.md)
- [prompt-form-backend.md](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/docs/prompt-form/prompt-form-backend.md)

The backend should land before or together with the frontend changes because the frontend types mirror backend state.

## 4. Implementation Strategy

Implement this in small, reversible steps:

1. Generalize types first.
2. Generalize queue behavior second.
3. Add `prompt-form` MCP registration and handler third.
4. Extend HTTP submission validation fourth.
5. Update any simulation or development scripts last.

Reasoning:
- type and queue changes are the real architectural change
- tool registration is straightforward once the queue can store the new task kind
- the HTTP layer should validate the new result shape only after internal types are stable

## 5. Planned Changes

## 5.1 Shared Backend Types

Files:
- [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts)

Plan:
- replace the single `HumanTask` shape with a discriminated union by `kind`
- add `PromptFormOption`, `PromptFormField`, `PromptFormDefinition`, `PromptFormTask`, and `PromptFormResult`
- change `SubmitTaskResult` from one fixed result type into a discriminated union
- keep `HumanTaskState` stable so `/api/state` and `/api/events` remain unchanged structurally

Expected outcome:
- backend internals and the frontend bridge can branch on `task.kind`
- submission payloads become explicit per task kind

## 5.2 Queue Generalization

Files:
- [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts)
- [apps/backend/src/services/runtime.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/runtime.ts)

Plan:
- keep one queue and one active task
- introduce separate enqueue entry points for `tell-human-to-do` and `prompt-form`
- store pending tasks as a union that carries both render data and a resolver
- update `submit()` so it checks the active task kind and resolves the matching result type
- preserve current queue order and task activation behavior

Expected outcome:
- both tools can coexist safely without duplicated queue logic
- invalid cross-kind submissions fail fast

## 5.3 Prompt Form Schema And MCP Handler

Files:
- `apps/backend/src/mcp/prompt-form.ts`
- [apps/backend/src/index.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/index.ts)

Plan:
- create a `zod` schema for top-level prompt-form input
- use a discriminated union for field schemas
- add cross-field validation for duplicate ids and invalid defaults
- normalize `submitLabel` and `cancelLabel`
- log task metadata without logging sensitive field values
- register the new MCP tool in the backend server

Expected outcome:
- the MCP layer rejects malformed prompt-form payloads before queueing
- the tool returns structured content with `status`, `feedback`, and `values`

## 5.4 HTTP Transport Update

Files:
- [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts)

Plan:
- keep `/api/state` and `/api/events` routes unchanged
- update `/api/tasks/:id/result` to accept the discriminated union submit payload
- validate request bodies before passing them into `taskQueue.submit()`
- include clear `400` errors for kind mismatch, missing `values`, or invalid status values

Expected outcome:
- the desktop can submit either task kind over the same endpoint
- malformed payloads do not corrupt queue state

## 5.5 Development Script Updates

Files:
- [apps/backend/scripts/simulate-tool-call.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/scripts/simulate-tool-call.ts)
- any script that hardcodes `tell-human-to-do` assumptions

Plan:
- confirm existing simulation still works for `tell-human-to-do`
- optionally add a `prompt-form` simulation path if useful for local testing

Expected outcome:
- local development remains practical after the new tool lands

## 6. Validation And Testing Plan

Minimum validation to implement:
- top-level `prompt-form` schema validation with `zod`
- duplicate field id rejection
- invalid option/default combinations rejected
- HTTP result payload validation for both task kinds
- active task kind mismatch rejection

Recommended test coverage:
- schema parse success for a valid prompt-form payload
- schema parse failure for duplicate field ids
- schema parse failure for invalid `defaultValue` in `radio` or `select`
- queue can hold both `tell-human-to-do` and `prompt-form` tasks in order
- submitting a prompt-form result resolves the right pending task
- submitting the wrong kind for the active task returns an error

If the repo currently has no backend test harness, at minimum run:
- build
- existing simulation for `tell-human-to-do`
- manual `prompt-form` simulation against the HTTP and desktop flow

## 7. Rollout Order

Recommended implementation order:
1. update [types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts)
2. refactor [task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts)
3. add `apps/backend/src/mcp/prompt-form.ts`
4. register the tool in [index.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/index.ts)
5. update [http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts)
6. update simulation scripts if needed
7. verify `tell-human-to-do` still works
8. hand off to frontend implementation

## 8. Risks And Mitigations

Risk: queue refactor breaks existing `tell-human-to-do` behavior.
Mitigation: keep one queue model, preserve current semantics, and verify the old flow after each major change.

Risk: type drift between backend and frontend.
Mitigation: keep task/result unions narrow and mirror them exactly in frontend types until shared packages exist.

Risk: malformed prompt-form payloads become runtime rendering bugs.
Mitigation: reject invalid forms in the MCP handler rather than letting them reach the desktop.

Risk: sensitive form values appear in logs.
Mitigation: log field ids and counts, not field contents.

## 9. Done Criteria

The backend portion is complete when:
- `prompt-form` is registered and callable
- valid prompt-form inputs are queued and exposed via existing state endpoints
- invalid prompt-form inputs are rejected before enqueueing
- prompt-form results can be submitted through `/api/tasks/:id/result`
- MCP receives `status + feedback + values`
- `tell-human-to-do` continues to work without contract changes
