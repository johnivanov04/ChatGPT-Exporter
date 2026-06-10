# Changelog

All notable changes to ChatVault. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are joint across the web app and the browser extension.

## [0.6.0] — 2026-06-10

### Added

- **Dark theme + steel/brass brand identity** across the web app, extension popup, favicon, and OG image. New vault icon (a safe with a parchment document slipping into the slot) replaces the lightning bolt.
- **PWA** — `chatvault.space` is now installable. Service worker precaches the app shell so the site works offline after first load. Add-to-home-screen icons and theme color wired up.
- **Sample conversation** — landing page now has a "see a sample conversation" link that drops visitors straight into the Preview screen with a realistic four-turn Python demo. Lets people try the full UI without uploading anything.
- **Claude attachment capture** — extension now retrieves attachment binaries from claude.ai:
  - Images and PDFs via the page's own `/api/.../files/.../preview` URLs.
  - Text-extractable file types (`.py`, `.m`, `.ipynb`, `.md`, etc.) via the `extracted_content` field in Claude's conversation API.
  - Honest "not available" error for blob uploads like `.mlx` that Claude doesn't expose via its public API.
- **Privacy policy** page at `/privacy` (also linked from the footer).
- **Footer** with Privacy and GitHub links plus version.

### Changed

- **Extension v0.5.0 → v0.6.0** submitted to the Chrome Web Store. Manifest description sharpened to mention attachments.
- **Faster Claude exports** — skip auto-click for files we already have via the conversation API harvest. Saves ~5s per file.
- Vault icon rasterized via `rsvg-convert` instead of solid color squares — extension toolbar icons and Web Store listing icon now show the real vault design.
- Tailwind palette: `violet-*` and `fuchsia-*` swapped to `amber-*` and `slate-*` throughout. Primary CTAs use a brass gradient (`from-amber-400 to-amber-600`).

### Fixed

- Empty filename extension `.m` (MATLAB) wasn't matching the attachment detection regex (required ext length ≥ 2). Lowered to ≥ 1 with a letter-required guard so KaTeX number fragments like `267.44` still don't trigger.
- KaTeX equations were generating false-positive attachment detections in Claude assistant messages.
- Claude attachment thumbnails live outside the message bubble DOM; detection now expands to the turn container so they're in scope.

## [0.5.0] — 2026-06-08

### Added

- Browser extension MV3 for ChatGPT and Claude with one-click export.
- ChatGPT attachment binary capture (Tier B): five-layer pipeline of passive interception, conversation API harvest, auto-prefetch, auto-click, and orphan sweep.
- Permissive filename detection — any `name.ext` with 2–10 char extension, code-block context filter to avoid false positives.

### Changed

- UI redesign: cleaner typography, gradient brand wordmark, role-distinguished message bubbles.

## [0.4.0] — earlier

- Multi-provider support (ChatGPT, Claude, Gemini).
- In-app export instructions per provider.
- Browser back/forward navigation between stages.
- Manual paste heuristic for ChatGPT page-copies (attachment filenames + "Thought for X" markers).

## [0.1.0] — initial MVP

- ChatGPT export ZIP import.
- Preview with markdown rendering.
- PDF / Markdown / JSON export.
- Best-effort redaction (emails, phone numbers, API keys).
