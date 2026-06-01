# ChatVault

A local-first web app that converts AI chat conversations into clean **PDF**, **Markdown**, and **JSON** files. Drop in your **ChatGPT**, **Claude**, or **Gemini** export, pick a chat, preview it, and download. Everything happens in your browser — no backend, no accounts, no uploads.

## Features

- **Multi-provider** — auto-detects ChatGPT (`conversations.json`), Claude (`chat_messages`), and Gemini (Google Takeout `My Activity/Gemini Apps/MyActivity.json`). Each provider has a dedicated parser tuned to its real content shape.
- **ChatGPT** — handles every content type seen in real exports (text, multimodal with images, code, execution output, thoughts, reasoning recaps, browsing). Walks the `current_node` parent chain to follow the displayed thread.
- **Claude** — content blocks (`text`, `image`, `tool_use`, `tool_result`) flattened into clean text. `human` → `user`. Attachments and files surfaced as `[attached: name]`.
- **Gemini** — Takeout activity log grouped into sessions by time gap. Best-effort classification by title prefix (`Asked:`/`Gemini said:`).
- **Manual paste fallback** — recognizes classic `User:` / `[User]` / `Assistant:` markers, modern `You said:` / `ChatGPT said:` labels, plus a heuristic strategy for plain page-copies (uses attachment filenames and `Thought for X` markers as structural anchors).
- **Searchable picker** — sort newest first, AND-of-terms search across title and message content.
- **Transcript preview** — role-distinguished messages with avatar icons, markdown rendered (paragraphs, lists, code fences, GFM tables), toggleable "internal" filter that hides system/tool/reasoning noise by default.
- **Three exporters** — driven by the same option toggles (front-page metadata, timestamps, message numbers, source metadata, redaction). What you see is what you download.
- **Best-effort redaction** — emails, phone numbers (multiple formats with date/IP/version-string guards), and provider-specific API keys (OpenAI, Anthropic, AWS, Stripe, GitHub PATs, Google, Slack). WYSIWYG: the preview shows redactions live.
- **PDF via browser print** — clean cover page + serif transcript body, page-break-friendly, code blocks legible on paper.
- **In-app export guides** — step-by-step instructions for getting your ZIP from each provider, with the actual URLs.
- **Browser back/forward** integrated with the stage flow.

## Privacy

- No backend, no database, no accounts.
- Files are read with JSZip in memory and discarded when the tab closes.
- Nothing is persisted to `localStorage` by default.
- Redaction is best-effort; the app warns you to review exports before sharing.

## Quick start

```bash
git clone https://github.com/johnivanov04/ChatVault.git
cd ChatVault
npm install
npm run dev
```

Open <http://localhost:5173/> and either drop your export ZIP onto the page or click "Paste Chat Manually". If you need to get an export ZIP, expand "How do I get my export?" on the upload screen — there are walkthroughs for all three providers.

## Usage flow

1. **Landing** — pick ZIP or paste.
2. **Upload / paste** — the ZIP parser locates and identifies the provider's conversation file; the paste parser splits by marker or by heuristic.
3. **Picker** *(ZIP only)* — search by title or content, sorted newest first.
4. **Preview** — full transcript, markdown rendered, internal messages hidden by default. Side panel toggles export options + redaction in real time.
5. **Download** — Markdown, JSON, or Save as PDF (browser print).

## Development

```bash
npm run dev          # Vite dev server on :5173
npm run build        # tsc -b + vite build
npm test             # vitest run (314+ unit tests)
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

No backend, no database. All compute boundaries are inside the browser.

## Project structure

```
src/
  App.tsx                        top-level stage router (history-integrated)
  components/
    Landing.tsx                  input choice cards + hero
    UploadZip.tsx                drag-and-drop, huge-file warning, provider auto-detect
    ConversationPicker.tsx       searchable, sorted-newest-first list
    ConversationPreview.tsx      two-column view + side panel
    ExportOptionsPanel.tsx       view + export + redaction options
    ManualPasteInput.tsx         textarea + live role-count preview
    PrintView.tsx                print-only layout for PDF export
    HowToExport.tsx              per-provider export instructions
  lib/
    zip/                         readZip, multi-provider findConversationFile
    parsers/                     parseChatGptExport, parseClaudeExport,
                                 parseGeminiExport, parseManualPaste,
                                 normalizeConversation
    exporters/                   exportMarkdown, exportJson, printPdf
    redaction/                   redactText, redactConversation
    utils/                       date, downloadFile, safeStringify,
                                 conversationSummary
  types/
    conversation.ts              NormalizedConversation, NormalizedMessage,
                                 ExportOptions, Provider, ConversationSource
```

## License

MIT
