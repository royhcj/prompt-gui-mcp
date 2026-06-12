import { randomUUID } from "node:crypto";
import { logger } from "../logger.js";
import type {
  HumanTask,
  HumanTaskState,
  KeepWaitingResult,
  PromptFormDefinition,
  PromptFormResult,
  PromptLifecycleStatus,
  SubmitTaskResult,
  TaskResult,
  TellHumanToDoResult,
  TimeoutResult
} from "../types.js";

const KEEP_WAITING_INTERVAL_MS = 30_000;
const DEFAULT_MAX_WAIT_MS = 300_000;
const EXTENDED_MAX_WAIT_MS = 600_000;

type PromptFormTaskPayload = {
  title: string;
  description?: string;
  submitLabel: string;
  cancelLabel: string;
  form: PromptFormDefinition;
};

type TerminalResult = TellHumanToDoResult | PromptFormResult | TimeoutResult;
type Waiter = (result: TaskResult) => void;

type PendingTaskBase = {
  id: string;
  createdAt: string;
  createdAtMs: number;
  status: "pending" | "active";
  promptUuid: string;
  maxWaitMs: number;
  deadlineAtMs: number;
  nextKeepWaitingAtMs: number;
  extensionUsed: boolean;
  promptStatus: PromptLifecycleStatus;
  pendingTerminalResult: TerminalResult | null;
  waiter: Waiter | null;
  timer: NodeJS.Timeout | null;
};

type PendingTellHumanTask = PendingTaskBase &
  {
    kind: "tell-human-to-do";
    instruction: string;
  };

type PendingPromptFormTask = PendingTaskBase &
  {
    kind: "prompt-form";
    title: string;
    description?: string;
    submitLabel: string;
    cancelLabel: string;
    form: PromptFormDefinition;
  };

type PendingTask = PendingTellHumanTask | PendingPromptFormTask;
type Subscriber = (state: HumanTaskState) => void;

export class TaskQueueError extends Error {
  constructor(
    public readonly code: "not-found" | "already-resolved" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "TaskQueueError";
  }
}

export class TaskQueue {
  private activeTask: PendingTask | null = null;
  private queuedTasks: PendingTask[] = [];
  private subscribers = new Set<Subscriber>();
  private desktopConnected = false;
  private promptsByUuid = new Map<string, PendingTask>();
  private knownPromptUuids = new Set<string>();
  private resolvedPromptUuids = new Set<string>();

  async enqueueTellHumanToDo(instruction: string): Promise<TaskResult> {
    return new Promise<TaskResult>((resolve) => {
      const nowMs = Date.now();
      const promptUuid = randomUUID();
      const task: PendingTellHumanTask = {
        id: randomUUID(),
        kind: "tell-human-to-do",
        instruction,
        createdAt: new Date(nowMs).toISOString(),
        createdAtMs: nowMs,
        status: this.activeTask ? "pending" : "active",
        promptUuid,
        maxWaitMs: DEFAULT_MAX_WAIT_MS,
        deadlineAtMs: nowMs + DEFAULT_MAX_WAIT_MS,
        nextKeepWaitingAtMs: nowMs + KEEP_WAITING_INTERVAL_MS,
        extensionUsed: false,
        promptStatus: "waiting-user",
        pendingTerminalResult: null,
        waiter: resolve,
        timer: null
      };

      this.enqueueTask(task);
    });
  }

  async enqueuePromptForm(payload: PromptFormTaskPayload): Promise<TaskResult> {
    return new Promise<TaskResult>((resolve) => {
      const nowMs = Date.now();
      const promptUuid = randomUUID();
      const task: PendingPromptFormTask = {
        id: randomUUID(),
        kind: "prompt-form",
        createdAt: new Date(nowMs).toISOString(),
        createdAtMs: nowMs,
        status: this.activeTask ? "pending" : "active",
        promptUuid,
        maxWaitMs: DEFAULT_MAX_WAIT_MS,
        deadlineAtMs: nowMs + DEFAULT_MAX_WAIT_MS,
        nextKeepWaitingAtMs: nowMs + KEEP_WAITING_INTERVAL_MS,
        extensionUsed: false,
        promptStatus: "waiting-user",
        pendingTerminalResult: null,
        waiter: resolve,
        timer: null,
        ...payload
      };

      this.enqueueTask(task);
    });
  }

  waitForPrompt(promptUuid: string): Promise<TaskResult> {
    const task = this.promptsByUuid.get(promptUuid);

    if (!task) {
      if (this.resolvedPromptUuids.has(promptUuid)) {
        throw new TaskQueueError("already-resolved", "Prompt has already resolved.");
      }

      if (!this.knownPromptUuids.has(promptUuid)) {
        throw new TaskQueueError("not-found", "Prompt UUID does not exist.");
      }

      throw new TaskQueueError("already-resolved", "Prompt has already resolved.");
    }

    if (task.waiter) {
      throw new TaskQueueError(
        "conflict",
        "Another wait-for-prompt call is already waiting for this prompt."
      );
    }

    if (task.pendingTerminalResult) {
      const pendingResult = task.pendingTerminalResult;
      task.pendingTerminalResult = null;
      this.consumeTerminalResult(task, pendingResult);
      return Promise.resolve(pendingResult);
    }

    return new Promise<TaskResult>((resolve) => {
      const nowMs = Date.now();
      task.waiter = resolve;
      task.promptStatus = "waiting-user";
      task.nextKeepWaitingAtMs = nowMs + KEEP_WAITING_INTERVAL_MS;

      logger.info(
        { promptUuid: task.promptUuid, taskId: task.id, kind: task.kind },
        "Opened wait-for-prompt waiter"
      );

      this.scheduleTask(task);
      this.emit();
    });
  }

  extendActiveTaskWait(taskId: string): {
    promptUuid: string;
    maxWaitMs: number;
    deadlineAt: string;
    extensionUsed: boolean;
  } {
    if (!this.activeTask || this.activeTask.id !== taskId) {
      throw new Error("Task is not active or does not exist.");
    }

    const task = this.activeTask;
    const nowMs = Date.now();

    if (task.extensionUsed) {
      throw new Error("Keep waiting has already been used for this prompt.");
    }

    if (nowMs >= task.deadlineAtMs) {
      throw new Error("Prompt has already timed out.");
    }

    task.extensionUsed = true;
    task.maxWaitMs = EXTENDED_MAX_WAIT_MS;
    task.deadlineAtMs = task.createdAtMs + EXTENDED_MAX_WAIT_MS;

    logger.info(
      {
        promptUuid: task.promptUuid,
        taskId: task.id,
        kind: task.kind,
        maxWaitMs: task.maxWaitMs
      },
      "Extended prompt wait deadline"
    );

    this.scheduleTask(task);
    this.emit();

    return {
      promptUuid: task.promptUuid,
      maxWaitMs: task.maxWaitMs,
      deadlineAt: new Date(task.deadlineAtMs).toISOString(),
      extensionUsed: task.extensionUsed
    };
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

    logger.info(
      {
        taskId: result.taskId,
        promptUuid: completedTask.promptUuid,
        kind: result.kind,
        status: result.status
      },
      "Submitted human task result"
    );

    const terminalResult = this.buildTerminalUserReply(completedTask, result);
    this.finalizeTask(completedTask, terminalResult);
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

  private enqueueTask(task: PendingTask): void {
    if (this.activeTask) {
      this.queuedTasks.push(task);
    } else {
      this.activeTask = task;
    }

    this.promptsByUuid.set(task.promptUuid, task);
    this.knownPromptUuids.add(task.promptUuid);

    logger.info(
      {
        taskId: task.id,
        promptUuid: task.promptUuid,
        kind: task.kind,
        status: task.status
      },
      "Queued human task"
    );

    this.scheduleTask(task);
    this.emit();
  }

  private finalizeTask(task: PendingTask, terminalResult: TerminalResult): void {
    this.removeFromActiveOrQueue(task);

    if (task.waiter) {
      const resolve = task.waiter;
      task.waiter = null;
      resolve(terminalResult);
      this.consumeTerminalResult(task, terminalResult);
    } else {
      task.pendingTerminalResult = terminalResult;
      task.promptStatus = "waiting-agent";
      this.clearTaskTimer(task);
    }

    this.emit();
  }

  private buildTerminalUserReply(
    task: PendingTask,
    result: SubmitTaskResult
  ): TellHumanToDoResult | PromptFormResult {
    if (task.kind === "tell-human-to-do" && result.kind === "tell-human-to-do") {
      return {
        type: "user-reply",
        promptUuid: task.promptUuid,
        status: result.status,
        feedback: result.feedback
      };
    }

    if (task.kind === "prompt-form" && result.kind === "prompt-form") {
      return {
        type: "user-reply",
        promptUuid: task.promptUuid,
        status: result.status,
        feedback: result.feedback,
        values: result.values
      };
    }

    throw new Error("Task kind mismatch.");
  }

  private buildKeepWaitingResult(task: PendingTask): KeepWaitingResult {
    const nowMs = Date.now();
    const elapsedMs = Math.max(0, nowMs - task.createdAtMs);
    const remainingMs = Math.max(0, task.deadlineAtMs - nowMs);

    return {
      type: "keep-waiting",
      promptUuid: task.promptUuid,
      message:
        "The user is still working on this prompt. Call 'wait-for-prompt' with this promptUuid to continue waiting.",
      nextRecommendedWaitMs: KEEP_WAITING_INTERVAL_MS,
      elapsedMs,
      remainingMs
    };
  }

  private buildTimeoutResult(task: PendingTask): TimeoutResult {
    const nowMs = Date.now();
    const elapsedMs = Math.min(task.maxWaitMs, Math.max(0, nowMs - task.createdAtMs));

    return {
      type: "timeout",
      promptUuid: task.promptUuid,
      message: "Timed out waiting for user response.",
      elapsedMs,
      maxWaitMs: task.maxWaitMs
    };
  }

  private onTaskTimer(promptUuid: string): void {
    const task = this.promptsByUuid.get(promptUuid);
    if (!task) {
      return;
    }

    const nowMs = Date.now();

    if (task.pendingTerminalResult) {
      return;
    }

    if (nowMs >= task.deadlineAtMs) {
      const timeoutResult = this.buildTimeoutResult(task);
      logger.info(
        { taskId: task.id, promptUuid: task.promptUuid, kind: task.kind },
        "Prompt timed out"
      );
      this.finalizeTask(task, timeoutResult);
      return;
    }

    if (task.waiter && task.promptStatus === "waiting-user" && nowMs >= task.nextKeepWaitingAtMs) {
      const keepWaitingResult = this.buildKeepWaitingResult(task);
      const resolve = task.waiter;

      task.waiter = null;
      task.promptStatus = "waiting-agent";
      task.nextKeepWaitingAtMs = nowMs + KEEP_WAITING_INTERVAL_MS;

      logger.info(
        { taskId: task.id, promptUuid: task.promptUuid, kind: task.kind },
        "Emitting keep-waiting response"
      );

      resolve(keepWaitingResult);
      this.scheduleTask(task);
      this.emit();
      return;
    }

    this.scheduleTask(task);
  }

  private scheduleTask(task: PendingTask): void {
    this.clearTaskTimer(task);

    if (task.pendingTerminalResult) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs >= task.deadlineAtMs) {
      this.onTaskTimer(task.promptUuid);
      return;
    }

    let nextAtMs = task.deadlineAtMs;

    if (task.waiter && task.promptStatus === "waiting-user") {
      nextAtMs = Math.min(task.deadlineAtMs, task.nextKeepWaitingAtMs);
    }

    const delayMs = Math.max(1, nextAtMs - nowMs);
    task.timer = setTimeout(() => this.onTaskTimer(task.promptUuid), delayMs);
  }

  private clearTaskTimer(task: PendingTask): void {
    if (!task.timer) {
      return;
    }

    clearTimeout(task.timer);
    task.timer = null;
  }

  private removeFromActiveOrQueue(task: PendingTask): void {
    if (this.activeTask?.id === task.id) {
      this.activeTask = null;

      const nextTask = this.queuedTasks.shift() ?? null;
      if (nextTask) {
        nextTask.status = "active";
        this.activeTask = nextTask;
        this.scheduleTask(nextTask);
      }

      return;
    }

    const index = this.queuedTasks.findIndex((queuedTask) => queuedTask.id === task.id);
    if (index >= 0) {
      this.queuedTasks.splice(index, 1);
    }
  }

  private consumeTerminalResult(task: PendingTask, result: TerminalResult): void {
    task.pendingTerminalResult = null;
    task.waiter = null;
    task.promptStatus = result.type === "timeout" ? "timed-out" : "completed";
    this.clearTaskTimer(task);
    this.promptsByUuid.delete(task.promptUuid);
    this.resolvedPromptUuids.add(task.promptUuid);
  }

  private toTask(task: PendingTask): HumanTask {
    if (task.kind === "tell-human-to-do") {
      return {
        id: task.id,
        kind: task.kind,
        instruction: task.instruction,
        createdAt: task.createdAt,
        status: task.status,
        promptUuid: task.promptUuid,
        maxWaitMs: task.maxWaitMs,
        deadlineAt: new Date(task.deadlineAtMs).toISOString(),
        extensionUsed: task.extensionUsed,
        promptStatus: task.promptStatus
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
      promptUuid: task.promptUuid,
      maxWaitMs: task.maxWaitMs,
      deadlineAt: new Date(task.deadlineAtMs).toISOString(),
      extensionUsed: task.extensionUsed,
      promptStatus: task.promptStatus,
      form: task.form
    };
  }

  private emit(): void {
    const snapshot = this.getState();

    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }
}
