<script lang="ts">
  import { onMount } from "svelte";
  import { createDesktopBridge } from "./lib/api";
  import type { HumanTaskState, SubmitTaskResult } from "./lib/types";

  const bridge = createDesktopBridge();

  let state: HumanTaskState = {
    activeTask: null,
    queuedTasks: [],
    isConnected: false
  };
  let feedback = "";
  let submitError = "";
  let isSubmitting = false;

  $: activeTask = state.activeTask;
  $: queuedTasks = state.queuedTasks;
  $: queueCount = queuedTasks.length;
  $: shortcutLabel = navigator.platform.includes("Mac") ? "Cmd" : "Ctrl";

  $: if (!activeTask) {
    feedback = "";
  }

  onMount(() => {
    const unsubscribe = bridge.subscribe((nextState) => {
      state = nextState;
    });

    void bridge.focusWindow();

    return unsubscribe;
  });

  async function submit(status: SubmitTaskResult["status"]): Promise<void> {
    if (!activeTask || isSubmitting) {
      return;
    }

    isSubmitting = true;
    submitError = "";

    try {
      await bridge.submitTaskResult({
        taskId: activeTask.id,
        status,
        feedback: feedback.trim()
      });
    } catch (error) {
      submitError =
        error instanceof Error ? error.message : "Failed to submit task result.";
    } finally {
      isSubmitting = false;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!activeTask || isSubmitting) {
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submit("completed");
    }

    if (event.shiftKey && event.key === "Enter") {
      event.preventDefault();
      void submit("failed");
    }
  }

  function formatCreatedAt(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric"
    }).format(new Date(value));
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<main class="shell">
  <section class="window">
    <div class="window__glow" aria-hidden="true"></div>

    <header class="window__header">
      <div>
        <p class="eyebrow">i-am-mcp</p>
        <h1>Human Assist Console</h1>
      </div>

      <div
        class:is-live={state.isConnected}
        class="status-pill"
        aria-live="polite"
      >
        {#if state.isConnected}
          Connected
        {:else}
          Demo mode
        {/if}
      </div>
    </header>

    {#if activeTask}
      <section class="task-card" aria-live="polite">
        <div class="task-card__meta">
          <span class="task-tag">Active task</span>
          <span>{formatCreatedAt(activeTask.createdAt)}</span>
        </div>

        <p class="instruction">{activeTask.instruction}</p>

        <label class="feedback" for="feedback">
          <span>Feedback</span>
          <textarea
            id="feedback"
            bind:value={feedback}
            rows="5"
            placeholder="Enter the result for the agent. OTP, confirmation detail, or failure reason."
          ></textarea>
        </label>

        {#if submitError}
          <p class="error">{submitError}</p>
        {/if}

        <div class="actions">
          <button
            class="button button--ghost"
            disabled={isSubmitting}
            on:click={() => void submit("failed")}
          >
            Failed
          </button>

          <button
            class="button button--primary"
            disabled={isSubmitting}
            on:click={() => void submit("completed")}
          >
            Complete
          </button>
        </div>

        <p class="hint">
          {shortcutLabel}+Enter completes. Shift+Enter marks failed.
        </p>
      </section>
    {:else}
      <section class="empty-state" aria-live="polite">
        <p class="empty-state__title">No active human task</p>
        <p class="empty-state__body">
          The window stays ready for the next MCP request. New tasks will appear here immediately.
        </p>
      </section>
    {/if}

    <aside class="queue-panel" aria-live="polite">
      <div class="queue-panel__header">
        <h2>Queue</h2>
        <span class="queue-count">{queueCount}</span>
      </div>

      {#if queueCount > 0}
        <ol class="queue-list">
          {#each queuedTasks as task (task.id)}
            <li class="queue-item">
              <p>{task.instruction}</p>
              <span>{formatCreatedAt(task.createdAt)}</span>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="queue-empty">No pending tasks.</p>
      {/if}
    </aside>
  </section>
</main>
