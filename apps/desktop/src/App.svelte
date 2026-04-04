<script lang="ts">
  import { onMount } from "svelte";
  import { createDesktopBridge } from "./lib/api";
  import type { HumanTaskState, SubmitTaskResult } from "./lib/types";

  type ThemeId = "light" | "dart";

  const bridge = createDesktopBridge();
  const THEME_STORAGE_KEY = "i-am-mcp.desktop.theme";

  let state: HumanTaskState = {
    activeTask: null,
    queuedTasks: [],
    isConnected: false
  };
  let theme: ThemeId = "light";
  let isThemeMenuOpen = false;
  let themeMenuWrap: HTMLDivElement | null = null;
  let feedback = "";
  let submitError = "";
  let isSubmitting = false;

  const themeOptions: Array<{ id: ThemeId; label: string }> = [
    { id: "light", label: "Light" },
    { id: "dart", label: "Dart" }
  ];

  $: activeTask = state.activeTask;
  $: queuedTasks = state.queuedTasks;
  $: queueCount = queuedTasks.length;
  $: themeLabel = themeOptions.find((option) => option.id === theme)?.label ?? "Theme";
  $: shortcutLabel = navigator.platform.includes("Mac") ? "Cmd" : "Ctrl";

  $: if (!activeTask) {
    feedback = "";
  }

  onMount(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dart") {
      theme = savedTheme;
    }

    const unsubscribe = bridge.subscribe((nextState) => {
      state = nextState;
    });

    function onWindowClick(event: MouseEvent): void {
      if (!themeMenuWrap) {
        isThemeMenuOpen = false;
        return;
      }

      const target = event.target;
      if (!(target instanceof Node) || !themeMenuWrap.contains(target)) {
        isThemeMenuOpen = false;
      }
    }

    window.addEventListener("click", onWindowClick);
    void bridge.focusWindow();

    return () => {
      window.removeEventListener("click", onWindowClick);
      unsubscribe();
    };
  });

  function toggleThemeMenu(event: MouseEvent): void {
    event.stopPropagation();
    isThemeMenuOpen = !isThemeMenuOpen;
  }

  function applyTheme(nextTheme: ThemeId): void {
    theme = nextTheme;
    isThemeMenuOpen = false;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }

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

<main class={`shell theme--${theme}`}>
  <div class="title-strip" data-tauri-drag-region>
    <div class="title-strip__brand">
      <span class="eyebrow">i-am-mcp</span>
      <span class="title-strip__title">Human Assist Console</span>
    </div>
    <div class="theme-menu-wrap" bind:this={themeMenuWrap}>
      <button
        class="menu-button"
        type="button"
        on:click={toggleThemeMenu}
        aria-expanded={isThemeMenuOpen}
        aria-haspopup="menu"
        aria-label="Choose theme"
      >
        Theme: {themeLabel}
      </button>
      {#if isThemeMenuOpen}
        <div class="theme-menu" role="menu">
          {#each themeOptions as option}
            <button
              class="theme-menu__item"
              class:is-active={option.id === theme}
              type="button"
              role="menuitemradio"
              aria-checked={option.id === theme}
              on:click={() => applyTheme(option.id)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <section class="window">
    <header class="window__header">
      <div>
        <h1>{#if activeTask}Active task{:else}Waiting for tasks{/if}</h1>
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
          The app is ready for the next MCP request.
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
