import { invoke, isTauri } from "@tauri-apps/api/core";
import { writable } from "svelte/store";
import type {
  DesktopBridge,
  HumanTaskState,
  SubmitTaskResult
} from "./types";

const BACKEND_ORIGIN =
  import.meta.env.VITE_I_AM_MCP_BACKEND_ORIGIN ?? "http://127.0.0.1:43118";
let backendOriginPromise: Promise<string> | null = null;

const defaultState: HumanTaskState = {
  activeTask: null,
  queuedTasks: [],
  isConnected: false
};

async function resolveBackendOrigin(): Promise<string> {
  if (backendOriginPromise) {
    return backendOriginPromise;
  }

  if (!isTauri()) {
    backendOriginPromise = Promise.resolve(BACKEND_ORIGIN);
    return backendOriginPromise;
  }

  backendOriginPromise = invoke<string>("get_backend_origin").catch(() => {
    backendOriginPromise = Promise.resolve(BACKEND_ORIGIN);
    return BACKEND_ORIGIN;
  });

  return backendOriginPromise;
}

async function fetchState(origin: string): Promise<HumanTaskState> {
  const response = await fetch(`${origin}/api/state`);

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
    let origin: string;

    try {
      origin = await resolveBackendOrigin();
      state.set(await fetchState(origin));
    } catch {
      scheduleReconnect();
      return;
    }

    eventSource?.close();
    eventSource = new EventSource(`${origin}/api/events`);

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
      const origin = await resolveBackendOrigin();
      const payload =
        result.kind === "prompt-form"
          ? {
              kind: result.kind,
              status: result.status,
              feedback: result.feedback,
              values: result.values
            }
          : {
              kind: result.kind,
              status: result.status,
              feedback: result.feedback
            };
      const response = await fetch(
        `${origin}/api/tasks/${result.taskId}/result`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to submit task result.");
      }
    },
    async focusWindow() {
      window.focus();
    },
    async setWindowTheme(theme) {
      if (!isTauri()) {
        return;
      }

      await invoke("set_window_theme", { theme });
    }
  };
}

export function createDesktopBridge(): DesktopBridge {
  return window.__I_AM_MCP__ ?? createHttpBridge();
}
