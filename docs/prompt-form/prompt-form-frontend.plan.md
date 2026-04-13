# Prompt Form Frontend Implementation Plan

## 1. Goal

Implement desktop support for rendering and submitting `prompt-form` tasks while preserving the current `tell-human-to-do` experience.

The frontend outcome should be:
- the desktop app renders task UI by `task.kind`
- prompt-form tasks render a dynamic form from backend state
- required fields validate before submit
- `Cancel` submits a structured cancellation result
- the shared bottom feedback field remains part of the flow

## 2. Scope

In scope:
- frontend type updates to match backend task and result unions
- task-kind-based rendering in the main app
- local form state initialization and reset behavior
- field rendering for `markdown`, `text`, `textarea`, `radio`, and `select`
- field-level validation and error display
- prompt-form submission and cancellation behavior
- styling needed to keep the new UI usable and consistent

Out of scope:
- backend tool registration
- conditional fields
- reusable component extraction beyond what is needed for readability
- visual redesign unrelated to prompt-form

## 3. Dependencies

This frontend plan depends on the contracts in:
- [prompt-form-design.md](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/docs/prompt-form/prompt-form-design.md)
- [prompt-form-frontend.md](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/docs/prompt-form/prompt-form-frontend.md)
- backend task/result unions being stable enough to mirror in frontend types

The frontend can be developed against mock state before backend is fully finished, but final verification depends on the backend contract landing.

## 4. Implementation Strategy

Implement the frontend in layers:

1. update frontend types and bridge payloads
2. split rendering by `task.kind`
3. add local prompt-form state and initialization
4. render field types in order
5. add validation and submit/cancel behavior
6. refine keyboard behavior and styling

Reasoning:
- type changes make the rest of the UI work predictable
- rendering branch first keeps `tell-human-to-do` isolated from prompt-form logic
- field rendering should exist before validation so the error model can target real UI

## 5. Planned Changes

## 5.1 Frontend Type Updates

Files:
- [apps/desktop/src/lib/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/types.ts)
- [apps/desktop/src/lib/api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts)

Plan:
- replace the single `HumanTask` shape with a union by `kind`
- add prompt-form field and option types
- change `SubmitTaskResult` to a union with prompt-form payload support
- keep the bridge API surface area stable

Expected outcome:
- the app can consume backend state without unsafe casting
- the HTTP bridge can submit either task kind

## 5.2 App-Level Rendering Split

Files:
- [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte)

Plan:
- preserve the empty state when there is no active task
- preserve the existing tell-human-to-do rendering path
- add a second rendering path for `prompt-form`
- ensure task changes reset form state and feedback state correctly

Expected outcome:
- prompt-form logic does not contaminate the tell-human-to-do path
- the app remains easy to reason about during future feature additions

## 5.3 Prompt Form State Initialization

Files:
- [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte)

Plan:
- introduce local `formValues` and `fieldErrors` state
- initialize values from field defaults when a new prompt-form task becomes active
- clear stale values when task id changes or the active task disappears
- preserve user edits while the same task remains active

Expected outcome:
- new tasks start from clean defaults
- reconnects or unrelated state updates do not wipe in-progress form input

## 5.4 Field Rendering

Files:
- [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte)
- optional new component files if extraction is justified

Plan:
- render prompt-form title and optional description
- render `markdown` via the existing markdown component
- render native inputs for `text`, `textarea`, `radio`, and `select`
- render labels, help text, and required indicators consistently
- keep the shared bottom feedback field below the dynamic form body

Expected outcome:
- the desktop can display all v1 prompt-form field types defined in the design doc

## 5.5 Validation And Submission

Files:
- [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte)
- [apps/desktop/src/lib/api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts)

Plan:
- validate required fields on `Submit`
- skip required-field validation on `Cancel`
- build `values` from interactive fields only
- normalize optional empty fields to `null`
- preserve existing submission error handling
- ensure the right payload shape is posted for each task kind

Expected outcome:
- prompt-form tasks return structured values reliably
- cancellation remains lightweight for the human user

## 5.6 Styling And Interaction Refinement

Files:
- [apps/desktop/src/styles/app.css](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/styles/app.css)
- [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte)

Plan:
- add styles for prompt-form layout, fields, help text, and inline errors
- ensure long forms scroll inside the shell cleanly
- keep theme compatibility for the new controls
- preserve keyboard shortcuts where they still make sense
- avoid accidental submit behavior inside multiline text areas

Expected outcome:
- the new UI feels like part of the existing app instead of a bolted-on screen

## 6. Validation And Testing Plan

Minimum verification:
- no active task still shows the empty state
- `tell-human-to-do` still renders and submits correctly
- prompt-form task renders each supported field type correctly
- required field errors appear only when needed
- `Submit` sends a prompt-form payload with `values`
- `Cancel` sends a prompt-form payload with null values and optional feedback
- changing to a new task resets stale prompt-form state

Recommended test scenarios:
- prompt-form with only markdown + one radio field
- prompt-form with text and textarea defaults
- prompt-form with a select placeholder and no default
- submit with missing required fields
- cancel with partially filled fields
- reconnect while editing the same task

## 7. Rollout Order

Recommended implementation order:
1. update [types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/types.ts)
2. update [api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts)
3. refactor [App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte) to branch on `task.kind`
4. add prompt-form local state and initialization
5. render v1 field types
6. add validation and prompt-form submission behavior
7. update [app.css](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/styles/app.css)
8. verify both task kinds manually end-to-end

## 8. Risks And Mitigations

Risk: `App.svelte` becomes too large and brittle.
Mitigation: extract field rendering into a component if the branching becomes noisy.

Risk: SSE reconnects wipe in-progress user input.
Mitigation: reset state only when task id changes, not on every state update.

Risk: frontend payload shape drifts from backend expectations.
Mitigation: keep union types aligned exactly and verify with a real backend response.

Risk: keyboard shortcuts conflict with multiline editing.
Mitigation: reserve submit shortcuts for explicit modifier combinations.

## 9. Done Criteria

The frontend portion is complete when:
- prompt-form tasks render correctly from backend state
- supported fields are interactive and validated
- submit and cancel produce the expected payloads
- tell-human-to-do still works unchanged for the user
- new styles are usable across existing themes
