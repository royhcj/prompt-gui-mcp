import { spawn } from "node:child_process";

const root = new URL("../", import.meta.url);
const desktopDevUrl = "http://127.0.0.1:4173";

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    ...options
  });
}

async function waitForDesktop(timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(desktopDevUrl);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }

  throw new Error("Timed out waiting for the desktop app dev server.");
}

async function main() {
  const desktop = run("pnpm", ["--filter", "desktop", "tauri:dev"]);

  let isCleaningUp = false;

  const cleanup = () => {
    if (isCleaningUp) {
      return;
    }

    isCleaningUp = true;
    desktop.kill("SIGTERM");
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  await waitForDesktop(60_000);

  const simulate = run("pnpm", ["--filter", "backend", "simulate"]);

  simulate.on("exit", (code) => {
    cleanup();
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
