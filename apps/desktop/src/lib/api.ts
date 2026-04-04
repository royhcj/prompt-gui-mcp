import { writable } from "svelte/store";
import type {
  DesktopBridge,
  HumanTaskState,
  SubmitTaskResult
} from "./types";

const BACKEND_ORIGIN = "http://127.0.0.1:43118";

const defaultState: HumanTaskState = {
  activeTask: null,
  queuedTasks: [],
  isConnected: false
};

async function fetchState(): Promise<HumanTaskState> {
  const response = await fetch(`${BACKEND_ORIGIN}/api/state`);

  if (!response.ok) {
    throw new Error(`Failed to fetch task state: ${response.status}`);
  }

  return (await response.json()) as HumanTaskState;
}

function createHttpBridge(): DesktopBridge {
  const state = writable<HumanTaskState>(defaultState);
  let eventSource: EventSource | null = null;
  let reconnectTimer: number | null = null;

  const connect = async (): Promise<void> => {
    try {
      state.set(await fetchState());
    } catch {
      scheduleReconnect();
      return;
    }

    eventSource?.close();
    eventSource = new EventSource(`${BACKEND_ORIGIN}/api/events`);

    eventSource.addEventListener("state", (event) => {
      const message = event as MessageEvent<string>;
      state.set(JSON.parse(message.data) as HumanTaskState);
    });

    eventSource.onerror = () => {
      eventSource?.close();
      eventSource = null;
      state.update((currentState) => ({
        ...currentState,
        isConnected: false
      }));
      scheduleReconnect();
    };
  };

  const scheduleReconnect = (): void => {
    if (reconnectTimer !== null) {
      return;
    }

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, 1000);
  };

  return {
    subscribe(callback) {
      void connect();

      const unsubscribe = state.subscribe(callback);
      return () => {
        unsubscribe();
        eventSource?.close();
        eventSource = null;

        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };
    },
    async submitTaskResult(result: SubmitTaskResult) {
      const response = await fetch(
        `${BACKEND_ORIGIN}/api/tasks/${result.taskId}/result`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            status: result.status,
            feedback: result.feedback
          })
        }
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to submit task result.");
      }
    },
    async focusWindow() {
      window.focus();
    }
  };
}

export function createDesktopBridge(): DesktopBridge {
  return window.__I_AM_MCP__ ?? createHttpBridge();
}
