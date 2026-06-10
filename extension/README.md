# ChatVault — browser extension

One-click export of the current **ChatGPT** or **Claude** conversation to ChatVault. Scrapes the rendered DOM, captures attachment binaries via in-page fetch interception, normalizes everything into the same schema as the ZIP-import path, and opens the web app with the conversation pre-loaded.

## Status

v0.6.0. Submitted to the Chrome Web Store on 2026-06-09; install link will land here once review completes.

Currently supports:

- **chatgpt.com** and **chat.openai.com** — full attachment capture (text, images, PDFs, MLX, IPYNB, any file type) via fetch interception + auto-click + orphan sweep.
- **claude.ai** — full transcript scrape plus attachment binaries:
  - Images and PDFs via the page's own `/api/{org}/files/{uuid}/preview` URLs.
  - Text-extractable file types (`.py`, `.m`, `.ipynb`, `.md`, `.csv`, etc.) via the `extracted_content` field in Claude's conversation API.
  - Blob uploads (`.mlx`, `.mat`, etc. with `file_kind: "blob"`) are not exposed by Claude's public API — these come through with a "use the Takeout export instead" placeholder.

A Gemini extension scraper is future work; the Takeout ZIP path on chatvault.space already covers Gemini for most users.

## Install (developer mode)

1. Open `chrome://extensions/` in Chrome (or `edge://extensions/` in Edge — same flow).
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked**.
4. Pick this `extension/` folder.
5. Pin the extension to your toolbar so the icon is easy to click.

## Use

1. Open a conversation on ChatGPT or Claude.
2. Click the ChatVault icon → **Export this conversation**.
3. A new tab opens at <https://chatvault.space> with the conversation already loaded in the preview screen. Tweak options and download as PDF, Markdown, or JSON (`.zip` containing the markdown/JSON plus an `attachments/` folder when any binaries were captured).

## Architecture

The extension has two scripts running in different worlds and a small popup:

```
┌──────────────────────────────────────────────┐
│  PAGE MAIN world (lib/page-bridge.js)        │
│  – wraps window.fetch + XMLHttpRequest       │
│  – captures attachment binaries              │
│  – harvests file_ids from conversation API   │
│  – auto-prefetches; replays page headers     │
│  – follows download_url → CDN binary         │
└──────────────────────────────────────────────┘
                  ↓ window.postMessage
┌──────────────────────────────────────────────┐
│  ISOLATED world (per-provider content js)    │
│  – DOM walk → NormalizedConversation         │
│  – attachment detection (any file extension) │
│  – auto-click for uncached attachments       │
│  – orphan sweep by file_id                   │
└──────────────────────────────────────────────┘
                  ↓ chrome.runtime.sendMessage
┌──────────────────────────────────────────────┐
│  background.js (service worker)              │
│  – stores conversation in chrome.storage     │
│  – opens chatvault.space/#from-extension     │
└──────────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────────┐
│  content-chatvault.js (bridge on our domain) │
│  – reads chrome.storage                      │
│  – window.postMessage to web app             │
└──────────────────────────────────────────────┘
                  ↓
              ChatVault preview screen
```

## Attachment capture flow

ChatGPT (and Claude) gate file binaries behind auth tokens we can't replicate from outside the page. The extension works around that with five strategies, applied in order:

1. **Passive interception** — the page renders inline images/thumbnails, and the bridge intercepts those fetches, reading the filename from `Content-Disposition`. Free capture, no clicks.
2. **Conversation API harvest** — the bridge reads `/backend-api/conversation/{id}` to find every `file_xxx` ID referenced in the chat.
3. **Auto-prefetch** — for each harvested file_id, the bridge calls the metadata endpoint with replayed request headers and follows the resulting CDN URL. Works for files the API will serve without per-request tokens.
4. **Auto-click** — for anything still missing, the content script finds the attachment card in the message DOM (button/link/cursor:pointer element containing the filename) and dispatches a click. The page's own React Query layer fetches the binary with proper auth; the bridge intercepts; the modal is dismissed via Escape + close-button fallback.
5. **Orphan sweep** — at the end of extraction, any cached binary not already attached to a message is matched by `file_id` against each message's DOM and attached to the right one.

## File files

- **`manifest.json`** — MV3, scoped host permissions, three content_scripts entries (MAIN world bridge, isolated content scripts, and a small bridge on chatvault.space for the storage handoff).
- **`lib/page-bridge.js`** — runs in the page's MAIN world at `document_start`. Wraps `fetch` and `XMLHttpRequest`, captures responses from known CDN/file URLs (`oaiusercontent.com`, `chatgpt.com/backend-api/estuary/...`, `files.anthropic.com`, etc.), follows JSON metadata responses to their `download_url`, captures filenames from `Content-Disposition`, and exposes an on-demand fetch listener for the content script.
- **`lib/html-to-markdown.js`** — shared DOM → markdown walker. Handles code fences with language tags, lists, headings, bold/italic, links, tables, blockquotes.
- **`lib/fetch-attachment.js`** — isolated-world cache that mirrors the bridge's captures. Exposes `__chatvaultCapturedAttachment(filename)` and `__chatvaultCapturedAttachmentByUrl(url)`.
- **`lib/attachment-detection.js`** — finds attachment-shaped things in a message DOM: anchor tags + image tags with attachment URLs, plus a card-based heuristic that matches any `filename.ext` pattern (where ext is 2-10 alphanumeric chars) inside a compact container. Skips text inside `<code>`/`<pre>`/`<kbd>`/`<samp>` to avoid false positives.
- **`lib/auto-click.js`** — for uncached detected attachments, finds a clickable element (button / link / role=button / cursor:pointer) whose text or `aria-label` contains the filename, dispatches a click, waits for the bridge to populate the cache, then dismisses the modal.
- **`content-chatgpt.js` / `content-claude.js`** — per-provider message extractor + orchestrator. Calls the libraries above in order: detect → proactively fetch → auto-click → orphan sweep.
- **`content-chatvault.js`** — runs on chatvault.space; pulls the pending conversation out of `chrome.storage.local` and posts it to the web app.
- **`background.js`** — service worker. Receives "export" from the popup, talks to the active tab's content script, stores the conversation in `chrome.storage.local`, opens chatvault.space.
- **`popup.html` / `popup.js` / `popup.css`** — small UI: title + one button + status line.

## Data flow

```
ChatGPT / Claude tab
  │
  ├─► page-bridge.js (MAIN world)
  │   captures file binaries → window.postMessage
  │
  ├─► content-{chatgpt,claude}.js (isolated world)
  │   message DOM → NormalizedConversation
  │   + attachments from cache
  │
  └─► background.js
      chrome.storage.local.set({"chatvault.pending": conversation})
      open https://chatvault.space/#from-extension
              │
              ▼
     content-chatvault.js on chatvault.space
              │
              ▼
     window.postMessage to App.tsx
              │
              ▼
     Preview screen with chips + downloads
```

The chrome.storage handoff means there's no URL fragment size limit — multi-MB PDFs and other large binaries pass cleanly.

## Regenerating icons

The four PNG icons are produced by a small Node script that uses only built-in modules (no native deps):

```bash
node extension/scripts/generate-icons.mjs
```

Tweak the `FILL` constant in that file to recolor.

## Caveats

- **DOM scraping is fragile.** ChatGPT and Claude can change their markup and break the content scripts anytime. Auto-click is the most exposed surface — if a provider redesigns its attachment viewer or modal-close behavior, the binary capture will silently fall back to "filename only".
- **Per-request auth.** The auto-prefetch path returns 404/422 for some files because the provider's API requires per-click sentinel tokens. Auto-click works around this by using the page's own session.
- **Auto-click flicker.** Documents (PDFs, MLX, IPYNB, etc.) trigger a brief modal-open / modal-close per file during export. Capped at 10 to bound the disruption.
- **No backend, no telemetry, no analytics.** The extension's only network destination outside the AI provider's domain is opening chatvault.space as a new tab.
