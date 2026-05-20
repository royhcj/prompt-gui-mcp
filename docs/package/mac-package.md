# macOS Packaging and Distribution (GitHub, Developer ID + Notarization)

This guide explains how to package a macOS app for distribution on GitHub so users can download and open it with normal Gatekeeper behavior.

## 1) Prerequisites

1. Apple Developer Program membership (paid).
2. A `Developer ID Application` certificate installed in your keychain.
3. Xcode Command Line Tools installed (`xcode-select --install`).
4. App bundle ready (`YourApp.app`) with:
   - Correct bundle identifier.
   - Hardened Runtime enabled.
   - Required entitlements configured.

## 2) Build a release app

Build your release `.app` from Xcode/your build system.

Example output:

```bash
dist/YourApp.app
```

## 3) Sign the app (Developer ID)

Find your signing identity:

```bash
security find-identity -v -p codesigning
```

Sign the app:

```bash
codesign --force --deep --options runtime --timestamp \
  --sign "Developer ID Application: YOUR_NAME (TEAMID)" \
  dist/YourApp.app
```

Verify signature:

```bash
codesign --verify --deep --strict --verbose=2 dist/YourApp.app
codesign -dv --verbose=4 dist/YourApp.app
```

## 4) Package for distribution (.dmg recommended)

Create a ZIP for notarization upload (Apple accepts ZIP/DMG/PKG depending on workflow):

```bash
ditto -c -k --keepParent dist/YourApp.app dist/YourApp.zip
```

Optionally create a `.dmg` for end users (common UX: drag app to Applications).
Notarize the file you plan to distribute.

## 5) Create notarization credentials (one-time setup)

Use an App Store Connect API key (recommended) or Apple ID app-specific password.

Store credentials profile for `notarytool`:

```bash
xcrun notarytool store-credentials "notary-profile" \
  --apple-id "you@example.com" \
  --team-id "TEAMID" \
  --password "app-specific-password"
```

## 6) Submit to notarization

Submit and wait:

```bash
xcrun notarytool submit dist/YourApp.zip \
  --keychain-profile "notary-profile" \
  --wait
```

If success, notarization is accepted by Apple.

## 7) Staple notarization ticket

If distributing `.app` directly:

```bash
xcrun stapler staple dist/YourApp.app
```

If distributing `.dmg`:

```bash
xcrun stapler staple dist/YourApp.dmg
```

Validate stapling:

```bash
xcrun stapler validate dist/YourApp.app
```

## 8) Final Gatekeeper checks

Run local policy check:

```bash
spctl -a -t exec -vv dist/YourApp.app
```

Recommended: test on a clean Mac user account or another machine.

## 9) Publish to GitHub Releases

1. Create and push a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

2. In GitHub repository, create a Release from that tag.
3. Upload notarized artifact(s), usually:
   - `YourApp.dmg` (or notarized ZIP/app bundle package)
4. Include SHA256 checksum in release notes:

```bash
shasum -a 256 dist/YourApp.dmg
```

## 10) Common failure points

1. Wrong certificate type (must be `Developer ID Application` for app signing).
2. Hardened Runtime not enabled.
3. Missing entitlements or invalid entitlements.
4. Unsinged nested binaries/frameworks in app bundle.
5. Notarizing one file, distributing a different unstapled file.

## Minimal release checklist

1. Build release `.app`
2. Sign with Developer ID + runtime + timestamp
3. Notarize upload artifact
4. Staple distributed artifact
5. Verify with `codesign`, `spctl`, and install test
6. Upload to GitHub Release

## Project command log (sanitized)

Below is the exact command flow used for this repository (`prompt-gui-mcp`), with sensitive data masked.

### A) Verify current config and identities

```bash
# Verify bundle identifier in Tauri config
rg -n "identifier|bundle|promptguimcp|prompt-gui-mcp" \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/tauri.conf.json \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/Cargo.toml \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/src/main.rs

# List code signing identities
security find-identity -v -p codesigning

# Check Developer ID identity exists
security find-identity -v -p codesigning | grep "Developer ID Application"
```

### B) Build release app

```bash
cd /Users/roy/dev/projects/i-am-mcp/i-am-mcp
pnpm --filter desktop tauri:build

# Confirm app exists
ls -la /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app
```

### C) Sign and verify app

```bash
codesign --force --deep --options runtime --timestamp \
  --sign "Developer ID Application: <COMPANY_NAME> (<TEAM_ID>)" \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app

codesign --verify --deep --strict --verbose=2 \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app
```

### D) Store notarization credentials (one-time)

```bash
xcrun notarytool store-credentials "notary-profile" \
  --apple-id "<APPLE_ID_EMAIL>" \
  --team-id "<TEAM_ID>" \
  --password "<APP_SPECIFIC_PASSWORD>"
```

### E) Notarize app ZIP and staple app

```bash
ditto -c -k --keepParent \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.zip

xcrun notarytool submit \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.zip \
  --keychain-profile "notary-profile" \
  --wait

xcrun stapler staple \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app

xcrun stapler validate \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app

spctl -a -t exec -vv \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app
```

### F) DMG notarization flow used (including fix)

```bash
# Initial DMG submit (failed as Invalid)
xcrun notarytool submit \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/dmg/prompt-gui-mcp_0.1.0_aarch64.dmg \
  --keychain-profile "notary-profile" \
  --wait

# Fetch notarization log for failure diagnosis
xcrun notarytool log <NOTARY_SUBMISSION_ID> \
  --keychain-profile "notary-profile"

# Repack fresh DMG from already-signed app
mkdir -p /tmp/prompt-gui-mcp-dmg
rm -rf /tmp/prompt-gui-mcp-dmg/prompt-gui-mcp.app
cp -R /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/macos/prompt-gui-mcp.app /tmp/prompt-gui-mcp-dmg/

codesign --verify --deep --strict --verbose=2 /tmp/prompt-gui-mcp-dmg/prompt-gui-mcp.app

hdiutil create -volname "prompt-gui-mcp" -srcfolder /tmp/prompt-gui-mcp-dmg -ov -format UDZO \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/dmg/prompt-gui-mcp_0.1.0_aarch64_signed.dmg

# Submit fixed DMG, then staple/validate
xcrun notarytool submit \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/dmg/prompt-gui-mcp_0.1.0_aarch64_signed.dmg \
  --keychain-profile "notary-profile" \
  --wait

xcrun stapler staple \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/dmg/prompt-gui-mcp_0.1.0_aarch64_signed.dmg

xcrun stapler validate \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/dmg/prompt-gui-mcp_0.1.0_aarch64_signed.dmg
```

### G) GitHub release

```bash
# Generate checksum for release notes
shasum -a 256 \
  /Users/roy/dev/projects/i-am-mcp/i-am-mcp/apps/desktop/src-tauri/target/release/bundle/dmg/prompt-gui-mcp_0.1.0_aarch64_signed.dmg

# Tag and push
git tag v0.1.0
git push origin v0.1.0
```

### Sensitive data masking rules

Use placeholders in docs, scripts, logs, or screenshots:

- `<APPLE_ID_EMAIL>`
- `<APP_SPECIFIC_PASSWORD>`
- `<TEAM_ID>`
- `<COMPANY_NAME>`
- `<NOTARY_SUBMISSION_ID>`
