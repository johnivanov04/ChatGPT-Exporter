# ChatVault — browser extension

One-click export of the current **ChatGPT** or **Claude** conversation to ChatVault. Scrapes the rendered DOM, normalizes it into the same schema as the ZIP-import path, and opens the web app with the conversation pre-loaded.

## Status

v0.2.0. Supports:

- **chatgpt.com** and **chat.openai.com**
- **claude.ai**

A Gemini scraper is a future thing — Gemini's structure differs more, and the Takeout ZIP path covers most use cases already.

## Install (developer mode)

1. Open `chrome://extensions/` in Chrome (or `edge://extensions/` in Edge — same flow).
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked**.
4. Pick this `extension/` folder.
5. Pin the extension to your toolbar so the icon is easy to click.

## Use

1. Open a conversation on ChatGPT or Claude.
2. Click the ChatVault icon → **Export this conversation**.
3. A new tab opens at <https://chatvault.space> with the conversation already loaded in the preview screen. Tweak options and download as PDF, Markdown, or JSON.

## How it works

- **`manifest.json`** — MV3 manifest. Host permissions scoped to `chatgpt.com`, `chat.openai.com`, and `claude.ai` only.
- **`lib/html-to-markdown.js`** — shared DOM walker. Converts rendered HTML to markdown-ish text (preserves code fences with language tags, lists, headings, bold/italic, links, tables, blockquotes, images). Exposed as `window.__chatvaultHtmlToMarkdown(node)`.
- **`content-chatgpt.js`** — runs on ChatGPT pages. Walks every `[data-message-author-role]` node, extracts role + content via the shared walker.
- **`content-claude.js`** — runs on Claude pages. Tries several selectors in order: `[data-testid="user-message"]` / `[data-testid="assistant-message"]` first, then `.font-user-message` / `.font-claude-message`, then a generic `main .group` fallback alternating user/assistant by DOM order.
- **`background.js`** — service worker. On a popup "export" message, sends `{kind: "extract"}` to the active tab's content script, base64url-encodes the returned JSON, and opens `https://chatvault.space/#import=<payload>`.
- **`popup.html` / `popup.js` / `popup.css`** — small UI: title + one button + status line. Greys out the button when not on a supported tab.

## Data flow

```
ChatGPT or Claude tab DOM
        ↓ (content-*.js + html-to-markdown.js)
    NormalizedConversation
        ↓ (background.js, base64url-encode)
chatvault.space/#import=<payload>
        ↓ (App.tsx tryParseImportHash)
    preview screen
```

The URL fragment (`#...`) is purely client-side — it is never sent to any server.

## Regenerating icons

The four PNG icons are produced by a small Node script that uses only built-in modules (no native deps):

```bash
node extension/scripts/generate-icons.mjs
```

Tweak the `FILL` constant in that file to recolor.

## Caveats

- DOM scraping is fragile. ChatGPT and Claude can change their markup and break the content scripts anytime. The Claude script tries three selector strategies in order, so it's a bit more resilient, but a redesign can still take it down. If "Export this conversation" returns "No messages found", the markup probably changed.
- Long conversations encode to large URL fragments. Chrome handles many megabytes in a URL fragment, so this only matters in extreme cases.
- The extension does not include any backend, telemetry, or analytics. It cannot make network requests anywhere except to open ChatVault as a new tab.
