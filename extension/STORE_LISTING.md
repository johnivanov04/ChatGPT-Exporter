# Chrome Web Store listing — ChatVault

Copy-paste source for the developer dashboard submission at
<https://chrome.google.com/webstore/devconsole/>. Pricing-free, single-user, no
account required.

---

## Item details

**Name**
ChatVault

**Summary** (max 132 characters)
Export your ChatGPT or Claude conversations to PDF, Markdown, or JSON — with attachments. Local-first, no servers, no telemetry.

**Category**
Productivity

**Language**
English (United States)

---

## Detailed description

Export the AI conversation you're looking at into a clean, archive-ready file — in one click.

ChatVault is the local-first companion extension to **chatvault.space**. Open any ChatGPT or Claude chat, click the ChatVault icon, and the conversation opens in the web app pre-loaded for preview and download.

### What you get
• **PDF** — clean print-ready layout with role-distinguished bubbles
• **Markdown** — drop into Obsidian, Notion, or version control
• **JSON** — every message, role, timestamp, and metadata preserved
• **Attached files** — PDFs, images, code files (.mlx, .ipynb, .m, .py, etc.) bundled as a ZIP with an `attachments/` folder

### Privacy
ChatVault has no backend. There is no database, no analytics, no telemetry, no third-party SDKs. The conversation is scraped from the page you're viewing, normalized in your browser, and delivered to chatvault.space (which is also a local-first single-page app — nothing is uploaded). Full source at github.com/johnivanov04/ChatVault.

### How it works
1. Open a ChatGPT (chatgpt.com) or Claude (claude.ai) conversation
2. Click the ChatVault toolbar icon → "Export this conversation"
3. A tab opens at chatvault.space with the conversation pre-loaded
4. Tweak redaction options, choose format, download

### Supported providers
• **ChatGPT** (chatgpt.com, chat.openai.com) — full attachment capture
• **Claude** (claude.ai) — text, images, PDFs, and code-file attachments
• Gemini support coming via the ZIP-import path on chatvault.space

### Privacy policy
<https://chatvault.space/privacy>

### Source code
<https://github.com/johnivanov04/ChatVault>

---

## Single purpose

Capture the current ChatGPT or Claude conversation from the active tab and open it inside chatvault.space for the user to download as PDF, Markdown, or JSON.

---

## Permission justifications

Each permission is needed for one purpose only. None of the data accessed ever leaves the user's browser.

**`activeTab`**
Read the rendered conversation DOM from the tab the user explicitly clicked "Export" on. Without this, the extension cannot see the messages it is being asked to export.

**`tabs`**
Open a new tab at chatvault.space to deliver the captured conversation. The extension does not enumerate, query, or modify other tabs.

**`storage`**
Hand the captured conversation off to chatvault.space via `chrome.storage.local` (the URL fragment is size-limited and unsuitable for multi-MB attachment binaries). The handoff entry is deleted immediately after the web app reads it.

**Host permission: `https://chatgpt.com/*`, `https://chat.openai.com/*`**
Scrape the rendered conversation DOM and intercept the page's own attachment fetches so the user can download attached files alongside the transcript. The extension is dormant until the user clicks the toolbar button.

**Host permission: `https://claude.ai/*`**
Same as above for claude.ai. Also fetches the conversation API response to retrieve file UUIDs and inlined extracted text for code-file attachments.

**Host permission: `https://chatvault.space/*`**
Read the captured conversation back out of `chrome.storage.local` on the chatvault.space tab and `postMessage` it to the web app's React shell.

---

## Single-purpose remote-code disclosure

The extension does **not** execute remote code. All scripts are bundled in the uploaded ZIP. There are no `eval`-style execution paths, no remotely-loaded modules, no CDN script tags. The only network traffic the extension itself originates is:
1. Fetches to the AI provider's own file/conversation API (with the user's existing session cookies) to retrieve attachment binaries — same origin as the page the user is viewing.
2. Opening a new tab at chatvault.space when the user clicks "Export".

---

## Data-handling disclosures

**Do you collect any user data?**
No.

If the form forces selection of categories:
- Personally identifiable information → No
- Health information → No
- Financial and payment information → No
- Authentication information → No (the extension reuses the user's existing session cookies in their browser; it does not read, copy, or transmit them)
- Personal communications → The conversation text itself is "personal communication." It is read into browser memory, delivered to chatvault.space (also runs in the same browser, no server), and released when the tab closes. It is never sent to ChatVault or any third party.
- Location, web history, user activity, website content → No

**Are you using or transferring user data for purposes unrelated to the item's single purpose?** No.
**Are you using or transferring user data to determine creditworthiness or for lending?** No.

---

## Privacy policy URL

<https://chatvault.space/privacy>

---

## Required assets (you provide)

The dashboard requires these images. Generate locally; do not upload anything containing real user data.

| Asset | Size | Required | Notes |
|---|---|---|---|
| Store icon | 128×128 PNG | ✓ | Use `extension/icons/icon-128.png` |
| Screenshot 1 | 1280×800 or 640×400 PNG/JPG | ✓ at least 1 | Suggested: ChatVault popup open over a ChatGPT chat |
| Screenshot 2 | same | optional | The chatvault.space preview screen after export |
| Screenshot 3 | same | optional | A downloaded PDF preview |
| Small promo tile | 440×280 PNG/JPG | recommended | Brass vault + "ChatVault" wordmark on slate bg |
| Marquee promo tile | 1400×560 PNG/JPG | optional | For "Featured" placement |

**Screenshot capture tip:** open the extension popup over a real ChatGPT conversation, full-screen the browser at exactly 1280×800, screenshot with `Cmd-Shift-4` then `Space` over the window. Crop if needed.

---

## Submission checklist

1. ☐ Pay one-time $5 Chrome Web Store developer registration fee
2. ☐ Run `bash extension/scripts/build-zip.sh` → produces `dist/chatvault-extension-v0.6.0.zip`
3. ☐ Verify the ZIP unpacks and loads via `chrome://extensions/` → "Load unpacked"
4. ☐ Capture 1–3 screenshots at 1280×800
5. ☐ Confirm <https://chatvault.space/privacy> is deployed and reachable
6. ☐ Create new item in the dashboard, upload the ZIP
7. ☐ Paste the copy from this file into the corresponding fields
8. ☐ Upload screenshots + 128×128 icon
9. ☐ Fill out the data-handling questionnaire (everything "No" except "Personal communications" — explain in the dialog as above)
10. ☐ Submit for review — typical wait 1–3 business days
