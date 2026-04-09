export type HumanTaskStatus = "pending" | "active";

export type PromptFormOption = {
  label: string;
  value: string;
  description?: string;
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
      options: PromptFormOption[];
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
  form: PromptFormDefinition;
};

export type HumanTask = TellHumanTask | PromptFormTask;

export type HumanTaskState = {
  activeTask: HumanTask | null;
  queuedTasks: HumanTask[];
  isConnected: boolean;
};

export type TellHumanToDoResult = {
  status: "completed" | "failed";
  feedback: string;
};

export type PromptFormValue = string | string[] | null;

export type PromptFormResult = {
  status: "submitted" | "cancelled";
  feedback: string;
  values: Record<string, PromptFormValue>;
};

export type TaskResult = TellHumanToDoResult | PromptFormResult;

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
