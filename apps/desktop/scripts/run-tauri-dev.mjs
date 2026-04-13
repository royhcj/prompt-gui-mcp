import { spawn } from "node:child_process";
import {
  createTempTauriConfig,
  desktopWorkspace,
  reservePort
} from "./tauri-dev-tools.mjs";

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: options.cwd ?? desktopWorkspace,
    stdio: "inherit",
    shell: false,
    ...options
  });
}

async function main() {
  const devPort = await reservePort();
  const tempConfig = await createTempTauriConfig(
    devPort,
    `pnpm prepare:sidecar && pnpm exec vite --host 127.0.0.1 --port ${devPort} --strictPort`
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

  desktop.on("exit", (code) => {
    cleanup();
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
