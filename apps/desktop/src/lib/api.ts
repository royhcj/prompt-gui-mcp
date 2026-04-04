import { writable } from "svelte/store";
import type {
  DesktopBridge,
  HumanTask,
  HumanTaskState,
  SubmitTaskResult
} from "./types";

const demoTasks: HumanTask[] = [
  {
    id: "task-otp",
    instruction: "Please check inbox and provide the verification code.",
    createdAt: new Date().toISOString(),
    status: "active"
  },
  {
    id: "task-phone",
    instruction: "Approve the login request on your phone after OTP succeeds.",
    createdAt: new Date(Date.now() + 15_000).toISOString(),
    status: "pending"
  }
];

const defaultState: HumanTaskState = {
  activeTask: null,
  queuedTasks: [],
  isConnected: false
};

function cloneDemoState(): HumanTaskState {
  return {
    activeTask: { ...demoTasks[0] },
    queuedTasks: demoTasks.slice(1).map((task) => ({ ...task })),
    isConnected: false
  };
}

function createBrowserDemoBridge(): DesktopBridge {
  const state = writable<HumanTaskState>(defaultState);
  let hasBootstrapped = false;

  const bootstrapDemo = (): void => {
    if (hasBootstrapped) {
      return;
    }

    hasBootstrapped = true;
    window.setTimeout(() => {
      state.set(cloneDemoState());
    }, 300);
  };

  return {
    subscribe(callback) {
      bootstrapDemo();
      return state.subscribe(callback);
    },
    async submitTaskResult(result: SubmitTaskResult) {
      state.update((currentState) => {
        if (currentState.activeTask?.id !== result.taskId) {
          return currentState;
        }

        const [nextQueuedTask, ...remainingQueue] = currentState.queuedTasks;

        return {
          activeTask: nextQueuedTask
            ? { ...nextQueuedTask, status: "active" }
            : null,
          queuedTasks: remainingQueue,
          isConnected: currentState.isConnected
        };
      });
    },
    async focusWindow() {
      window.focus();
    }
  };
}

export function createDesktopBridge(): DesktopBridge {
  const injectedBridge = window.__I_AM_MCP__;

  if (injectedBridge) {
    return {
      subscribe(callback) {
        return injectedBridge.subscribe(callback);
      },
      async submitTaskResult(result) {
        await injectedBridge.submitTaskResult(result);
      },
      async focusWindow() {
        await injectedBridge.focusWindow?.();
      }
    };
  }

  return createBrowserDemoBridge();
}
