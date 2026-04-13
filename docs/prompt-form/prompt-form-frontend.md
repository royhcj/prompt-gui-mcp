# Prompt Form Frontend Design

## 1. Scope

This document describes how the desktop app should render and submit `prompt-form` tasks.

Current frontend behavior:
- subscribes to one backend state stream
- renders one active task type with markdown instruction content
- shows one shared feedback textarea
- posts a completion payload back to the backend

`prompt-form` should extend this into a task-type-driven renderer.

## 2. Frontend Responsibilities

The desktop app must:
- detect whether the active task is `tell-human-to-do` or `prompt-form`
- render the right UI for the active task kind
- hold local form state for `prompt-form`
- validate required fields before submit
- always render the bottom feedback field
- submit the correct payload shape to the backend
- remain usable with keyboard navigation

The desktop app should not:
- invent default field values not provided by backend state
- mutate the backend-owned form schema
- attempt to repair invalid schemas that should have been rejected by the backend

## 3. State Model Changes

## 3.1 Shared Types

The current frontend types in [apps/desktop/src/lib/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/types.ts) assume one task shape. They should be expanded to a discriminated union that mirrors the backend.

Recommended model:

```ts
type PromptFormOption = {
  label: string;
  value: string;
  description?: string;
};

type PromptFormField =
  | {
      type: "markdown";
      id: string;
      content: string;
    }
  | {
      type: "text";
      id: string;
      label: string;
      helpText?: string;
      required?: boolean;
      disabled?: boolean;
      defaultValue?: string;
      placeholder?: string;
    }
  | {
      type: "textarea";
      id: string;
      label: string;
      helpText?: string;
      required?: boolean;
      disabled?: boolean;
      defaultValue?: string;
      placeholder?: string;
      rows?: number;
    }
  | {
      type: "radio";
      id: string;
      label: string;
      helpText?: string;
      required?: boolean;
      disabled?: boolean;
      defaultValue?: string;
      options: PromptFormOption[];
    }
  | {
      type: "select";
      id: string;
      label: string;
      helpText?: string;
      required?: boolean;
      disabled?: boolean;
      defaultValue?: string;
      placeholder?: string;
      options: PromptFormOption[];
    };

type HumanTask =
  | {
      id: string;
      kind: "tell-human-to-do";
      instruction: string;
      createdAt: string;
      status: "pending" | "active";
    }
  | {
      id: string;
      kind: "prompt-form";
      title: string;
      description?: string;
      submitLabel: string;
      cancelLabel: string;
      form: {
        version: "1";
        fields: PromptFormField[];
      };
      createdAt: string;
      status: "pending" | "active";
    };
```

## 3.2 Submission Types

The current submission type should become a union:

```ts
type SubmitTaskResult =
  | {
      taskId: string;
      kind: "tell-human-to-do";
      status: "completed" | "failed";
      feedback: string;
    }
  | {
      taskId: string;
      kind: "prompt-form";
      status: "submitted" | "cancelled";
      feedback: string;
      values: Record<string, string | null>;
    };
```

This keeps the HTTP bridge aligned with the backend contract.

## 4. Rendering Strategy

## 4.1 Branch on `task.kind`

The current [App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte) should stop assuming every task contains only `instruction`.

Recommended layout logic:
- if no active task: show the existing empty state
- if `activeTask.kind === "tell-human-to-do"`: render the existing instruction UI
- if `activeTask.kind === "prompt-form"`: render the form UI

This is the minimal structural change with the least architectural churn.

## 4.2 Suggested Prompt Form Layout

Recommended visual order:
1. title
2. description as markdown, if present
3. form body fields in declared order
4. bottom feedback textarea
5. inline validation or submit error area
6. action buttons: `Cancel`, `Submit`
7. keyboard hint

Example wireframe:

```text
[Title]
[Description markdown]

[Markdown block]
[Field label]
[text input]

[Field label]
(o) option A
( ) option B

[Feedback]
[textarea]

[Cancel] [Submit]
```

## 5. Form Field Rendering Rules

## 5.1 `markdown`

Render with the existing markdown component.

Notes:
- reuse [Markdown.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/Markdown.svelte)
- `markdown` fields are informational only
- they do not participate in validation or submission values

## 5.2 `text`

Render as a single-line text input.

Behavior:
- initialize from `defaultValue ?? ""`
- trim only for required-field validation, not on each keystroke
- submit `null` when empty and optional
- submit the raw string when non-empty

## 5.3 `textarea`

Render as a multi-line text area.

Behavior:
- initialize from `defaultValue ?? ""`
- use `rows ?? 4`
- preserve line breaks in the submitted value
- submit `null` when empty and optional

## 5.4 `radio`

Render visible mutually-exclusive options.

Behavior:
- initialize from `defaultValue ?? null`
- group by field id
- disabled fields are visible but non-interactive
- submit the selected option value or `null`

## 5.5 `select`

Render as a native select element.

Behavior:
- initialize from `defaultValue ?? ""`
- include a placeholder option when `placeholder` is provided and no value is selected
- submit `null` when no selection is made

## 6. Local Component State

The frontend needs local state for three concerns:
- field values
- field-level validation errors
- existing shared submission state: `feedback`, `isSubmitting`, `submitError`

Recommended Svelte state shape:

```ts
let feedback = "";
let formValues: Record<string, string | null> = {};
let fieldErrors: Record<string, string> = {};
let submitError = "";
let isSubmitting = false;
```

Initialization rule:
- whenever the active task changes to a different task id, rebuild `formValues` from the task schema defaults and clear `fieldErrors`

That prevents stale answers from one task leaking into the next task.

## 7. Validation Rules

Validate on submit, not on every keystroke.

Required-field rules:
- `text`: invalid if trimmed value is empty
- `textarea`: invalid if trimmed value is empty
- `radio`: invalid if no option is selected
- `select`: invalid if no option is selected

Optional-field rules:
- empty value becomes `null`

Error presentation:
- show an inline error directly below the relevant field
- keep a form-level error area for network or server submission errors
- do not clear user input when validation fails

## 8. Submission Behavior

## 8.1 Submit

When the user presses `Submit` for a `prompt-form` task, the app should:
1. validate all required interactive fields
2. if invalid, render inline errors and stop
3. build `values` from interactive fields only
4. POST the result payload to the backend

Recommended payload:

```json
{
  "kind": "prompt-form",
  "status": "submitted",
  "feedback": "Optional free-form note",
  "values": {
    "environment": "production",
    "region": "ap-northeast-1",
    "ticket": "CHG-1234"
  }
}
```

## 8.2 Cancel

When the user presses `Cancel`, the app should submit immediately without required-field validation.

Recommended payload:

```json
{
  "kind": "prompt-form",
  "status": "cancelled",
  "feedback": "Need more information",
  "values": {
    "environment": null,
    "region": null,
    "ticket": null
  }
}
```

Reasoning:
- cancel should not force the user to complete the form first
- the agent still receives a predictable `values` object

## 9. Keyboard and Accessibility

Minimum behavior:
- all controls must be reachable by keyboard
- labels must be associated with their inputs
- radio groups should use semantic grouping with a visible legend or equivalent label
- `Enter` should not accidentally submit while the user is editing a textarea
- `Cmd+Enter` or `Ctrl+Enter` may trigger `Submit`
- `Esc` may trigger `Cancel` if focus is not inside a text input or textarea

ARIA guidance:
- mark required fields clearly in visible UI
- connect inline field errors through `aria-describedby` where practical
- keep the task container `aria-live="polite"` so task switches are announced

## 10. Styling Guidance

The existing app styling already supports the instruction panel and feedback area. `prompt-form` should fit within the same visual shell.

Recommended adjustments in [app.css](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/styles/app.css):
- add a `form-panel` section for prompt forms
- define consistent spacing between fields
- style inline help text and validation errors
- preserve theme support for all field types
- ensure long markdown blocks and long forms scroll inside the window rather than overflow off-screen

Avoid:
- rendering each field type with a visibly different design language
- placing the bottom feedback field above the dynamic form
- adding modal-inside-modal interactions

## 11. Bridge/API Changes

The frontend HTTP bridge in [apps/desktop/src/lib/api.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/lib/api.ts) should remain simple.

Required changes:
- update response typing for `/api/state`
- update `submitTaskResult` typing to accept the union payload
- continue posting to `/api/tasks/:id/result`

No new frontend-to-backend routes are needed for v1.

## 12. Suggested Component Extraction

If [App.svelte](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src/App.svelte) becomes too large, split by responsibility.

Recommended optional components:
- `PromptFormView.svelte`: renders form title, description, fields, and actions
- `PromptFormField.svelte`: renders a single field by discriminated `type`
- `FieldError.svelte`: tiny helper for inline errors

This is optional. A single-file implementation is acceptable for the first pass if the branching remains readable.

## 13. MVP Acceptance Criteria

- desktop renders `tell-human-to-do` and `prompt-form` based on task kind
- desktop supports `markdown`, `text`, `textarea`, `radio`, and `select`
- desktop keeps the shared bottom feedback field for `prompt-form`
- required fields are validated before submit
- `Cancel` bypasses required-field validation
- submitted payload matches backend contract with `kind`, `status`, `feedback`, and `values`
- task changes clear stale form state
- the UI remains keyboard-accessible and visually consistent with the existing app
