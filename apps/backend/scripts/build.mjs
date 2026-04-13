import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const backendRoot = fileURLToPath(new URL("../", import.meta.url));
const pnpmStoreDir = fileURLToPath(
  new URL("../../../node_modules/.pnpm", import.meta.url)
);

async function resolveEsbuildBinary() {
  const entries = await readdir(pnpmStoreDir, { withFileTypes: true });
  const candidate = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("esbuild@"))
    .map((entry) => entry.name)
    .sort()[0];

  if (!candidate) {
    throw new Error("Could not locate esbuild in the pnpm store.");
  }

  return `${pnpmStoreDir}/${candidate}/node_modules/esbuild/bin/esbuild`;
}

async function main() {
  const esbuildBinary = await resolveEsbuildBinary();

  await execFileAsync(esbuildBinary, [
    "src/index.ts",
    "scripts/simulate-tool-call.ts",
    "--bundle",
    "--format=cjs",
    "--platform=node",
    "--target=node22",
    "--out-extension:.js=.cjs",
    "--outdir=dist",
    "--outbase=.",
    "--sourcemap"
  ], {
    cwd: backendRoot
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
