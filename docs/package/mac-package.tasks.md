# macOS Package Distribution Tasks (GitHub)

## Setup

- [ ] Confirm Apple Developer Program membership is active.
- [ ] Confirm `Developer ID Application` certificate is installed locally.
- [ ] Confirm Xcode CLT is installed (`xcode-select --install` if missing).
- [ ] Confirm app bundle identifier, version, and build number are correct.
- [ ] Confirm Hardened Runtime is enabled for release build.
- [ ] Confirm required entitlements are configured.

## Build and Sign

- [ ] Build release app bundle (`YourApp.app`).
- [ ] List available code-signing identities (`security find-identity -v -p codesigning`).
- [ ] Sign app with `Developer ID Application` cert and runtime/timestamp options.
- [ ] Verify signature (`codesign --verify --deep --strict --verbose=2`).
- [ ] Inspect signature metadata (`codesign -dv --verbose=4`).

## Package and Notarize

- [ ] Create notarization upload artifact (ZIP/DMG/PKG).
- [ ] Configure `notarytool` credentials profile (one-time setup).
- [ ] Submit artifact to Apple notarization (`xcrun notarytool submit ... --wait`).
- [ ] Confirm notarization succeeded.

## Staple and Verify

- [ ] Staple notarization ticket to the final distributed artifact.
- [ ] Validate stapled ticket (`xcrun stapler validate ...`).
- [ ] Run Gatekeeper check (`spctl -a -t exec -vv ...`).
- [ ] Perform clean-machine or clean-user install/open test.

## GitHub Release

- [ ] Create and push version tag (for example `v1.0.0`).
- [ ] Create GitHub Release from the tag.
- [ ] Upload notarized + stapled artifact(s).
- [ ] Generate SHA256 checksum (`shasum -a 256 ...`).
- [ ] Add checksum and installation notes to release notes.

## Post-release Validation

- [ ] Download artifact from GitHub Release and re-check checksum.
- [ ] Verify first-run experience on another Mac (no bypass steps needed).
- [ ] Track and document any Gatekeeper/notarization issues for next release.

