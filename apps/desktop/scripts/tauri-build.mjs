import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const desktopRoot = fileURLToPath(new URL("../", import.meta.url));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: desktopRoot,
      stdio: "inherit",
      shell: false
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with ${signal ?? code}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") {
    args.shift();
  }

  if (
    process.platform === "darwin" &&
    !args.includes("--bundles") &&
    !args.includes("-b") &&
    !args.includes("--no-bundle")
  ) {
    args.push("--bundles", "app");
  }

  await run("pnpm", ["exec", "tauri", "build", ...args]);

  if (process.platform === "darwin") {
    await run("node", ["scripts/repair-macos-sidecar-signing.mjs"]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
