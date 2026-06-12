import { access, copyFile, chmod, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const backendRoot = fileURLToPath(new URL("../../backend", import.meta.url));
const sidecarBasePath = fileURLToPath(
  new URL("../src-tauri/bin/prompt-gui-mcp-node", import.meta.url)
);

function resolveTargetTriple() {
  const archMap = {
    arm64: "aarch64",
    x64: "x86_64"
  };
  const osMap = {
    darwin: "apple-darwin",
    linux: "unknown-linux-gnu",
    win32: "pc-windows-msvc"
  };

  const arch = archMap[process.arch];
  const os = osMap[process.platform];

  if (!arch || !os) {
    throw new Error(
      `Unsupported platform for sidecar preparation: ${process.platform}/${process.arch}`
    );
  }

  return `${arch}-${os}`;
}

async function main() {
  await execFileAsync("pnpm", ["build"], {
    cwd: backendRoot
  });

  const extension = process.platform === "win32" ? ".exe" : "";
  const targetTriple = resolveTargetTriple();
  const sidecarPath = `${sidecarBasePath}-${targetTriple}${extension}`;

  await mkdir(dirname(sidecarPath), { recursive: true });

  try {
    await access(sidecarPath);
  } catch {
    await copyFile(process.execPath, sidecarPath);

    if (process.platform !== "win32") {
      await chmod(sidecarPath, 0o755);
    }
  }

  console.log(
    `Prepared backend sidecar assets in ${join(repoRoot, "apps/desktop/src-tauri/bin")}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
