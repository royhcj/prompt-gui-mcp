import { access, chmod, copyFile, mkdtemp, rename, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const desktopRoot = fileURLToPath(new URL("../", import.meta.url));
const appBundlePath = fileURLToPath(
  new URL(
    "../src-tauri/target/release/bundle/macos/prompt-gui-mcp.app",
    import.meta.url
  )
);
const sidecarPath = `${appBundlePath}/Contents/MacOS/prompt-gui-mcp-node`;
const entitlementsPath = fileURLToPath(
  new URL("../src-tauri/Entitlements.plist", import.meta.url)
);

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function getSigningIdentity() {
  const explicitIdentity =
    process.env.I_AM_MCP_MACOS_SIGNING_IDENTITY ??
    process.env.APPLE_SIGNING_IDENTITY ??
    process.env.TAURI_SIGNING_IDENTITY;

  if (explicitIdentity) {
    return explicitIdentity;
  }

  const { stderr } = await execFileAsync("codesign", ["-dvv", appBundlePath], {
    cwd: desktopRoot
  });

  const authorityLine = stderr
    .split("\n")
    .find((line) => line.startsWith("Authority="));

  return authorityLine?.slice("Authority=".length) ?? null;
}

async function sign(path, identity) {
  await execFileAsync(
    "codesign",
    [
      "--force",
      "--options",
      "runtime",
      "--entitlements",
      entitlementsPath,
      "--sign",
      identity,
      path
    ],
    {
      cwd: desktopRoot
    }
  );
}

async function removeExtendedAttribute(path, attribute) {
  try {
    await execFileAsync("xattr", ["-dr", attribute, path], {
      cwd: desktopRoot
    });
  } catch {
    // Finder and Gatekeeper can add metadata that blocks replacing nested
    // signed binaries. Missing attributes are harmless.
  }
}

async function signViaReplacement(path, identity) {
  const tempDir = await mkdtemp(join(tmpdir(), "i-am-mcp-sidecar-"));
  const tempPath = join(tempDir, basename(path));

  try {
    const mode = (await stat(path)).mode;
    await copyFile(path, tempPath);
    await chmod(tempPath, mode);
    await sign(tempPath, identity);
    await removeExtendedAttribute(path, "com.apple.macl");
    await removeExtendedAttribute(path, "com.apple.provenance");
    await rename(tempPath, path);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function hasRequiredNodeEntitlements(path) {
  try {
    const { stdout, stderr } = await execFileAsync(
      "codesign",
      ["-d", "--entitlements", "-", path],
      {
        cwd: desktopRoot
      }
    );
    const output = `${stdout}\n${stderr}`;

    return [
      "com.apple.security.cs.allow-jit",
      "com.apple.security.cs.allow-unsigned-executable-memory"
    ].every((entitlement) => output.includes(entitlement));
  } catch {
    return false;
  }
}

async function main() {
  if (process.platform !== "darwin") {
    return;
  }

  if (!(await pathExists(appBundlePath))) {
    throw new Error(`macOS app bundle does not exist: ${appBundlePath}`);
  }

  if (!(await pathExists(sidecarPath))) {
    throw new Error(`macOS sidecar does not exist: ${sidecarPath}`);
  }

  const identity = await getSigningIdentity();

  if (!identity) {
    if (await hasRequiredNodeEntitlements(sidecarPath)) {
      console.log("macOS app is unsigned; sidecar already has Node entitlements.");
      return;
    }

    throw new Error(
      "Could not infer a macOS signing identity from the app bundle. Set I_AM_MCP_MACOS_SIGNING_IDENTITY."
    );
  }

  await removeExtendedAttribute(appBundlePath, "com.apple.macl");
  await removeExtendedAttribute(appBundlePath, "com.apple.provenance");
  await signViaReplacement(sidecarPath, identity);
  await sign(appBundlePath, identity);

  console.log(`Re-signed macOS sidecar with identity: ${identity}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
