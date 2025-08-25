# Linkey v1.0.0-alpha.1 (First Pre-release)

> Early preview build – APIs and behavior may still change prior to the stable 1.0.0 release.

## Highlights

* Send a URL from the web UI to automatically open it on the host machine.
* Multi‑profile Chromium family support (Chrome/Brave/Chromium) with toggle for each browser profile.
* Ephemeral bearer token authentication with automatic rotation every 10 minutes.
* Lightweight frontend with keyboard shortcuts and toast feedback.

## Features

* Web UI form to submit a link (**Enter** or **Ctrl/Cmd+Enter**).
* Detection of local browser profile directories and profile names.
* Toggle profiles on/off with state persisted to disk in a platform-appropriate config directory.
* Periodic polling (15s) to refresh profile status.
* Token auto-refresh in the client every 9 minutes with 401 retry logic.
* Minimal toast notification system for success/error events.

## Security

* Bearer token auth (rotating unless `API_TOKEN` env var provided for fixed token scenarios).
* Grace period allows requests to complete during rotation; client re-fetches token proactively.
* **Reminder: `/token` endpoint is intentionally unauthenticated – designed for trusted local network use only. Do **not** expose publicly without additional controls (TLS, reverse proxy auth, etc.).**

## Build & Distribution

* GitHub Actions pre-release workflow publishes binaries and checksums on semver pre-release tags (`vX.Y.Z-<channel>.<n>`).
* Packaged via `pkg` targets:
  * `node18-macos-x64`
  * `node18-linux-x64`
  * `node18-win-x64`
* Release automation: GitHub Actions workflow (`.github/workflows/pre-release.yaml`) validates tag format, builds artifacts, generates `SHA256SUMS.txt`, and attaches everything to the GitHub pre-release.

## Usage (Quick Start)

1. Download the binary for your platform from the release assets.
2. Run it: `./linkey-launcher` (add `.exe` on Windows).
3. Open `http://localhost:3000/` in a browser on the same machine or trusted LAN.
4. (Optional) Set a fixed token: `API_TOKEN=yourtoken ./linkey-launcher` and then manually store it in `localStorage.linkeyToken` if needed.
5. Enable the desired browser profiles, paste a URL, confirm, and send.

## Checksums

`SHA256SUMS.txt` is included in the release for integrity verification:

```bash
sha256sum -c SHA256SUMS.txt
```

## Known Limitations

* Only Chromium-based browsers supported currently (Chrome, Brave, Chromium).
* No HTTPS/TLS termination.
* No multi-user isolation – intended for a single trusted operator.
* Minimal error reporting in UI for profile detection failures.

## Planned / Next Ideas

* Add stable (non pre-release) workflow for plain `vX.Y.Z` tags.
* Better UI confirmation modal instead of native `confirm` alert.
* Basic logging for troubleshooting.

## Changelog

* Initial implementation of Express launcher service.
* Added profile detection and profile toggle persistence.
* Added rotating token auth and client refresh logic.
* Added confirmation dialog before sending links.
* Added GitHub Actions pre-release workflow with asset publishing.
* Packaged cross-platform binaries.
