# ChatVault — browser extension

One-click export of the current ChatGPT conversation to ChatVault. Scrapes the rendered DOM, normalizes it into the same schema as the ZIP-import path, and opens the web app with the conversation pre-loaded.

## Status

MVP. Supports **chatgpt.com** and **chat.openai.com**. Claude and Gemini extensions are a future thing.

## Install (developer mode)

1. Open `chrome://extensions/` in Chrome (or `edge://extensions/` in Edge — same flow).
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked**.
4. Pick this `extension/` folder.
5. Pin the extension to your toolbar so the icon is easy to click.

## Use

1. Open a ChatGPT conversation.
2. Click the ChatVault icon → **Export this conversation**.
3. A new tab opens at <https://chatvault.space> with the conversation already loaded in the preview screen. Tweak options and download as PDF, Markdown, or JSON.

## How it works

- **`manifest.json`** — MV3 manifest. Host permissions limited to `chatgpt.com` and `chat.openai.com`; no other site access.
- **`content-chatgpt.js`** — runs on ChatGPT pages. Walks every `[data-message-author-role]` node, extracts role + content (with light HTML → Markdown conversion that preserves code fences, lists, headings, bold/italic, links, tables). Returns a `NormalizedConversation`.
- **`background.js`** — service worker. On a popup "export" message, talks to the content script, base64url-encodes the JSON, and opens `https://chatvault.space/#import=<payload>`.
- **`popup.html` / `popup.js` / `popup.css`** — small UI: title + one button + status line.

## Data flow

```
ChatGPT tab DOM  →  content-chatgpt.js  →  background.js (b64url encode)
                                            ↓
                            chatvault.space/#import=<payload>
                                            ↓
                    App.tsx tryParseImportHash → preview screen
```

The URL fragment (`#...`) is purely client-side — it is never sent to any server.

## Regenerating icons

The four PNG icons are produced by a small Node script that uses only built-in modules (no native deps):

```bash
node extension/scripts/generate-icons.mjs
```

Tweak the `FILL` constant in that file to recolor.

## Caveats

- DOM scraping is fragile. ChatGPT can change its markup and break the content script. If "Export this conversation" returns "No messages found", inspect the page — the `[data-message-author-role]` attribute may have been renamed.
- Long conversations encode to large URL fragments. Chrome handles many megabytes in a URL fragment, so this only matters in extreme cases. If a conversation ever fails to load, that's the first thing to check.
- The extension does not include any backend, telemetry, or analytics. It cannot make network requests anywhere except to open ChatVault as a new tab.
