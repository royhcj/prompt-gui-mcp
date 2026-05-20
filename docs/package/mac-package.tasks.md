# macOS Package Distribution Tasks (GitHub)

## Setup

- [x] Confirm Apple Developer Program membership is active.
- [x] Confirm `Developer ID Application` certificate is installed locally.
- [x] Confirm Xcode CLT is installed (`xcode-select --install` if missing).
- [x] Confirm app bundle identifier, version, and build number are correct.
- [x] Confirm Hardened Runtime is enabled for release build.
- [x] Confirm required entitlements are configured.

## Build and Sign

- [x] Build release app bundle (`YourApp.app`).
- [x] List available code-signing identities (`security find-identity -v -p codesigning`).
- [x] Sign app with `Developer ID Application` cert and runtime/timestamp options.
- [x] Verify signature (`codesign --verify --deep --strict --verbose=2`).
- [ ] Inspect signature metadata (`codesign -dv --verbose=4`).

## Package and Notarize

- [x] Create notarization upload artifact (ZIP/DMG/PKG).
- [x] Configure `notarytool` credentials profile (one-time setup).
- [x] Submit artifact to Apple notarization (`xcrun notarytool submit ... --wait`).
- [x] Confirm notarization succeeded.

## Staple and Verify

- [x] Staple notarization ticket to the final distributed artifact.
- [x] Validate stapled ticket (`xcrun stapler validate ...`).
- [x] Run Gatekeeper check (`spctl -a -t exec -vv ...`).
- [ ] Perform clean-machine or clean-user install/open test.

## GitHub Release

- [x] Create and push version tag (for example `v1.0.0`).
- [x] Create GitHub Release from the tag.
- [x] Upload notarized + stapled artifact(s).
- [x] Generate SHA256 checksum (`shasum -a 256 ...`).
- [x] Add checksum and installation notes to release notes.

## Post-release Validation

- [ ] Download artifact from GitHub Release and re-check checksum.
- [ ] Verify first-run experience on another Mac (no bypass steps needed).
- [ ] Track and document any Gatekeeper/notarization issues for next release.
