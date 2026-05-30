# ChatGPT Conversation Exporter

A local-first web app that converts ChatGPT conversations into clean **PDF**, **Markdown**, and **JSON** files. Drop in your ChatGPT data export ZIP (or paste a transcript), pick a chat, preview it, and download. Everything happens in your browser — no backend, no accounts, no uploads.

## Features

- **ChatGPT export ZIP support** — finds `conversations.json` (or falls back by structural shape), normalizes the mapping/tree into a clean message list, handles every content type seen in real exports (text, multimodal with images, code, execution output, thoughts, reasoning recaps, browsing).
- **Manual paste fallback** — recognizes classic `User:` / `[User]` / `Assistant:` markers, the modern `You said:` / `ChatGPT said:` labels, and a heuristic strategy for plain page-copies (uses attachment filenames and `Thought for X` markers as structural anchors).
- **Searchable picker** — sort newest first, AND-of-terms search across title and message content.
- **Transcript preview** — role-distinguished messages, markdown rendered (paragraphs, lists, code fences, GFM tables), toggleable "internal" filter that hides system/tool/reasoning noise by default.
- **Three exporters** — driven by the same option toggles (front-page metadata, timestamps, message numbers, source metadata, redaction). What you see is what you download.
- **Best-effort redaction** — emails, phone numbers (multiple formats with date/IP/version-string guards), and provider-specific API keys (OpenAI, Anthropic, AWS, Stripe, GitHub PATs, Google, Slack). WYSIWYG: the preview shows redactions live.
- **PDF via browser print** — clean cover page + serif transcript body, page-break-friendly, code blocks legible on paper.

## Privacy

- No backend, no database, no accounts.
- Files are read with JSZip in memory and discarded when the tab closes.
- Nothing is persisted to `localStorage` by default.
- Redaction is best-effort; the app warns you to review exports before sharing.

## Quick start

```bash
git clone https://github.com/johnivanov04/ChatGPT-Exporter.git
cd ChatGPT-Exporter
npm install
npm run dev
```

Open <http://localhost:5173/> and either drop your ChatGPT export ZIP onto the page or click "Paste Chat Manually".

To get an export ZIP from ChatGPT: **Settings → Data Controls → Export data**. The download arrives by email and contains all of your conversation history. This app lets you pick one chat at a time to export.

## Usage flow

1. **Landing** — pick ZIP or paste.
2. **Upload / paste** — the ZIP parser locates `conversations.json` and normalizes all conversations; the paste parser splits by marker or by heuristic.
3. **Picker** *(ZIP only)* — search by title or content, sorted newest first.
4. **Preview** — full transcript, markdown rendered, internal messages hidden by default. Side panel toggles export options + redaction in real time.
5. **Download** — Markdown, JSON, or Save as PDF (browser print).

## Development

```bash
npm run dev          # Vite dev server on :5173
npm run build        # tsc -b + vite build
npm test             # vitest run (270+ unit tests)
npm run test:watch   # vitest in watch mode
npm run lint         # eslint
```

## Tech stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** + `@tailwindcss/typography`
- **JSZip** for in-browser ZIP extraction
- **react-markdown** + **remark-gfm** for transcript rendering
- **Vitest** + **jsdom** for unit tests

No backend, no database. All compute boundaries are inside the browser.

## Project structure

```
src/
  App.tsx                        top-level stage router
  components/
    Landing.tsx                  input choice cards
    UploadZip.tsx                drag-and-drop, huge-file warning
    ConversationPicker.tsx       searchable, sorted-newest-first list
    ConversationPreview.tsx      two-column view + side panel
    ExportOptionsPanel.tsx       view + export + redaction options
    ManualPasteInput.tsx         textarea + live role-count preview
    PrintView.tsx                print-only layout for PDF export
  lib/
    zip/                         readZip, findConversationFile
    parsers/                     parseChatGptExport, parseManualPaste, normalizeConversation
    exporters/                   exportMarkdown, exportJson, printPdf
    redaction/                   redactText, redactConversation
    utils/                       date, downloadFile, safeStringify, conversationSummary
  types/
    conversation.ts              NormalizedConversation, NormalizedMessage, ExportOptions
```

## License

MIT
