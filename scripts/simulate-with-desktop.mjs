import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createTempTauriConfig,
  desktopWorkspace,
  reservePort
} from "../apps/desktop/scripts/tauri-dev-tools.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const backendWorkspace = fileURLToPath(new URL("../apps/backend/", import.meta.url));
const backendPort = "43118";

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: options.cwd ?? root,
    stdio: "inherit",
    shell: false,
    ...options
  });
}

async function waitForDesktop(desktop, desktopDevUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let desktopExited = false;

  desktop.once("exit", () => {
    desktopExited = true;
  });

  while (Date.now() < deadline) {
    if (desktopExited || desktop.exitCode !== null) {
      throw new Error("Desktop process exited before the dev server became ready.");
    }

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
  const desktopPort = await reservePort();
  const tempConfig = await createTempTauriConfig(
    desktopPort,
    `pnpm prepare:sidecar && pnpm exec vite --host 127.0.0.1 --port ${desktopPort} --strictPort`
  );
  const desktop = run(
    "pnpm",
    ["exec", "tauri", "dev", "--config", tempConfig.configPath],
    { cwd: desktopWorkspace }
  );

  let isCleaningUp = false;

  const cleanup = () => {
    if (isCleaningUp) {
      return;
    }

    isCleaningUp = true;
    desktop.kill("SIGTERM");
    void tempConfig.cleanup();
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  await waitForDesktop(desktop, tempConfig.devUrl, 60_000);

  const simulate = run("pnpm", ["simulate"], {
    cwd: backendWorkspace,
    env: {
      ...process.env,
      I_AM_MCP_SERVER_PORT: backendPort
    }
  });

  simulate.on("exit", (code) => {
    cleanup();
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
