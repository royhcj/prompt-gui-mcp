import { randomUUID } from "node:crypto";
import { logger } from "../logger.js";
import type {
  HumanTask,
  HumanTaskState,
  PromptFormResult,
  PromptFormTask,
  SubmitTaskResult,
  TellHumanTask,
  TellHumanToDoResult
} from "../types.js";

type PromptFormTaskPayload = Omit<
  PromptFormTask,
  "id" | "kind" | "createdAt" | "status"
>;

type PendingTellHumanTask = TellHumanTask & {
  resolve: (result: TellHumanToDoResult) => void;
};

type PendingPromptFormTask = PromptFormTask & {
  resolve: (result: PromptFormResult) => void;
};

type PendingTask = PendingTellHumanTask | PendingPromptFormTask;

type Subscriber = (state: HumanTaskState) => void;

export class TaskQueue {
  private activeTask: PendingTask | null = null;
  private queuedTasks: PendingTask[] = [];
  private subscribers = new Set<Subscriber>();
  private desktopConnected = false;

  async enqueueTellHumanToDo(instruction: string): Promise<TellHumanToDoResult> {
    return new Promise<TellHumanToDoResult>((resolve) => {
      const task: PendingTellHumanTask = {
        id: randomUUID(),
        kind: "tell-human-to-do",
        instruction,
        createdAt: new Date().toISOString(),
        status: this.activeTask ? "pending" : "active",
        resolve
      };

      this.enqueueTask(task);
    });
  }

  async enqueuePromptForm(
    payload: PromptFormTaskPayload
  ): Promise<PromptFormResult> {
    return new Promise<PromptFormResult>((resolve) => {
      const task: PendingPromptFormTask = {
        id: randomUUID(),
        kind: "prompt-form",
        createdAt: new Date().toISOString(),
        status: this.activeTask ? "pending" : "active",
        resolve,
        ...payload
      };

      this.enqueueTask(task);
    });
  }

  submit(result: SubmitTaskResult): void {
    if (!this.activeTask || this.activeTask.id !== result.taskId) {
      throw new Error("Task is not active or does not exist.");
    }

    const completedTask = this.activeTask;

    if (completedTask.kind !== result.kind) {
      throw new Error(
        `Task kind mismatch. Active task is '${completedTask.kind}' but received '${result.kind}'.`
      );
    }

    this.activeTask = null;

    const nextTask = this.queuedTasks.shift() ?? null;
    if (nextTask) {
      nextTask.status = "active";
      this.activeTask = nextTask;
    }

    logger.info(
      { taskId: result.taskId, kind: result.kind, status: result.status },
      "Submitted human task result"
    );

    if (completedTask.kind === "tell-human-to-do" && result.kind === "tell-human-to-do") {
      completedTask.resolve({
        status: result.status,
        feedback: result.feedback
      });
    } else if (completedTask.kind === "prompt-form" && result.kind === "prompt-form") {
      completedTask.resolve({
        status: result.status,
        feedback: result.feedback,
        values: result.values
      });
    }

    this.emit();
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getState());

    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  setDesktopConnected(isConnected: boolean): void {
    this.desktopConnected = isConnected;
    this.emit();
  }

  getState(): HumanTaskState {
    return {
      activeTask: this.activeTask ? this.toTask(this.activeTask) : null,
      queuedTasks: this.queuedTasks.map((task) => this.toTask(task)),
      isConnected: this.desktopConnected
    };
  }

  private toTask(task: PendingTask): HumanTask {
    if (task.kind === "tell-human-to-do") {
      return {
        id: task.id,
        kind: task.kind,
        instruction: task.instruction,
        createdAt: task.createdAt,
        status: task.status
      };
    }

    return {
      id: task.id,
      kind: task.kind,
      title: task.title,
      description: task.description,
      submitLabel: task.submitLabel,
      cancelLabel: task.cancelLabel,
      createdAt: task.createdAt,
      status: task.status,
      form: task.form
    };
  }

  private enqueueTask(task: PendingTask): void {
    if (this.activeTask) {
      this.queuedTasks.push(task);
    } else {
      this.activeTask = task;
    }

    logger.info(
      { taskId: task.id, kind: task.kind, status: task.status },
      "Queued human task"
    );
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getState();

    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }
}
