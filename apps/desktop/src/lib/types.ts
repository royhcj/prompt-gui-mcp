export type TaskStatus = "pending" | "active" | "completed" | "failed";

export type HumanTask = {
  id: string;
  instruction: string;
  createdAt: string;
  status: TaskStatus;
};

export type HumanTaskState = {
  activeTask: HumanTask | null;
  queuedTasks: HumanTask[];
  isConnected: boolean;
};

export type SubmitTaskResult = {
  taskId: string;
  status: "completed" | "failed";
  feedback: string;
};

export type DesktopBridge = {
  subscribe(callback: (state: HumanTaskState) => void): () => void;
  submitTaskResult(result: SubmitTaskResult): Promise<void>;
  focusWindow(): Promise<void>;
  setWindowTheme(theme: "light" | "dart"): Promise<void>;
};

declare global {
  interface Window {
    __I_AM_MCP__?: DesktopBridge;
  }
}
