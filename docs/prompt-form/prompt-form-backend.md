# Prompt Form Backend Design

## 1. Scope

This document describes the backend changes required to support the new MCP tool `prompt-form`.

Current backend behavior:
- registers one MCP tool: `tell-human-to-do`
- stores one active task plus queued tasks in memory
- exposes `/api/state`, `/api/events`, and `/api/tasks/:id/result`
- resolves the MCP call when the desktop posts a result

`prompt-form` should extend that model rather than bypass it.

## 2. Backend Responsibilities

The backend must:
- register the new MCP tool `prompt-form`
- validate incoming form definitions
- enqueue form tasks in the same in-memory queue used by `tell-human-to-do`
- expose task state to the desktop over `/api/state` and `/api/events`
- accept form submissions from the desktop
- resolve the original MCP request with structured form data

The backend should not:
- render UI
- execute custom validation logic supplied by the agent
- persist submissions beyond process lifetime in v1

## 3. MCP Tool Registration

## 3.1 New Tool

Add a second tool registration in [apps/backend/src/index.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/index.ts).

Recommended shape:

```ts
server.registerTool(
  "prompt-form",
  {
    title: "Prompt Form",
    description:
      "Show a structured form in the desktop app and return structured user input plus free-form feedback.",
    inputSchema: promptFormInputSchema.shape
  },
  async (args: PromptFormInput) => {
    const result = await handlePromptForm(args);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result)
        }
      ],
      structuredContent: result
    };
  }
);
```

## 3.2 New MCP Handler Module

Add a new module next to [tell-human-to-do.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/mcp/tell-human-to-do.ts), for example:
- [prompt-form.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/mcp/prompt-form.ts)

Responsibilities:
- define the `zod` schema for `prompt-form`
- export `PromptFormInput`
- log the incoming tool call
- enqueue the task via the runtime task queue

## 4. Types

## 4.1 New Shared Types

The current [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts) is tailored to one task kind and one result shape. It should be generalized.

Recommended types:

```ts
type HumanTaskStatus = "pending" | "active";

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

type PromptFormDefinition = {
  version: "1";
  fields: PromptFormField[];
};

type TellHumanTask = {
  id: string;
  kind: "tell-human-to-do";
  createdAt: string;
  status: HumanTaskStatus;
  instruction: string;
};

type PromptFormTask = {
  id: string;
  kind: "prompt-form";
  createdAt: string;
  status: HumanTaskStatus;
  title: string;
  description?: string;
  submitLabel: string;
  cancelLabel: string;
  form: PromptFormDefinition;
};

type HumanTask = TellHumanTask | PromptFormTask;

type TellHumanToDoResult = {
  status: "completed" | "failed";
  feedback: string;
};

type PromptFormResult = {
  status: "submitted" | "cancelled";
  feedback: string;
  values: Record<string, string | null>;
};
```

## 4.2 State Envelope

`HumanTaskState` can stay structurally the same:

```ts
{
  activeTask: HumanTask | null;
  queuedTasks: HumanTask[];
  isConnected: boolean;
}
```

That means the desktop app continues to subscribe to one stream and decides rendering based on `task.kind`.

## 5. Validation Strategy

## 5.1 Zod Schema Design

The backend should reject malformed forms before they enter the queue.

Recommended validation strategy:
- top-level `z.object` for tool input
- `z.literal("1")` for `form.version`
- `z.discriminatedUnion("type", [...])` for field types
- `superRefine` to enforce cross-field constraints like duplicate ids

Validation rules:
- non-empty `title`
- non-empty `fields`
- unique field ids across all fields
- non-empty `content` for `markdown`
- non-empty `label` for interactive fields
- non-empty `options` for `radio` and `select`
- unique option values within one field
- `defaultValue` must exist in the option list for `radio` and `select`

## 5.2 Normalization

The handler should normalize optional labels before queueing:
- `submitLabel ?? "Submit"`
- `cancelLabel ?? "Cancel"`

This keeps desktop rendering simple and avoids UI defaults being split across layers.

## 6. Task Queue Changes

## 6.1 Current Limitation

The current queue in [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts) assumes all queued items are instruction-based tasks that resolve to `TellHumanToDoResult`.

That is too narrow for `prompt-form`.

## 6.2 Recommended Change

Generalize the queue to store a tagged task plus a tagged resolver result.

Recommended internal model:

```ts
type TaskResult = TellHumanToDoResult | PromptFormResult;

type PendingTask = HumanTask & {
  resolve: (result: TaskResult) => void;
};
```

Recommended queue API:

```ts
enqueueTellHumanToDo(instruction: string): Promise<TellHumanToDoResult>
enqueuePromptForm(input: PromptFormTaskPayload): Promise<PromptFormResult>
submit(result: SubmitTaskResult): void
```

This preserves strong typing at the entry points while sharing the same queue machinery internally.

## 6.3 Submission Payload

The current submit endpoint only accepts:

```ts
{
  taskId: string;
  status: "completed" | "failed";
  feedback: string;
}
```

Replace it with a discriminated union:

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

Why include `kind` in the submit payload even though the backend knows the active task:
- the HTTP contract becomes explicit
- malformed desktop submissions are easier to reject
- logs are clearer
- future desktop regressions are easier to diagnose

## 7. HTTP API Changes

## 7.1 `GET /api/state`

No route change is required.

The only change is the JSON payload shape of `activeTask` and `queuedTasks`, which become a union by `kind`.

Example `prompt-form` state payload:

```json
{
  "activeTask": {
    "id": "task_123",
    "kind": "prompt-form",
    "createdAt": "2026-04-09T10:00:00.000Z",
    "status": "active",
    "title": "Choose deployment target",
    "description": "Please review the release details and fill the form below.",
    "submitLabel": "Submit",
    "cancelLabel": "Cancel",
    "form": {
      "version": "1",
      "fields": [
        {
          "type": "radio",
          "id": "environment",
          "label": "Environment",
          "required": true,
          "options": [
            { "label": "Staging", "value": "staging" },
            { "label": "Production", "value": "production" }
          ]
        }
      ]
    }
  },
  "queuedTasks": [],
  "isConnected": true
}
```

## 7.2 `GET /api/events`

No route change is required. SSE continues to emit the same `state` event with the updated union payload.

## 7.3 `POST /api/tasks/:id/result`

The route can remain unchanged, but it must accept the new union submit payload.

Recommended server behavior:
- read JSON body
- attach `taskId` from the route
- validate the payload against a `zod` discriminated union
- verify the body `kind` matches the active task kind
- resolve the pending task
- reject mismatches with `400`

## 8. Logging

Add logs with enough structure to debug bad tool payloads and bad desktop submissions.

Recommended log fields:
- `tool`
- `taskId`
- `taskKind`
- `fieldCount`
- `fieldIds`
- `status`

Do not log all submitted field values by default if they may contain sensitive information. Log field keys, not field contents.

## 9. Error Handling

Backend error cases to handle explicitly:
- invalid tool input schema
- duplicate field ids
- invalid option definitions
- desktop submits result for non-active task
- desktop submits `prompt-form` payload for a `tell-human-to-do` task
- desktop submits missing required `values` object for `prompt-form`

Recommended behavior:
- reject invalid tool calls before enqueueing
- reject invalid desktop submissions with HTTP 400
- do not auto-complete or auto-cancel tasks on validation error

## 10. Compatibility Strategy

`tell-human-to-do` should remain fully supported.

Recommended migration approach:
1. Introduce union types in shared backend models.
2. Refactor the queue to support multiple task/result kinds.
3. Add `prompt-form` MCP registration and handler.
4. Extend the HTTP submit contract to accept both task kinds.
5. Update the desktop app to render based on `task.kind`.

This order keeps the app working while the new renderer is added.

## 11. Suggested File-Level Changes

Likely backend touch points:
- [apps/backend/src/index.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/index.ts): register `prompt-form`
- [apps/backend/src/mcp/tell-human-to-do.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/mcp/tell-human-to-do.ts): no behavior change, but may need type updates
- `apps/backend/src/mcp/prompt-form.ts`: new schema + handler
- [apps/backend/src/types.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/types.ts): introduce task/result unions
- [apps/backend/src/services/task-queue.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/services/task-queue.ts): generalize queue and submit logic
- [apps/backend/src/transport/http.ts](/Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/backend/src/transport/http.ts): validate and accept prompt form submissions

## 12. MVP Acceptance Criteria

- backend registers MCP tool `prompt-form`
- backend rejects malformed form definitions
- backend queues `prompt-form` in the same queue as `tell-human-to-do`
- `/api/state` and `/api/events` expose `prompt-form` tasks correctly
- `/api/tasks/:id/result` accepts `prompt-form` submission payloads
- backend resolves the MCP call with `status + feedback + values`
- existing `tell-human-to-do` flow still works unchanged from the agent perspective
