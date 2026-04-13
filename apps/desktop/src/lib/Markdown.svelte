<script lang="ts">
  import { marked } from "marked";
  import hljs from "highlight.js";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import "highlight.js/styles/atom-one-dark.css";

  interface Props {
    content: string;
  }

  let { content }: Props = $props();

  const renderer = new marked.Renderer();

  // Override code block to add language class
  renderer.codespan = (token) => {
    const code = token.text;
    return `<code class="markdown-inline-code">${code}</code>`;
  };

  renderer.code = (token) => {
    const lang = token.lang || "text";
    const code = token.text;

    let highlighted = code;
    if (hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(code, { language: lang }).value;
    } else {
      highlighted = hljs.highlight(code, { language: "plaintext" }).value;
    }

    return `<pre class="markdown-pre"><code class="markdown-code hljs language-${lang}">${highlighted}</code></pre>`;
  };

  marked.setOptions({
    renderer,
    gfm: true
  });

  const html = $derived(marked(content));

  function handleClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLAnchorElement)) {
      return;
    }

    const url = target.href;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return;
    }

    event.preventDefault();

    if (isTauri()) {
      void invoke("open_url", { url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
</script>

<div class="markdown-content" on:click={handleClick}>
  {@html html}
</div>

<style>
  :global(.hljs) {
    background: transparent !important;
    padding: 0 !important;
    color: inherit;
  }

  :global(.markdown-pre) {
    background: rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    padding: 12px;
    overflow-x: auto;
    margin: 8px 0;
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  :global(.shell.theme--dart .markdown-pre) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.1);
  }

  :global(.markdown-code) {
    font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace;
    font-size: 0.9em;
    line-height: 1.4;
  }

  :global(.markdown-inline-code) {
    background: rgba(0, 0, 0, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace;
    font-size: 0.9em;
  }

  :global(.shell.theme--dart .markdown-inline-code) {
    background: rgba(255, 255, 255, 0.1);
  }

  :global(.markdown-content h1),
  :global(.markdown-content h2),
  :global(.markdown-content h3),
  :global(.markdown-content h4),
  :global(.markdown-content h5),
  :global(.markdown-content h6) {
    margin: 12px 0 8px 0;
    font-weight: 600;
  }

  :global(.markdown-content h1) {
    font-size: 1.3em;
  }

  :global(.markdown-content h2) {
    font-size: 1.2em;
  }

  :global(.markdown-content h3) {
    font-size: 1.1em;
  }

  :global(.markdown-content p) {
    margin: 6px 0;
  }

  :global(.markdown-content ul),
  :global(.markdown-content ol) {
    margin: 8px 0;
    padding-left: 20px;
  }

  :global(.markdown-content li) {
    margin: 4px 0;
  }

  :global(.markdown-content blockquote) {
    margin: 8px 0;
    padding-left: 12px;
    border-left: 3px solid rgba(0, 0, 0, 0.2);
    color: rgba(0, 0, 0, 0.7);
  }

  :global(.shell.theme--dart .markdown-content blockquote) {
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
  }

  :global(.markdown-content a) {
    color: var(--accent);
    text-decoration: none;
  }

  :global(.markdown-content a:hover) {
    text-decoration: underline;
  }

  :global(.markdown-content strong) {
    font-weight: 600;
  }

  :global(.markdown-content em) {
    font-style: italic;
  }

  :global(.markdown-content hr) {
    margin: 12px 0;
    border: 0;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }

  :global(.shell.theme--dart .markdown-content hr) {
    border-top-color: rgba(255, 255, 255, 0.1);
  }
</style>
