import { spawn } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const desktopWorkspace = fileURLToPath(new URL("../apps/desktop/", import.meta.url));
const backendWorkspace = fileURLToPath(new URL("../apps/backend/", import.meta.url));

async function readTauriConfig() {
  const configPath = fileURLToPath(
    new URL("../apps/desktop/src-tauri/tauri.conf.json", import.meta.url)
  );
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw);
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => {
          reject(new Error("Failed to reserve a localhost port."));
        });
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function createTempTauriConfig(devPort) {
  const config = await readTauriConfig();
  const tempDir = await mkdtemp(join(tmpdir(), "i-am-mcp-simulate-"));
  const configPath = join(tempDir, "tauri.simulate.conf.json");
  const devUrl = `http://127.0.0.1:${devPort}`;

  config.build = {
    ...(config.build ?? {}),
    devUrl,
    beforeDevCommand: `pnpm exec vite --host 127.0.0.1 --port ${devPort} --strictPort`
  };

  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  return {
    configPath,
    devUrl,
    cleanup: () => rm(tempDir, { recursive: true, force: true })
  };
}

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
  const [desktopPort, controlPort] = await Promise.all([
    reservePort(),
    reservePort()
  ]);
  const backendOrigin = `http://127.0.0.1:${controlPort}`;
  const tempConfig = await createTempTauriConfig(desktopPort);
  const desktop = run(
    "pnpm",
    ["exec", "tauri", "dev", "--config", tempConfig.configPath],
    {
      cwd: desktopWorkspace,
      env: {
        ...process.env,
        VITE_I_AM_MCP_BACKEND_ORIGIN: backendOrigin
      }
    }
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
      I_AM_MCP_CONTROL_PORT: String(controlPort)
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
