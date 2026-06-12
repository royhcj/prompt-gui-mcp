# Prompt Timeout + Wait-For-Prompt Implementation Plan

## 1. Goal

Implement the timeout/keep-waiting workflow from [timeout.md](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/docs/timeout.md) so the coding agent can continue waiting safely beyond short host timeouts, while still enforcing a hard max wait.

Outcome:
- prompt tools return `keep-waiting` after 30 seconds when user input is not ready
- coding agent can call `wait-for-prompt(promptUuid)` repeatedly
- user replies are delivered to the next `wait-for-prompt` call (including the gap case)
- default timeout is 5 minutes
- frontend shows `timeout in XX s` during the final 60 seconds
- user can extend once to 10 minutes total via `Keep waiting`
- after `timeout`, the coding agent stops waiting and continues work

## 2. Scope

In scope:
- MCP contract updates for `tell-human-to-do` and `prompt-form`
- new MCP tool `wait-for-prompt`
- backend prompt lifecycle state machine and timer behavior
- backend handling for gap between `keep-waiting` and next wait call
- backend timeout + terminal result delivery rules
- desktop countdown and `Keep waiting` interaction
- backend API support for wait extension from desktop
- simulation/tooling updates for local verification

Out of scope:
- persistent storage across process restarts
- configurable timeout policy per request in this iteration
- major UI redesign beyond the countdown/extend affordance

## 3. Dependencies

Primary spec:
- [timeout.md](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/docs/timeout.md)

Related existing implementation/docs:
- [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts)
- [apps/backend/src/index.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/index.ts)
- [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts)
- [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts)
- [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte)
- [apps/desktop/src/lib/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/types.ts)
- [apps/desktop/src/lib/api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts)

## 4. Implementation Strategy

Implement in this order:
1. define response/state contracts first
2. implement backend wait lifecycle and timing logic second
3. register `wait-for-prompt` MCP tool third
4. expose extension action and state metadata to desktop fourth
5. add frontend countdown/extend UI fifth
6. verify gap and timeout edge cases last

Reasoning:
- backend lifecycle semantics are the hard part and should stabilize before UI wiring
- frontend countdown depends on backend-provided deadline metadata
- the new MCP tool is simple once lifecycle primitives exist

## 5. Planned Changes

## 5.1 Types And Contracts

Files:
- [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts)
- [apps/desktop/src/lib/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/types.ts)

Plan:
- add a `promptUuid` field to human-facing task types
- add wait metadata needed by desktop countdown (for example `deadlineAt`, `maxWaitMs`, `extensionUsed`)
- define backend result union for MCP responses: `keep-waiting`, `timeout`, and terminal user results
- define `wait-for-prompt` input/output types

Expected outcome:
- both backend and frontend can reason about the same wait lifecycle data
- MCP responses are explicit and type-safe

## 5.2 Backend Prompt Lifecycle

Files:
- [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts)
- [apps/backend/src/services/runtime.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/runtime.ts)

Plan:
- extend queue internals to track per-prompt wait state (`promptUuid`, timers, deadline, extension flag)
- implement 30-second keep-waiting cadence
- implement 5-minute default timeout and 10-minute one-time extension behavior
- model explicit states: waiting for user, waiting for agent (`wait-for-prompt`), completed, timed-out
- implement pending terminal buffering so user reply/timeout during the gap is stored and delivered on next `wait-for-prompt`
- enforce one outstanding wait call per prompt UUID
- ensure terminal results are consumed exactly once

Expected outcome:
- correct loop behavior across long waits
- no reply is lost or sent to the wrong tool call

## 5.3 MCP Tool Layer

Files:
- [apps/backend/src/mcp/tell-human-to-do.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/mcp/tell-human-to-do.ts)
- [apps/backend/src/mcp/prompt-form.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/mcp/prompt-form.ts)
- new `apps/backend/src/mcp/wait-for-prompt.ts`
- [apps/backend/src/index.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/index.ts)

Plan:
- update prompt-creating tools to return the new wait-aware result union
- add `wait-for-prompt` schema and handler (`promptUuid` input)
- register `wait-for-prompt` in backend MCP server setup
- keep `content` + `structuredContent` response pattern consistent

Expected outcome:
- coding agent can reliably re-enter waiting via tool calls
- timeout and keep-waiting are first-class MCP outcomes

## 5.4 HTTP Transport And Desktop Control API

Files:
- [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts)

Plan:
- keep existing `/api/state` and `/api/events` shape compatible while adding new wait metadata fields
- add a new desktop action endpoint for extending wait once (for example `POST /api/tasks/:id/extend-wait`)
- validate extension request against active task, deadline state, and one-time-use rule
- return clear `400` errors for invalid extension attempts

Expected outcome:
- desktop can trigger extension without abusing submit endpoint
- countdown state remains synchronized through existing state streaming

## 5.5 Desktop UI Countdown And Extend

Files:
- [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte)
- [apps/desktop/src/lib/api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts)
- [apps/desktop/src/styles/app.css](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/styles/app.css)

Plan:
- derive remaining seconds from backend deadline metadata
- show `timeout in XX s` only in final 60 seconds
- render `Keep waiting` as underlined text button to the right, visible only when countdown is visible and extension is still available
- call backend extend endpoint on click
- keep existing submit/cancel behavior unchanged

Expected outcome:
- users see imminent timeout clearly
- extension action is lightweight and aligned with spec

## 5.6 Simulation And Developer Workflow

Files:
- [apps/backend/scripts/simulate-tool-call.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/scripts/simulate-tool-call.ts)

Plan:
- add simulation path for `wait-for-prompt`
- add example output handling for `keep-waiting` and `timeout`
- keep existing `tell-human-to-do` and `prompt-form` simulation flow usable

Expected outcome:
- local verification of waiting loops is practical

## 6. Validation And Testing Plan

Minimum verification:
- initial prompt call returns `keep-waiting` at ~30s when no user reply
- repeated `wait-for-prompt` continues loop with the same `promptUuid`
- user reply before first keep-waiting returns terminal user result
- user reply during keep-waiting gap is buffered and returned on next `wait-for-prompt`
- timeout at 5 minutes returns terminal `timeout`
- after timeout, additional `wait-for-prompt` for same prompt is rejected as resolved
- countdown appears only in final 60 seconds
- extension updates deadline to 10 minutes total and is accepted only once

Recommended extra checks:
- timeout occurs during gap and is delivered on next `wait-for-prompt`
- concurrent `wait-for-prompt` calls for same UUID are rejected
- SSE reconnect preserves countdown behavior without duplicate timers

## 7. Rollout Order

Recommended implementation order:
1. update backend/frontend types for wait metadata and result unions
2. implement backend lifecycle/timer state in [task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts)
3. add and register `wait-for-prompt`
4. add extension endpoint in [http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts)
5. update desktop bridge in [api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts)
6. add countdown + extend controls in [App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte)
7. polish styles in [app.css](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/styles/app.css)
8. run manual end-to-end timing and edge-case verification

## 8. Risks And Mitigations

Risk: race conditions around gap buffering and terminal delivery.
Mitigation: centralize state transitions in one queue/service path and enforce single-consumer semantics for terminal results.

Risk: timer drift or duplicate timers after reconnects.
Mitigation: use backend absolute timestamps (`deadlineAt`) as source of truth and keep frontend countdown display-only.

Risk: contract ambiguity for coding agents.
Mitigation: keep `keep-waiting` and `timeout` payloads explicit and include `promptUuid` in every related response.

Risk: extension button abused or shown outside intended window.
Mitigation: guard both backend and frontend with one-time-use and visibility checks tied to deadline window.

## 9. Done Criteria

This feature is done when:
- prompt tools and `wait-for-prompt` implement the wait loop contract from [timeout.md](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/docs/timeout.md)
- gap behavior is correct and tested
- default timeout and one-time extension behavior match spec
- desktop countdown and extend action are visible and functional
- coding agent receives terminal `timeout` and can stop waiting for that prompt
