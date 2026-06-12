# Prompt Form Design

## 1. Goal

`prompt-form` extends `prompt-gui-mcp` from a single-purpose human instruction popup into a general-purpose human input workflow.

Today the app supports:
- one MCP tool: `tell-human-to-do`
- one UI pattern: markdown instruction + `Complete` / `Failed` + free-form feedback

`prompt-form` adds:
- one new MCP tool: `prompt-form`
- a flexible form renderer in the desktop app
- structured user responses in addition to the existing free-form feedback box

The feature is intended for cases where the AI agent needs human input that is more structured than a single text area, for example:
- choose one environment from a dropdown
- confirm a deployment target using radio buttons
- provide multiple values in one round-trip
- show markdown instructions between fields
- collect optional notes together with structured answers

## 2. Product Constraints

This feature should reuse the current system shape instead of introducing a separate flow.

Constraints:
- the backend remains the source of truth
- the desktop app remains a presentation + submission layer
- MCP calls remain pending until the human submits or cancels
- tasks still use the same queueing model as `tell-human-to-do`
- the window remains always-on-top
- every form includes a bottom `feedback` field, `Submit`, and `Cancel`

## 3. Tool Overview

### 3.1 Tool Name

- `prompt-form`

### 3.2 Tool Purpose

`prompt-form` asks the desktop app to render a structured form for the human and waits for a response.

Compared with `tell-human-to-do`:
- `tell-human-to-do` is optimized for one markdown instruction and a binary outcome
- `prompt-form` is optimized for collecting typed answers from a configurable form

## 4. Agent-to-MCP Contract

### 4.1 Tool Input

The coding agent calls `prompt-form` with a payload like this:

```json
{
  "title": "Choose deployment target",
  "description": "Please review the release details and fill the form below.",
  "submitLabel": "Submit",
  "cancelLabel": "Cancel",
  "form": {
    "version": "1",
    "fields": [
      {
        "type": "markdown",
        "id": "release_notes",
        "content": "## Release\n\n- Commit: `a1b2c3d`\n- Branch: `main`"
      },
      {
        "type": "radio",
        "id": "environment",
        "label": "Environment",
        "required": true,
        "options": [
          { "label": "Staging", "value": "staging" },
          { "label": "Production", "value": "production" }
        ]
      },
      {
        "type": "select",
        "id": "region",
        "label": "Region",
        "required": true,
        "placeholder": "Choose a region",
        "options": [
          { "label": "US East", "value": "us-east-1" },
          { "label": "Tokyo", "value": "ap-northeast-1" }
        ]
      },
      {
        "type": "text",
        "id": "ticket",
        "label": "Change ticket",
        "required": false,
        "placeholder": "CHG-1234"
      }
    ]
  }
}
```

### 4.2 Top-Level Input Schema

Recommended input shape:

```ts
{
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  form: PromptFormDefinition;
}
```

Rules:
- `title` is required and short
- `description` is optional and supports markdown
- `submitLabel` defaults to `Submit`
- `cancelLabel` defaults to `Cancel`
- `form.version` is required so future schema changes can be versioned safely
- `form.fields` must contain at least one field

## 5. Form Representation

### 5.1 Form Definition

Use a constrained JSON format instead of arbitrary HTML.

```ts
type PromptFormDefinition = {
  version: "1";
  fields: PromptFormField[];
};
```

Why this design:
- safe to validate with `zod`
- safe to render in Svelte without executing code
- stable for LLMs to produce
- easy to serialize over MCP and HTTP

### 5.2 Common Field Shape

All input-capable fields share common metadata:

```ts
type PromptFormFieldBase = {
  id: string;
  type: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
};
```

Rules:
- `id` must be unique within the form
- `id` is the key used in the response payload
- `label` is required for interactive input fields
- `helpText` supports short markdown-free plain text only
- `required` defaults to `false`
- `disabled` defaults to `false`

### 5.3 Supported Field Types in v1

#### `markdown`

Static content only.

```ts
{
  type: "markdown";
  id: string;
  content: string;
}
```

Use cases:
- instructions
- warning text
- release summary
- links or code blocks

#### `image`

Static image rendered from a URL.

```ts
{
  type: "image";
  id: string;
  url: string;
  alt?: string;
}
```

Use cases:
- reference screenshot
- diagram preview
- visual confirmation target

#### `text`

Single-line text input.

```ts
{
  type: "text";
  id: string;
  label: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: string;
  placeholder?: string;
}
```

#### `textarea`

Multi-line text input.

```ts
{
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
```

#### `radio`

Single choice, visible options.

```ts
{
  type: "radio";
  id: string;
  label: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: string;
  options: Array<{ label: string; value: string; description?: string }>;
}
```

#### `select`

Single choice, collapsed dropdown.

```ts
{
  type: "select";
  id: string;
  label: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: string;
  placeholder?: string;
  options: Array<{ label: string; value: string; description?: string }>;
}
```

### 5.4 Explicitly Out of Scope for v1

Do not support these in the first version:
- nested groups
- conditional visibility
- arbitrary validation expressions
- file uploads
- multi-select
- date pickers
- arbitrary custom components

These can be added later after the transport and renderer are proven stable.

## 6. Submission Result

### 6.1 Result Shape Returned to the Agent

The MCP tool should return a structured result:

```ts
{
  status: "submitted" | "cancelled";
  feedback: string;
  values: Record<string, string | null>;
}
```

Semantics:
- `status: "submitted"` means the human pressed `Submit`
- `status: "cancelled"` means the human pressed `Cancel`
- `feedback` is always present and may be empty
- `values` contains one entry for each interactive input field
- static `markdown` fields are not included in `values`
- unanswered optional fields return `null`

### 6.2 Example Success Result

```json
{
  "status": "submitted",
  "feedback": "Use the Tokyo region after 5pm.",
  "values": {
    "environment": "production",
    "region": "ap-northeast-1",
    "ticket": "CHG-1234"
  }
}
```

### 6.3 Example Cancel Result

```json
{
  "status": "cancelled",
  "feedback": "Need more time to verify this release.",
  "values": {
    "environment": null,
    "region": null,
    "ticket": null
  }
}
```

## 7. How The Coding Agent Should Use `prompt-form`

The coding agent should:
- use `tell-human-to-do` when free-form human action is enough
- use `prompt-form` when it needs structured answers back
- keep field ids simple and stable, such as `environment`, `ticket`, `region`
- keep option values machine-friendly, such as `production` instead of `Production`
- keep markdown informational and concise
- avoid very large forms; prefer a small number of high-value inputs

Recommended prompting guidance for agents:
- use `title` to summarize the decision
- use `description` for short context
- use `markdown` fields for richer instructions or code blocks
- use `radio` when all options should remain visible
- use `select` when the option list is longer or less important to compare side-by-side
- use `textarea` for long responses, not the bottom feedback field

## 8. Runtime Flow

1. The coding agent calls `prompt-form`.
2. The backend validates the payload.
3. The backend enqueues a new task with `kind: "prompt-form"`.
4. The desktop app receives updated state over SSE.
5. The desktop app renders the form from the structured definition.
6. The human fills the form, optionally enters bottom feedback, and clicks `Submit` or `Cancel`.
7. The desktop app posts the result to the backend.
8. The backend resolves the original MCP request with `status + feedback + values`.

## 9. Queueing and Coexistence With `tell-human-to-do`

`prompt-form` should not create a second queue. Both tools should share one queue of human-facing tasks.

Recommended unified task model:

```ts
type HumanTask =
  | {
      id: string;
      kind: "tell-human-to-do";
      createdAt: string;
      status: "pending" | "active";
      instruction: string;
    }
  | {
      id: string;
      kind: "prompt-form";
      createdAt: string;
      status: "pending" | "active";
      title: string;
      description?: string;
      submitLabel: string;
      cancelLabel: string;
      form: PromptFormDefinition;
    };
```

Why this matters:
- only one active human task at a time
- the desktop app can switch rendering based on `kind`
- queueing behavior stays predictable
- no architectural split is needed

## 10. Validation Rules

Minimum validation in v1:
- `title` must be non-empty
- `form.version` must equal `1`
- `fields` must be non-empty
- every field id must be unique
- `image.url`, when present, must be a valid URL
- every interactive field must have a non-empty `label`
- `radio` and `select` must provide at least one option
- option values must be unique within a field
- `defaultValue`, if present, must match an available option for `radio` and `select`

Desktop-side validation before submit:
- required `text` and `textarea` fields must not be blank after trim
- required `radio` and `select` fields must have a selected value
- invalid submission should keep the form open and show inline errors

## 11. Non-Goals

This feature does not try to become a general low-code app builder.

Non-goals:
- server-side persistence of past form submissions
- arbitrary client-side scripting
- dynamic forms fetched from external URLs
- replacing `tell-human-to-do`

## 12. MVP Acceptance Criteria

- MCP exposes a new tool named `prompt-form`
- backend validates and queues `prompt-form` requests
- desktop can render v1 field types: `markdown`, `image`, `text`, `textarea`, `radio`, `select`, `checkbox-list`
- desktop always shows bottom `feedback`, `Submit`, and `Cancel`
- required fields are validated before submission
- backend returns `status + feedback + values` to the calling agent
- `prompt-form` and `tell-human-to-do` can coexist in the same task queue
