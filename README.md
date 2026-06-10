# ChatVault

> Local-first AI conversation exporter. Live at **<https://chatvault.space>**.

Converts ChatGPT / Claude / Gemini chats into clean **PDF**, **Markdown**, or **JSON** files. Drop in a data-export ZIP, paste a transcript, or one-click export from a chat tab with the browser extension. Everything happens in your browser — no backend, no accounts, no uploads.

## What you can do with it

- **Upload a data-export ZIP** from any of ChatGPT, Claude, or Gemini (Google Takeout). Auto-detects which provider and uses the right parser.
- **Paste a transcript** as a fallback. Recognizes `User:` / `[User]` / `You said:` markers and falls back to a heuristic for ChatGPT page copies (attachment filenames + `Thought for X` markers as structural anchors).
- **Use the browser extension** to export your *current* ChatGPT or Claude tab in one click — including attached files. See [`extension/README.md`](extension/README.md) for the architecture.
- **Preview** the full transcript with markdown rendering and role-distinguished messages, then download as PDF / Markdown / JSON (or `.zip` when attachments are present, containing the markdown/JSON plus an `attachments/` folder).
- **Redact** emails / phone numbers / API keys (provider-specific patterns for OpenAI / Anthropic / AWS / Stripe / GitHub / Google / Slack) live in the preview before exporting.
- **Try a sample** conversation right from the landing page — no upload required, just hit "see a sample conversation" to drop into the Preview screen with a demo chat.
- **Install as a PWA** — Chrome/Edge offer an install button; on iOS use "Add to Home Screen". The app shell is precached so it works offline.

## Multi-provider matrix

| Provider | ZIP import | Manual paste | Extension | Attachment binaries |
|---|---|---|---|---|
| **ChatGPT** | ✓ (text, multimodal, code, execution, thoughts, reasoning, browsing) | ✓ (classic markers + page-copy heuristic) | ✓ | ✓ (all file types via fetch interception + auto-click) |
| **Claude** | ✓ (`text` / `image` / `tool_use` / `tool_result` content blocks, attachments, files) | ✓ | ✓ | ✓ for images, PDFs, and text-extractable files (`.py`, `.ipynb`, `.m`, etc. via Claude's `extracted_content`). Binary uploads like `.mlx` are sandbox-only and not exposed by Claude's public API. |
| **Gemini** | ✓ (Google Takeout activity log, session-grouped by time gap) | — | — | — |

## Privacy

- No backend, no database, no accounts.
- Files read with JSZip in memory and discarded when the tab closes.
- Nothing persisted to `localStorage` by default.
- Redaction is best-effort; the app reminds you to review exports before sharing.
- The browser extension has no telemetry and only opens chatvault.space as a new tab.

## Quick start

Use it at <https://chatvault.space>. Or run it locally:

```bash
git clone https://github.com/johnivanov04/ChatVault.git
cd ChatVault
npm install
npm run dev
```

Open <http://localhost:5173/>. For the extension, see [`extension/README.md`](extension/README.md).

## Usage flow

1. **Landing** — pick ZIP, paste, or use the extension.
2. **Upload / paste** — the ZIP parser locates and identifies the provider's conversation file; the paste parser splits by marker or by heuristic.
3. **Picker** *(ZIP only)* — search by title or content, sorted newest first.
4. **Preview** — full transcript, markdown rendered, internal messages hidden by default. Side panel toggles export options + redaction in real time, with live counts of bundled attachments.
5. **Download** — Markdown, JSON, or Save as PDF (browser print). Markdown/JSON ship as `.zip` with an `attachments/` folder if any binaries were captured.

## Development

```bash
npm run dev          # Vite dev server on :5173
npm run build        # tsc -b + vite build (emits PWA assets via vite-plugin-pwa)
npm test             # vitest run (344 unit tests)
npm run test:watch   # vitest in watch mode
npm run lint         # eslint
```

## Tech stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** + `@tailwindcss/typography`
- **JSZip** for in-browser ZIP extraction
- **react-markdown** + **remark-gfm** for transcript rendering
- **lucide-react** for icons
- **Vitest** + **jsdom** for unit tests

No backend, no database. All compute is inside the browser.

## Project structure

```
src/
  App.tsx                        top-level stage router (history-integrated, extension-import-aware)
  components/
    Landing.tsx                  input choice cards + hero
    UploadZip.tsx                drag-and-drop, huge-file warning, provider auto-detect
    ConversationPicker.tsx       searchable, sorted-newest-first list
    ConversationPreview.tsx      two-column view + side panel + orphan-attachment sweep
    ExportOptionsPanel.tsx       view + export + redaction options + attachment summary
    ManualPasteInput.tsx         textarea + live role-count preview
    PrintView.tsx                print-only layout for PDF export
    HowToExport.tsx              per-provider export instructions
    AttachmentChip.tsx           clickable attachment pill (downloads binary)
  lib/
    zip/                         readZip, multi-provider findConversationFile
    parsers/                     parseChatGptExport, parseClaudeExport,
                                 parseGeminiExport, parseManualPaste,
                                 normalizeConversation
    exporters/                   exportMarkdown, exportJson, printPdf,
                                 buildExportZip (sidecar attachments folder)
    redaction/                   redactText, redactConversation
    import/                      extensionImport (URL-fragment + postMessage bridge)
    utils/                       date, downloadFile, safeStringify,
                                 conversationSummary
  types/
    conversation.ts              NormalizedConversation, NormalizedMessage,
                                 NormalizedAttachment, ExportOptions,
                                 Provider, ConversationSource
  data/
    sampleConversation.ts        the demo chat loaded by the "see a sample" link

extension/                       MV3 browser extension (see extension/README.md)
  manifest.json
  background.js                  service worker
  content-{chatgpt,claude,chatvault}.js   per-site content scripts
  lib/                           page-bridge (MAIN world), html-to-markdown,
                                 attachment-detection, fetch-attachment, auto-click
  popup.{html,js,css}            toolbar UI
```

## License

MIT
