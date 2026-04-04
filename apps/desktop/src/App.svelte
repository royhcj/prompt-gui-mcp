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
  $: shortcutLabel = navigator.platform.includes("Mac") ? "Cmd" : "Ctrl";

  $: if (!activeTask) {
    feedback = "";
  }

  onMount(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dart") {
      theme = savedTheme;
    }

    void bridge.setWindowTheme(theme);

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
    void bridge.setWindowTheme(nextTheme);
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
</script>

<svelte:window on:keydown={handleKeydown} />

<main class={`shell theme--${theme}`}>
  <section class="window">
    {#if activeTask}
      <section class="task-layout" aria-live="polite">
        <div class="instruction-panel">
          <p class="instruction">{activeTask.instruction}</p>
        </div>

        <div class="task-layout__header">
          <label class="feedback" for="feedback">Feedback</label>

          <div class="theme-menu-wrap" bind:this={themeMenuWrap}>
            <button
              class="theme-button"
              type="button"
              on:click={toggleThemeMenu}
              aria-expanded={isThemeMenuOpen}
              aria-haspopup="menu"
              aria-label="Choose theme"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M20 14.5A7.5 7.5 0 0 1 9.5 4a.75.75 0 0 0-.95.95 8.5 8.5 0 1 0 10.5 10.5.75.75 0 0 0 .95-.95Z"
                />
              </svg>
              <span class="sr-only">Choose theme</span>
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

        <label class="feedback feedback--field" for="feedback">
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
        <p class="empty-state__title">No active task</p>
        <p class="empty-state__body">
          The app is ready for the next request.
        </p>
      </section>
    {/if}
  </section>
</main>
