# Pack and Upload Workflow

This is the release workflow we used to build the macOS desktop app and publish a new GitHub Release asset.

## Scope

This workflow applies to the macOS desktop app in:

- `apps/desktop`

It assumes the repository already has:

- A version bump ready to release
- A GitHub remote configured
- A locally installed macOS signing identity

## 1) Decide the release version

Use the next semantic version based on commits after the last tag.

Example:

- Last tag: `v0.1.1`
- New release: `v0.1.2`

Check commit distance from the last tag:

```bash
git log --no-merges --oneline v0.1.1..HEAD
```

If there is at least one real commit after the tag, create a new version instead of replacing the old release.

## 2) Bump version fields

Update all version fields that need to stay in sync:

- `package.json`
- `apps/backend/package.json`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/Cargo.toml`

If the backend reports its own MCP version strings, update those too:

- `apps/backend/src/index.ts`
- `apps/backend/scripts/simulate-tool-call.ts`

Then commit the version bump.

## 3) Build the desktop app

Build the packaged app from the desktop package:

```bash
pnpm --filter desktop tauri:build
```

If the signing helper cannot infer the right certificate automatically, set an explicit signing identity.

When the keychain contains duplicate matching certificates, use the certificate SHA-1 hash instead of the common name.

Example:

```bash
I_AM_MCP_MACOS_SIGNING_IDENTITY='D42309981F47BF2A09E8EB1D59B5CCA80554531D' pnpm --filter desktop tauri:build
```

This repo’s macOS build process will:

- Run the backend build first
- Build the frontend
- Bundle the `.app`
- Re-sign the sidecar and app on macOS

## 4) Verify the bundle

After build, verify the app bundle:

```bash
codesign --verify --deep --strict --verbose=2 apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app
codesign -dv --verbose=4 apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app
```

If the app bundle and sidecar are signed correctly, `codesign` should report a valid bundle and show the signing authority.

## 5) Package the DMG

Create a fresh DMG from the signed `.app` bundle:

```bash
TMPDIR=$(mktemp -d /tmp/prompt-gui-mcp-dmg.XXXXXX)
cp -R apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app "$TMPDIR/"
hdiutil create -volname "prompt-gui-mcp" -srcfolder "$TMPDIR" -ov -format UDZO \
  apps/desktop/src-tauri/target/release/bundle/dmg/prompt-gui-mcp_0.1.2_aarch64_signed.dmg
```

The release asset should be the signed DMG, not the raw `.app`.

## 6) Compute the checksum

Generate the SHA256 checksum for the release notes:

```bash
shasum -a 256 apps/desktop/src-tauri/target/release/bundle/dmg/prompt-gui-mcp_0.1.2_aarch64_signed.dmg
```

Copy the checksum into the release body.

## 7) Commit and tag the release

Commit the version bump:

```bash
git add package.json apps/backend/package.json apps/backend/src/index.ts apps/backend/scripts/simulate-tool-call.ts apps/desktop/package.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock apps/desktop/src-tauri/tauri.conf.json
git commit -m "Bump release version to 0.1.2"
```

Create and push the tag:

```bash
git tag v0.1.2
git push origin main v0.1.2
```

## 8) Create the GitHub Release

If `gh` is installed, you can use it. In the release run we used the GitHub API directly because `gh` was not installed in the environment.

The release can be created with the GitHub API using the stored GitHub credential from `git credential fill`.

If the release already exists, update it; otherwise create it.

Release body template:

```text
- Fixed macOS sidecar signing for packaged app.

SHA256 value with the DMG checksum:
<checksum>
```

Upload the DMG asset to the release:

- `prompt-gui-mcp_0.1.2_aarch64_signed.dmg`

## 9) Verify the release

Check that the GitHub release exists and the asset is attached:

- Release URL: `https://github.com/royhcj/prompt-gui-mcp/releases/tag/v0.1.2`
- Asset name: `prompt-gui-mcp_0.1.2_aarch64_signed.dmg`

Confirm the release body contains the checksum you computed.

## Notes

- If the machine does not have a `Developer ID Application` certificate, you can still build and sign locally with an Apple Development cert, but that is not enough for a Gatekeeper-clean notarized release.
- If you want notarization, add a `notarytool` submission and stapling step after the DMG is created.
- If the common-name signing identity is ambiguous, use the certificate SHA-1 hash instead.

