export type TellHumanToDoResult = {
  status: "completed" | "failed";
  feedback: string;
};

export type TaskStatus = "pending" | "active";

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
  status: TellHumanToDoResult["status"];
  feedback: string;
};
