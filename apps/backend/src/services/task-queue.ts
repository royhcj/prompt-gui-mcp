import { randomUUID } from "node:crypto";
import { logger } from "../logger.js";
import type {
  HumanTask,
  HumanTaskState,
  SubmitTaskResult,
  TellHumanToDoResult
} from "../types.js";

type PendingTask = HumanTask & {
  resolve: (result: TellHumanToDoResult) => void;
};

type Subscriber = (state: HumanTaskState) => void;

export class TaskQueue {
  private activeTask: PendingTask | null = null;
  private queuedTasks: PendingTask[] = [];
  private subscribers = new Set<Subscriber>();
  private desktopConnected = false;

  async enqueue(instruction: string): Promise<TellHumanToDoResult> {
    return new Promise<TellHumanToDoResult>((resolve) => {
      const task: PendingTask = {
        id: randomUUID(),
        instruction,
        createdAt: new Date().toISOString(),
        status: this.activeTask ? "pending" : "active",
        resolve
      };

      if (this.activeTask) {
        this.queuedTasks.push(task);
      } else {
        this.activeTask = task;
      }

      logger.info({ taskId: task.id, instruction }, "Queued human task");
      this.emit();
    });
  }

  submit(result: SubmitTaskResult): void {
    if (!this.activeTask || this.activeTask.id !== result.taskId) {
      throw new Error("Task is not active or does not exist.");
    }

    const completedTask = this.activeTask;
    this.activeTask = null;

    const nextTask = this.queuedTasks.shift() ?? null;
    if (nextTask) {
      nextTask.status = "active";
      this.activeTask = nextTask;
    }

    logger.info(
      { taskId: result.taskId, status: result.status },
      "Submitted human task result"
    );

    completedTask.resolve({
      status: result.status,
      feedback: result.feedback
    });

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
    return {
      id: task.id,
      instruction: task.instruction,
      createdAt: task.createdAt,
      status: task.status
    };
  }

  private emit(): void {
    const snapshot = this.getState();

    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }
}
