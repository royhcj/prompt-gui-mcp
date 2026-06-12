export type HumanTaskStatus = "pending" | "active";
export type PromptLifecycleStatus =
  | "waiting-user"
  | "waiting-agent"
  | "completed"
  | "timed-out";

export type PromptFormOption = {
  label: string;
  value: string;
  description?: string;
};

export type PromptFormCheckboxOption = PromptFormOption & {
  textInput?: {
    placeholder?: string;
    defaultValue?: string;
    required?: boolean;
  };
};

export type PromptFormFieldBase = {
  id: string;
  helpText?: string;
  required: boolean;
  disabled?: boolean;
};

export type PromptFormField =
  | {
      type: "markdown";
      id: string;
      content: string;
    }
  | {
      type: "image";
      id: string;
      url: string;
      alt?: string;
    }
  | (PromptFormFieldBase & {
      type: "text";
      label: string;
      defaultValue?: string;
      placeholder?: string;
    })
  | (PromptFormFieldBase & {
      type: "textarea";
      label: string;
      defaultValue?: string;
      placeholder?: string;
      rows?: number;
    })
  | (PromptFormFieldBase & {
      type: "radio";
      label: string;
      defaultValue?: string;
      options: PromptFormOption[];
    })
  | (PromptFormFieldBase & {
      type: "select";
      label: string;
      defaultValue?: string;
      placeholder?: string;
      options: PromptFormOption[];
    })
  | (PromptFormFieldBase & {
      type: "checkbox-list";
      label: string;
      defaultValue?: string[];
      options: PromptFormCheckboxOption[];
    });

export type PromptFormDefinition = {
  version: "1";
  fields: PromptFormField[];
};

export type TellHumanTask = {
  id: string;
  kind: "tell-human-to-do";
  instruction: string;
  createdAt: string;
  status: HumanTaskStatus;
  promptUuid: string;
  maxWaitMs: number;
  deadlineAt: string;
  extensionUsed: boolean;
  promptStatus: PromptLifecycleStatus;
};

export type PromptFormTask = {
  id: string;
  kind: "prompt-form";
  title: string;
  description?: string;
  submitLabel: string;
  cancelLabel: string;
  createdAt: string;
  status: HumanTaskStatus;
  promptUuid: string;
  maxWaitMs: number;
  deadlineAt: string;
  extensionUsed: boolean;
  promptStatus: PromptLifecycleStatus;
  form: PromptFormDefinition;
};

export type HumanTask = TellHumanTask | PromptFormTask;

export type HumanTaskState = {
  activeTask: HumanTask | null;
  queuedTasks: HumanTask[];
  isConnected: boolean;
};

export type TellHumanToDoResult = {
  type: "user-reply";
  promptUuid: string;
  status: "completed" | "failed";
  feedback: string;
};

export type PromptFormValue =
  | string
  | string[]
  | {
      selected: string[];
      details?: Record<string, string | null>;
    }
  | null;

export type PromptFormResult = {
  type: "user-reply";
  promptUuid: string;
  status: "submitted" | "cancelled";
  feedback: string;
  values: Record<string, PromptFormValue>;
};

export type KeepWaitingResult = {
  type: "keep-waiting";
  promptUuid: string;
  message: string;
  nextRecommendedWaitMs: number;
  elapsedMs: number;
  remainingMs: number;
};

export type TimeoutResult = {
  type: "timeout";
  promptUuid: string;
  message: string;
  elapsedMs: number;
  maxWaitMs: number;
};

export type TaskResult =
  | KeepWaitingResult
  | TimeoutResult
  | TellHumanToDoResult
  | PromptFormResult;

export type WaitForPromptInput = {
  promptUuid: string;
};

export type WaitForPromptResult = TaskResult;

export type SubmitTellHumanToDoResult = {
  taskId: string;
  kind: "tell-human-to-do";
  status: TellHumanToDoResult["status"];
  feedback: string;
};

export type SubmitPromptFormResult = {
  taskId: string;
  kind: "prompt-form";
  status: PromptFormResult["status"];
  feedback: string;
  values: PromptFormResult["values"];
};

export type SubmitTaskResult =
  | SubmitTellHumanToDoResult
  | SubmitPromptFormResult;
