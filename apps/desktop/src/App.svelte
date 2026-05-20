<script lang="ts">
  import { onMount, tick } from "svelte";
  import { createDesktopBridge } from "./lib/api";
  import type {
    HumanTaskState,
    PromptFormValue,
    PromptFormTask,
    SubmitTaskResult
  } from "./lib/types";
  import Markdown from "./lib/Markdown.svelte";

  type ThemeId = "light" | "dark" | "doraemon";
  type FormValues = Record<string, PromptFormValue>;
  type FieldErrors = Record<string, string>;

  const bridge = createDesktopBridge();
  const THEME_STORAGE_KEY = "prompt-gui-mcp.desktop.theme";
  const COUNTDOWN_START_BEFORE_DEADLINE_MS = 60_000;
  const TIMEOUT_ALERT_THRESHOLD_MS = 15_000;

  let state: HumanTaskState = {
    activeTask: null,
    queuedTasks: [],
    isConnected: false
  };
  let activeTask: HumanTaskState["activeTask"] = null;
  let lastTaskId: string | null = null;
  let theme: ThemeId = "light";
  let isThemeMenuOpen = false;
  let themeMenuWrap: HTMLDivElement | null = null;
  let feedback = "";
  let formValues: FormValues = {};
  let checkboxDetailValues: Record<string, string | null> = {};
  let fieldErrors: FieldErrors = {};
  let submitError = "";
  let isSubmitting = false;
  let isExtendingWait = false;
  let nowMs = Date.now();
  let countdownTimer: number | null = null;
  let taskLayoutElement: HTMLElement | null = null;
  let taskBodyElement: HTMLDivElement | null = null;
  let isTimeoutAlertOpen = false;
  let timeoutAlertDismissedKey: string | null = null;

  const WINDOW_RESIZE_HEIGHT_BUFFER = 8;

  const themeOptions: Array<{ id: ThemeId; label: string }> = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "doraemon", label: "Doraemon" }
  ];

  $: activeTask = state.activeTask;
  $: deadlineAtMs = activeTask ? Date.parse(activeTask.deadlineAt) : null;
  $: remainingMs =
    deadlineAtMs === null ? 0 : Math.max(0, deadlineAtMs - nowMs);
  $: countdownSeconds = Math.ceil(remainingMs / 1000);
  $: showCountdown =
    Boolean(activeTask) && remainingMs <= COUNTDOWN_START_BEFORE_DEADLINE_MS;
  $: canExtendWait =
    Boolean(activeTask) && showCountdown && !activeTask?.extensionUsed;
  $: timeoutAlertKey =
    activeTask && deadlineAtMs !== null ? `${activeTask.id}:${deadlineAtMs}` : null;
  $: shouldShowTimeoutAlert =
    Boolean(activeTask) &&
    remainingMs > 0 &&
    remainingMs <= TIMEOUT_ALERT_THRESHOLD_MS &&
    timeoutAlertKey !== null &&
    timeoutAlertDismissedKey !== timeoutAlertKey;
  $: if (!shouldShowTimeoutAlert) {
    isTimeoutAlertOpen = false;
  } else if (!isTimeoutAlertOpen) {
    isTimeoutAlertOpen = true;
  }
  $: shortcutLabel = navigator.platform.includes("Mac") ? "Cmd" : "Ctrl";
  $: taskTitle =
    activeTask?.kind === "prompt-form" ? activeTask.title : "Human Task";
  $: taskHint =
    activeTask?.kind === "prompt-form"
      ? `${shortcutLabel}+Enter submits. Shift+Escape cancels.`
      : `${shortcutLabel}+Enter completes. Shift+Escape marks failed.`;

  $: if (activeTask?.id !== lastTaskId) {
    lastTaskId = activeTask?.id ?? null;
    feedback = "";
    submitError = "";
    fieldErrors = {};
    formValues =
      activeTask?.kind === "prompt-form" ? createInitialFormValues(activeTask) : {};
    checkboxDetailValues =
      activeTask?.kind === "prompt-form" ? createInitialCheckboxDetailValues(activeTask) : {};
    isTimeoutAlertOpen = false;
    timeoutAlertDismissedKey = null;

    if (activeTask) {
      void bridge.focusWindow();
      void resizeWindowToContent();
    }
  }

  onMount(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "doraemon") {
      theme = savedTheme;
    } else if (savedTheme === "dart") {
      theme = "dark";
    }

    void bridge.setWindowTheme(theme);

    const unsubscribe = bridge.subscribe((nextState) => {
      state = nextState;
    });

    countdownTimer = window.setInterval(() => {
      nowMs = Date.now();
    }, 1000);

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
      if (countdownTimer !== null) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
      }
    };
  });

  function createInitialFormValues(task: PromptFormTask): FormValues {
    const values: FormValues = {};

    for (const field of task.form.fields) {
      if (field.type === "markdown" || field.type === "image") {
        continue;
      }

      if (field.type === "checkbox-list") {
        values[field.id] = field.defaultValue ? [...field.defaultValue] : [];
        continue;
      }

      values[field.id] = field.defaultValue ?? null;
    }

    return values;
  }

  function checkboxDetailKey(fieldId: string, optionValue: string): string {
    return `${fieldId}::${optionValue}`;
  }

  function createInitialCheckboxDetailValues(task: PromptFormTask): Record<string, string | null> {
    const values: Record<string, string | null> = {};

    for (const field of task.form.fields) {
      if (field.type !== "checkbox-list" || !field.defaultValue) {
        continue;
      }

      const selected = new Set(field.defaultValue);
      for (const option of field.options) {
        if (!option.textInput || !selected.has(option.value)) {
          continue;
        }

        values[checkboxDetailKey(field.id, option.value)] =
          option.textInput.defaultValue ?? null;
      }
    }

    return values;
  }

  function getValue(fieldId: string): string {
    const value = formValues[fieldId];
    return typeof value === "string" ? value : "";
  }

  function getMultiValue(fieldId: string): string[] {
    const value = formValues[fieldId];
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === "object" && "selected" in value) {
      return Array.isArray(value.selected) ? value.selected : [];
    }

    return [];
  }

  function getCheckboxDetailValue(fieldId: string, optionValue: string): string {
    return checkboxDetailValues[checkboxDetailKey(fieldId, optionValue)] ?? "";
  }

  function setCheckboxDetailValue(fieldId: string, optionValue: string, value: string): void {
    checkboxDetailValues = {
      ...checkboxDetailValues,
      [checkboxDetailKey(fieldId, optionValue)]: value
    };

    if (fieldErrors[fieldId]) {
      const nextErrors = { ...fieldErrors };
      delete nextErrors[fieldId];
      fieldErrors = nextErrors;
    }
  }

  function setFieldValue(fieldId: string, value: PromptFormValue): void {
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

  function handleCheckboxListChange(fieldId: string, optionValue: string): void {
    const selected = [...getMultiValue(fieldId)];

    setFieldValue(fieldId, selected);

    if (!selected.includes(optionValue)) {
      const key = checkboxDetailKey(fieldId, optionValue);
      if (key in checkboxDetailValues) {
        const nextDetails = { ...checkboxDetailValues };
        delete nextDetails[key];
        checkboxDetailValues = nextDetails;
      }
    }

    if (fieldErrors[fieldId]) {
      const nextErrors = { ...fieldErrors };
      delete nextErrors[fieldId];
      fieldErrors = nextErrors;
    }
  }

  function normalizeFieldValue(value: PromptFormValue): PromptFormValue {
    if (value === null) {
      return null;
    }

    if (Array.isArray(value)) {
      const normalizedValues = value
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      return normalizedValues.length > 0 ? normalizedValues : null;
    }

    return value === "" ? null : value;
  }

  function validatePromptForm(task: PromptFormTask): FieldErrors {
    const nextErrors: FieldErrors = {};

    for (const field of task.form.fields) {
      if (field.type === "markdown" || field.type === "image" || field.disabled) {
        continue;
      }

      const normalizedValue = normalizeFieldValue(formValues[field.id] ?? null);
      if (field.required) {
        if (
          normalizedValue === null ||
          (typeof normalizedValue === "string" && normalizedValue.trim() === "") ||
          (Array.isArray(normalizedValue) && normalizedValue.length === 0)
        ) {
          nextErrors[field.id] = `${field.label} is required.`;
          continue;
        }
      }

      if (field.type === "checkbox-list") {
        const selected = getMultiValue(field.id);
        for (const option of field.options) {
          if (!option.textInput || !selected.includes(option.value)) {
            continue;
          }

          const isTextRequired = option.textInput.required ?? true;
          if (!isTextRequired) {
            continue;
          }

          const detail = getCheckboxDetailValue(field.id, option.value).trim();
          if (detail.length === 0) {
            nextErrors[field.id] = `${field.label}: ${option.label} requires details.`;
            break;
          }
        }
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
      if (field.type === "markdown" || field.type === "image") {
        continue;
      }

      if (field.type === "checkbox-list") {
        if (cancelled) {
          values[field.id] = null;
          continue;
        }

        const selected = getMultiValue(field.id);
        if (selected.length === 0) {
          values[field.id] = null;
          continue;
        }

        const details: Record<string, string | null> = {};
        for (const option of field.options) {
          if (!option.textInput || !selected.includes(option.value)) {
            continue;
          }

          const detail = getCheckboxDetailValue(field.id, option.value).trim();
          details[option.value] = detail.length > 0 ? detail : null;
        }

        values[field.id] =
          Object.keys(details).length > 0 ? { selected, details } : selected;
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

  async function resizeWindowToContent(): Promise<void> {
    await tick();

    if (!taskLayoutElement || !taskBodyElement) {
      return;
    }

    // Use the live viewport as baseline so window paddings/chrome are included,
    // then add/remove only the body overflow delta.
    const contentDelta = taskBodyElement.scrollHeight - taskBodyElement.clientHeight;
    const contentHeight = window.innerHeight + contentDelta;
    await bridge.resizeWindowToContent(
      Math.ceil(contentHeight + WINDOW_RESIZE_HEIGHT_BUFFER)
    );
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

    const submitted = await submitTask({
      taskId: activeTask.id,
      kind: "prompt-form",
      status,
      feedback: feedback.trim(),
      values: buildPromptFormValues(activeTask, status === "cancelled")
    });

    if (submitted) {
      await bridge.hideWindow();
    }
  }

  async function submitTask(result: SubmitTaskResult): Promise<boolean> {
    if (isSubmitting) {
      return false;
    }

    isSubmitting = true;
    submitError = "";

    try {
      await bridge.submitTaskResult(result);
      return true;
    } catch (error) {
      submitError =
        error instanceof Error ? error.message : "Failed to submit task result.";
      return false;
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

    if (activeTask.kind === "tell-human-to-do" && event.shiftKey && event.key === "Escape") {
      event.preventDefault();
      void submitTellHumanTask("failed");
      return;
    }

    if (activeTask.kind === "prompt-form" && event.shiftKey && event.key === "Escape") {
      event.preventDefault();
      void submitPromptFormTask("cancelled");
    }
  }

  async function openImagePreview(url: string): Promise<void> {
    await bridge.openImagePreview(url);
  }

  async function extendWait(): Promise<boolean> {
    if (!activeTask || !canExtendWait || isExtendingWait) {
      return false;
    }

    isExtendingWait = true;
    submitError = "";

    try {
      await bridge.extendTaskWait(activeTask.id);
      return true;
    } catch (error) {
      submitError =
        error instanceof Error ? error.message : "Failed to extend task wait.";
      return false;
    } finally {
      isExtendingWait = false;
    }
  }

  function dismissTimeoutAlert(): void {
    isTimeoutAlertOpen = false;
    if (timeoutAlertKey) {
      timeoutAlertDismissedKey = timeoutAlertKey;
    }
  }

  async function handleTimeoutAlertExtend(): Promise<void> {
    const extended = await extendWait();
    if (extended) {
      isTimeoutAlertOpen = false;
      timeoutAlertDismissedKey = null;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<main class={`shell theme--${theme}`}>
  <section class="window">
    {#if activeTask}
      <section class="task-layout" aria-live="polite" bind:this={taskLayoutElement}>
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

        <div class="task-layout__body" bind:this={taskBodyElement}>
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
                  {:else if field.type === "image"}
                    <section class="field-card field-card--image">
                      <button
                        class="image-field__button"
                        type="button"
                        on:click={() => void openImagePreview(field.url)}
                        aria-label="Preview image"
                      >
                        <img class="image-field__img" src={field.url} alt={field.alt ?? "Prompt form image"} />
                      </button>
                    </section>
                  {:else if field.type === "text"}
                    <label class="field-card" class:error={Boolean(fieldErrors[field.id])} for={field.id}>
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
                    <label class="field-card" class:error={Boolean(fieldErrors[field.id])} for={field.id}>
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
                    <fieldset
                      class="field-card fieldset-card"
                      class:error={Boolean(fieldErrors[field.id])}
                      disabled={field.disabled}
                      aria-describedby={fieldErrors[field.id] ? `${field.id}-error` : undefined}
                    >
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
                          <label class="option-card option-card--radio">
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
                    <label class="field-card" class:error={Boolean(fieldErrors[field.id])} for={field.id}>
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
                  {:else if field.type === "checkbox-list"}
                    <fieldset
                      class="field-card fieldset-card"
                      class:error={Boolean(fieldErrors[field.id])}
                      disabled={field.disabled}
                      aria-describedby={fieldErrors[field.id] ? `${field.id}-error` : undefined}
                    >
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
                          <div class="option-card">
                            <label class="option-card__main">
                              <input
                                type="checkbox"
                                value={option.value}
                                bind:group={formValues[field.id]}
                                disabled={field.disabled}
                                on:change={() =>
                                  handleCheckboxListChange(field.id, option.value)
                                }
                              />
                              <span class="option-card__body">
                                <span class="option-card__label">{option.label}</span>
                                {#if option.description}
                                  <span class="option-card__description">{option.description}</span>
                                {/if}
                              </span>
                            </label>
                            {#if option.textInput && getMultiValue(field.id).includes(option.value)}
                              <input
                                class="option-card__detail-input"
                                type="text"
                                value={getCheckboxDetailValue(field.id, option.value)}
                                placeholder={option.textInput.placeholder ?? "Please specify"}
                                disabled={field.disabled}
                                on:input={(event) =>
                                  setCheckboxDetailValue(
                                    field.id,
                                    option.value,
                                    (event.currentTarget as HTMLInputElement).value
                                  )}
                              />
                            {/if}
                          </div>
                        {/each}
                      </div>
                      {#if fieldErrors[field.id]}
                        <span class="field-error" id={`${field.id}-error`}>{fieldErrors[field.id]}</span>
                      {/if}
                    </fieldset>
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

        <div class="task-layout__footer-meta">
          <p class="hint">{taskHint}</p>
          {#if showCountdown}
            <div class="timeout-meta">
              <span class="timeout-meta__text">timeout in {Math.max(0, countdownSeconds)} s</span>
              {#if canExtendWait}
                <button
                  class="timeout-meta__button"
                  type="button"
                  disabled={isExtendingWait}
                  on:click={() => void extendWait()}
                >
                  Keep waiting
                </button>
              {/if}
            </div>
          {/if}
        </div>

        {#if isTimeoutAlertOpen}
          <div class="timeout-alert-overlay" role="presentation">
            <div
              class="timeout-alert"
              role="alertdialog"
              aria-modal="true"
              aria-label="Timeout warning"
            >
              <p class="timeout-alert__title">Task will timeout soon</p>
              <p class="timeout-alert__body">
                Time remaining: {Math.max(0, countdownSeconds)}s
              </p>
              <div class="timeout-alert__actions">
                <button
                  class="button button--ghost timeout-alert__button"
                  type="button"
                  on:click={dismissTimeoutAlert}
                >
                  Got it
                </button>
                <button
                  class="button button--primary timeout-alert__button"
                  type="button"
                  disabled={!canExtendWait || isExtendingWait}
                  on:click={() => void handleTimeoutAlertExtend()}
                >
                  Extend time
                </button>
              </div>
            </div>
          </div>
        {/if}
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
