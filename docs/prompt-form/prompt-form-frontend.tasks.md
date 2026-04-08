# Prompt Form Frontend Tasks

## 1. Type And Bridge Tasks

- [x] Update [apps/desktop/src/lib/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/types.ts) to support `kind`-discriminated task unions.
- [x] Add prompt-form field and option types to [apps/desktop/src/lib/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/types.ts).
- [x] Replace the current single-shape `SubmitTaskResult` with a discriminated union in [apps/desktop/src/lib/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/types.ts).
- [x] Update [apps/desktop/src/lib/api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts) so `submitTaskResult()` accepts both task kinds without changing the endpoint.
- [x] Confirm [apps/desktop/src/lib/api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts) still handles SSE reconnects cleanly with the new state shape.

## 2. App Rendering Tasks

- [x] Refactor [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte) to branch on `activeTask.kind`.
- [x] Keep the existing empty state path unchanged in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Preserve the existing `tell-human-to-do` UI path in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Add a prompt-form rendering path in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).

## 3. Prompt Form State Tasks

- [x] Add local `formValues` state in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Add local `fieldErrors` state in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Initialize prompt-form values from field defaults when a new task id becomes active in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Clear prompt-form state when the active task disappears or changes to a different task id in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Ensure same-task SSE updates do not wipe in-progress human input in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).

## 4. Field Rendering Tasks

- [x] Render prompt-form `title` and optional markdown `description` in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Render `markdown` fields using [Markdown.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/Markdown.svelte).
- [x] Render `text` fields in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Render `textarea` fields in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Render `radio` fields in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Render `select` fields in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Keep the shared bottom feedback textarea in the prompt-form UI in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).

## 5. Validation And Submission Tasks

- [x] Add required-field validation for `text`, `textarea`, `radio`, and `select` in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Render inline field-level validation errors in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Build prompt-form `values` from interactive fields only in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Normalize empty optional prompt-form fields to `null` before submit in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Submit prompt-form `submitted` payloads through [apps/desktop/src/lib/api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts).
- [x] Submit prompt-form `cancelled` payloads without required-field validation in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).
- [x] Preserve current error handling for failed HTTP submissions in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte).

## 6. Interaction And Styling Tasks

- [x] Update [apps/desktop/src/styles/app.css](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/styles/app.css) with prompt-form layout styles.
- [x] Add styles for inline help text, field groups, and validation errors in [apps/desktop/src/styles/app.css](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/styles/app.css).
- [x] Ensure long prompt forms scroll cleanly within the existing shell in [apps/desktop/src/styles/app.css](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/styles/app.css).
- [x] Verify existing themes still style the new controls legibly in [apps/desktop/src/styles/app.css](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/styles/app.css).
- [x] Review keyboard shortcuts in [apps/desktop/src/App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte) so prompt-form submit/cancel behavior does not conflict with textarea input.

## 7. Verification Tasks

- [ ] Verify the empty state still appears with no active task.
- [ ] Verify `tell-human-to-do` still renders and submits correctly.
- [ ] Verify prompt-form renders all supported v1 field types.
- [ ] Verify missing required fields block `Submit` and show inline errors.
- [ ] Verify `Cancel` submits successfully even when required fields are blank.
- [ ] Verify prompt-form submission sends `kind`, `status`, `feedback`, and `values`.
- [ ] Verify moving from one task to another clears stale prompt-form input.
- [ ] Verify reconnect behavior does not wipe input for the same active task.
