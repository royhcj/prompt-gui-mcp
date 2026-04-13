import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

export const desktopWorkspace = fileURLToPath(new URL("../", import.meta.url));
const tauriConfigPath = fileURLToPath(
  new URL("../src-tauri/tauri.conf.json", import.meta.url)
);

export async function readTauriConfig() {
  const raw = await readFile(tauriConfigPath, "utf8");
  return JSON.parse(raw);
}

export async function reservePort() {
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

export async function createTempTauriConfig(devPort, beforeDevCommand) {
  const config = await readTauriConfig();
  const tempDir = await mkdtemp(join(tmpdir(), "i-am-mcp-tauri-"));
  const configPath = join(tempDir, "tauri.temp.conf.json");
  const devUrl = `http://127.0.0.1:${devPort}`;

  config.build = {
    ...(config.build ?? {}),
    devUrl,
    beforeDevCommand
  };

  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  return {
    configPath,
    devUrl,
    cleanup: () => rm(tempDir, { recursive: true, force: true })
  };
}
