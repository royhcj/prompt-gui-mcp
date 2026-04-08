<script lang="ts">
  import { onMount } from "svelte";
  import { createDesktopBridge } from "./lib/api";
  import type {
    HumanTaskState,
    PromptFormTask,
    SubmitTaskResult
  } from "./lib/types";
  import Markdown from "./lib/Markdown.svelte";

  type ThemeId = "light" | "dart" | "doraemon";
  type FormValues = Record<string, string | null>;
  type FieldErrors = Record<string, string>;

  const bridge = createDesktopBridge();
  const THEME_STORAGE_KEY = "i-am-mcp.desktop.theme";

  let state: HumanTaskState = {
    activeTask: null,
    queuedTasks: [],
    isConnected: false
  };
  let activeTask: HumanTaskState["activeTask"] = null;
  let lastTaskId: string | null = null;
  let theme: ThemeId = "doraemon";
  let isThemeMenuOpen = false;
  let themeMenuWrap: HTMLDivElement | null = null;
  let feedback = "";
  let formValues: FormValues = {};
  let fieldErrors: FieldErrors = {};
  let submitError = "";
  let isSubmitting = false;

  const themeOptions: Array<{ id: ThemeId; label: string }> = [
    { id: "light", label: "Light" },
    { id: "dart", label: "Dart" },
    { id: "doraemon", label: "Doraemon" }
  ];

  $: activeTask = state.activeTask;
  $: shortcutLabel = navigator.platform.includes("Mac") ? "Cmd" : "Ctrl";
  $: taskTitle =
    activeTask?.kind === "prompt-form" ? activeTask.title : "Human Task";
  $: taskHint =
    activeTask?.kind === "prompt-form"
      ? `${shortcutLabel}+Enter submits. Shift+Escape cancels.`
      : `${shortcutLabel}+Enter completes. Shift+Enter marks failed.`;

  $: if (activeTask?.id !== lastTaskId) {
    lastTaskId = activeTask?.id ?? null;
    feedback = "";
    submitError = "";
    fieldErrors = {};
    formValues =
      activeTask?.kind === "prompt-form" ? createInitialFormValues(activeTask) : {};
  }

  onMount(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dart" || savedTheme === "doraemon") {
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

  function createInitialFormValues(task: PromptFormTask): FormValues {
    const values: FormValues = {};

    for (const field of task.form.fields) {
      if (field.type === "markdown") {
        continue;
      }

      values[field.id] = field.defaultValue ?? null;
    }

    return values;
  }

  function getValue(fieldId: string): string {
    return formValues[fieldId] ?? "";
  }

  function setFieldValue(fieldId: string, value: string | null): void {
    formValues = {
      ...formValues,
      [fieldId]: value
    };

    if (fieldErrors[fieldId]) {
      const nextErrors = { ...fieldErrors };
      delete nextErrors[fieldId];
      fieldErrors = nextErrors;
    }
  }

  function normalizeFieldValue(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    return value === "" ? null : value;
  }

  function validatePromptForm(task: PromptFormTask): FieldErrors {
    const nextErrors: FieldErrors = {};

    for (const field of task.form.fields) {
      if (field.type === "markdown" || !field.required || field.disabled) {
        continue;
      }

      const normalizedValue = normalizeFieldValue(formValues[field.id] ?? null);
      if (normalizedValue === null || normalizedValue.trim() === "") {
        nextErrors[field.id] = `${field.label} is required.`;
      }
    }

    return nextErrors;
  }

  function buildPromptFormValues(
    task: PromptFormTask,
    cancelled = false
  ): FormValues {
    const values: FormValues = {};

    for (const field of task.form.fields) {
      if (field.type === "markdown") {
        continue;
      }

      values[field.id] = cancelled
        ? null
        : normalizeFieldValue(formValues[field.id] ?? null);
    }

    return values;
  }

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

  async function submitTellHumanTask(
    status: "completed" | "failed"
  ): Promise<void> {
    if (!activeTask || activeTask.kind !== "tell-human-to-do") {
      return;
    }

    await submitTask({
      taskId: activeTask.id,
      kind: "tell-human-to-do",
      status,
      feedback: feedback.trim()
    });
  }

  async function submitPromptFormTask(
    status: "submitted" | "cancelled"
  ): Promise<void> {
    if (!activeTask || activeTask.kind !== "prompt-form") {
      return;
    }

    if (status === "submitted") {
      const nextErrors = validatePromptForm(activeTask);
      fieldErrors = nextErrors;

      if (Object.keys(nextErrors).length > 0) {
        return;
      }
    } else {
      fieldErrors = {};
    }

    await submitTask({
      taskId: activeTask.id,
      kind: "prompt-form",
      status,
      feedback: feedback.trim(),
      values: buildPromptFormValues(activeTask, status === "cancelled")
    });
  }

  async function submitTask(result: SubmitTaskResult): Promise<void> {
    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    submitError = "";

    try {
      await bridge.submitTaskResult(result);
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

      if (activeTask.kind === "prompt-form") {
        void submitPromptFormTask("submitted");
      } else {
        void submitTellHumanTask("completed");
      }

      return;
    }

    if (activeTask.kind === "tell-human-to-do" && event.shiftKey && event.key === "Enter") {
      event.preventDefault();
      void submitTellHumanTask("failed");
      return;
    }

    if (activeTask.kind === "prompt-form" && event.shiftKey && event.key === "Escape") {
      event.preventDefault();
      void submitPromptFormTask("cancelled");
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<main class={`shell theme--${theme}`}>
  <section class="window">
    {#if activeTask}
      <section class="task-layout" aria-live="polite">
        <div class="task-layout__header">
          <div class="task-layout__title-block">
            <p class="eyebrow">{activeTask.kind === "prompt-form" ? "Prompt Form" : "Instruction"}</p>
            <h1 class="task-title">{taskTitle}</h1>
          </div>

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

        <div class="task-layout__body">
          {#if activeTask.kind === "tell-human-to-do"}
            <div class="instruction-panel">
              <Markdown content={activeTask.instruction} />
            </div>
          {:else}
            <div class="prompt-form">
              {#if activeTask.description}
                <div class="prompt-form__description">
                  <Markdown content={activeTask.description} />
                </div>
              {/if}

              <div class="prompt-form__fields">
                {#each activeTask.form.fields as field (field.id)}
                  {#if field.type === "markdown"}
                    <section class="field-card field-card--markdown">
                      <Markdown content={field.content} />
                    </section>
                  {:else if field.type === "text"}
                    <label class="field-card" for={field.id}>
                      <span class="field-label">
                        {field.label}
                        {#if field.required}
                          <span class="field-required" aria-hidden="true">*</span>
                        {/if}
                      </span>
                      {#if field.helpText}
                        <span class="field-help">{field.helpText}</span>
                      {/if}
                      <input
                        id={field.id}
                        class:error={Boolean(fieldErrors[field.id])}
                        type="text"
                        value={getValue(field.id)}
                        placeholder={field.placeholder}
                        disabled={field.disabled}
                        aria-invalid={Boolean(fieldErrors[field.id])}
                        aria-describedby={fieldErrors[field.id] ? `${field.id}-error` : undefined}
                        on:input={(event) =>
                          setFieldValue(field.id, (event.currentTarget as HTMLInputElement).value)}
                      />
                      {#if fieldErrors[field.id]}
                        <span class="field-error" id={`${field.id}-error`}>{fieldErrors[field.id]}</span>
                      {/if}
                    </label>
                  {:else if field.type === "textarea"}
                    <label class="field-card" for={field.id}>
                      <span class="field-label">
                        {field.label}
                        {#if field.required}
                          <span class="field-required" aria-hidden="true">*</span>
                        {/if}
                      </span>
                      {#if field.helpText}
                        <span class="field-help">{field.helpText}</span>
                      {/if}
                      <textarea
                        id={field.id}
                        class:error={Boolean(fieldErrors[field.id])}
                        rows={field.rows ?? 4}
                        placeholder={field.placeholder}
                        disabled={field.disabled}
                        aria-invalid={Boolean(fieldErrors[field.id])}
                        aria-describedby={fieldErrors[field.id] ? `${field.id}-error` : undefined}
                        on:input={(event) =>
                          setFieldValue(field.id, (event.currentTarget as HTMLTextAreaElement).value)}
                      >{getValue(field.id)}</textarea>
                      {#if fieldErrors[field.id]}
                        <span class="field-error" id={`${field.id}-error`}>{fieldErrors[field.id]}</span>
                      {/if}
                    </label>
                  {:else if field.type === "radio"}
                    <fieldset class="field-card fieldset-card" disabled={field.disabled}>
                      <legend class="field-label">
                        {field.label}
                        {#if field.required}
                          <span class="field-required" aria-hidden="true">*</span>
                        {/if}
                      </legend>
                      {#if field.helpText}
                        <p class="field-help">{field.helpText}</p>
                      {/if}
                      <div class="option-list">
                        {#each field.options as option}
                          <label class="option-card">
                            <input
                              type="radio"
                              name={field.id}
                              value={option.value}
                              checked={getValue(field.id) === option.value}
                              disabled={field.disabled}
                              on:change={(event) =>
                                setFieldValue(field.id, (event.currentTarget as HTMLInputElement).value)}
                            />
                            <span class="option-card__body">
                              <span class="option-card__label">{option.label}</span>
                              {#if option.description}
                                <span class="option-card__description">{option.description}</span>
                              {/if}
                            </span>
                          </label>
                        {/each}
                      </div>
                      {#if fieldErrors[field.id]}
                        <span class="field-error" id={`${field.id}-error`}>{fieldErrors[field.id]}</span>
                      {/if}
                    </fieldset>
                  {:else if field.type === "select"}
                    <label class="field-card" for={field.id}>
                      <span class="field-label">
                        {field.label}
                        {#if field.required}
                          <span class="field-required" aria-hidden="true">*</span>
                        {/if}
                      </span>
                      {#if field.helpText}
                        <span class="field-help">{field.helpText}</span>
                      {/if}
                      <select
                        id={field.id}
                        class:error={Boolean(fieldErrors[field.id])}
                        value={getValue(field.id)}
                        disabled={field.disabled}
                        aria-invalid={Boolean(fieldErrors[field.id])}
                        aria-describedby={fieldErrors[field.id] ? `${field.id}-error` : undefined}
                        on:change={(event) =>
                          setFieldValue(field.id, (event.currentTarget as HTMLSelectElement).value)}
                      >
                        <option value="" disabled={field.required}>
                          {field.placeholder ?? "Select an option"}
                        </option>
                        {#each field.options as option}
                          <option value={option.value}>{option.label}</option>
                        {/each}
                      </select>
                      {#if fieldErrors[field.id]}
                        <span class="field-error" id={`${field.id}-error`}>{fieldErrors[field.id]}</span>
                      {/if}
                    </label>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <label class="feedback feedback--field" for="feedback">
            <span>Feedback</span>
            <textarea
              id="feedback"
              bind:value={feedback}
              rows="5"
              placeholder="Enter notes for the agent. Include context, confirmations, or failure detail."
            ></textarea>
          </label>

          {#if submitError}
            <p class="error">{submitError}</p>
          {/if}
        </div>

        <div class="actions">
          {#if activeTask.kind === "prompt-form"}
            <button
              class="button button--ghost"
              disabled={isSubmitting}
              on:click={() => void submitPromptFormTask("cancelled")}
            >
              {activeTask.cancelLabel}
            </button>

            <button
              class="button button--primary"
              disabled={isSubmitting}
              on:click={() => void submitPromptFormTask("submitted")}
            >
              {activeTask.submitLabel}
            </button>
          {:else}
            <button
              class="button button--ghost"
              disabled={isSubmitting}
              on:click={() => void submitTellHumanTask("failed")}
            >
              Failed
            </button>

            <button
              class="button button--primary"
              disabled={isSubmitting}
              on:click={() => void submitTellHumanTask("completed")}
            >
              Complete
            </button>
          {/if}
        </div>

        <p class="hint">{taskHint}</p>
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
