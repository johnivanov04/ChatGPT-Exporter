# Submitting ChatVault to the Chrome Web Store

Step-by-step from "I have a developer account" to "approved and live." Plan ~45 minutes for the submission itself, then 1–3 business days for review.

The copy you'll paste into each field lives in [`STORE_LISTING.md`](./STORE_LISTING.md). Keep that file open in a second window while you work through this one.

---

## 0. Pre-flight (5 min)

Do these in order. Each one prevents a common reject reason.

### 0.1  Rebuild the upload ZIP from current state

```bash
bash extension/scripts/build-zip.sh
```

Expected output:
```
wrote /Users/johnivanov/ChatVault/dist/chatvault-extension-v0.6.0.zip (36K)
```

If the version number doesn't match what's in `extension/manifest.json`, the script took the wrong file. Don't proceed — investigate.

### 0.2  Load the ZIP as an unpacked extension and use it

This is the single most useful pre-flight. Half of all rejections are because the bundled ZIP differs from what the developer tested.

1. Unzip `dist/chatvault-extension-v0.6.0.zip` into a fresh folder (e.g. `/tmp/chatvault-extension/`)
2. `chrome://extensions/` → toggle Developer mode on → **Load unpacked** → pick that folder
3. Open ChatGPT, click the ChatVault icon, run an export — verify the conversation lands at chatvault.space and downloads correctly
4. Repeat on a Claude conversation
5. Open the popup once more and verify no console errors in the popup devtools (right-click popup → Inspect)

If any of those fail, fix the underlying code, re-run `build-zip.sh`, re-test. Do **not** submit a broken ZIP — rejection wastes ~2 days.

### 0.3  Verify the privacy URL is live

In any browser, open:
- `https://chatvault.space/privacy` — should render the policy
- `https://chatvault.space/privacy.html` — should also render (fallback)

If `/privacy` 404s but `/privacy.html` works, Vercel hasn't picked up `vercel.json` yet — wait 30s or trigger a redeploy.

### 0.4  Confirm icons

The store listing pulls the 128×128 icon from inside the ZIP. Open `extension/icons/icon-128.png` in Preview — it should be a slate-700 rounded square, ~928 bytes. If it's still violet, run `node extension/scripts/generate-icons.mjs` and re-run `build-zip.sh`.

---

## 1. Capture screenshots (10 min)

Dashboard requires **at least one** 1280×800 PNG/JPG. Up to 5 are allowed. Strong listings have 3.

### 1.1  Set Chrome to exactly 1280×800

Open DevTools (Cmd-Opt-I), toggle device mode (Cmd-Shift-M), choose "Responsive" in the device dropdown, set the dimensions to **1280 × 800**. Close DevTools after — you want the page itself to be exactly that size, not the viewport-minus-devtools.

Alternatively: use Chrome's window-resize behavior with the macOS "Sizzy" or "Rectangle" app to snap to 1280×800.

### 1.2  Suggested shots (capture all three)

| # | Scene | How |
|---|---|---|
| 1 | The popup open over a real ChatGPT conversation showing the "Export this conversation" button | Open a long ChatGPT chat → click the ChatVault toolbar icon → `Cmd-Shift-4` then **Space** then click the browser window → save as PNG |
| 2 | The chatvault.space preview screen immediately after an export, with the message list and side panel visible | Right after step 1 produces a new tab → `Cmd-Shift-4` then **Space** then click the browser window |
| 3 | A real PDF preview generated from a chat (browser's print dialog with the rendered transcript visible) | From the preview screen → "Save as PDF" → screenshot the system print dialog with the document preview pane visible |

### 1.3  Privacy hygiene

Use a throwaway ChatGPT conversation that contains no personal data, no API keys, no internal company information. The store team and any future viewer will see these forever.

Quick prompt to seed a clean demo chat:
> "Write me a haiku about local-first software, then explain what 'local-first' means in three short bullets."

### 1.4  Cropping

If your screenshot came out at 2560×1600 (Retina), downscale to 1280×800 in Preview → Tools → Adjust Size. Submit only the 1280×800 versions.

Save the final files as `screenshot-1.png`, `screenshot-2.png`, `screenshot-3.png`. Don't worry about where — you'll just upload them.

---

## 2. Open the Developer Dashboard

<https://chrome.google.com/webstore/devconsole/>

You'll land on a list of your existing items. Click **Add new item** (top right).

### 2.1  Upload the ZIP

Drop or browse to `dist/chatvault-extension-v0.6.0.zip`. The console validates the manifest and lands you on the **Store listing** tab.

If you see a manifest error here, do **not** patch it in the console — fix it in `extension/manifest.json`, re-run `build-zip.sh`, and re-upload.

---

## 3. Fill out the Store Listing tab

Keep `extension/STORE_LISTING.md` open. Fields, in order they appear in the dashboard:

| Field | Source in STORE_LISTING.md |
|---|---|
| **Title** | "ChatVault" (already filled from manifest, leave as-is) |
| **Summary** | The 132-character line under "**Summary**" |
| **Description** | Everything under "**Detailed description**" — paste as plain text, the dashboard preserves line breaks |
| **Category** | Productivity |
| **Language** | English (United States) |

### 3.1  Graphic assets

| Slot | What to upload |
|---|---|
| **Store icon** | The dashboard auto-pulls the 128×128 from the manifest — verify the preview matches |
| **Small promotional tile** (440×280) | Optional. Skip for v1, can add later |
| **Marquee promotional tile** (1400×560) | Optional. Skip — only used for featured placements |
| **Screenshots** | Upload `screenshot-1.png` through `screenshot-3.png` |

Save the tab (button at the bottom).

---

## 4. Fill out the Privacy practices tab

This is where most submissions get held up. Take it slowly.

### 4.1  Single purpose

Paste the one-paragraph block from "**Single purpose**" in STORE_LISTING.md verbatim.

### 4.2  Permission justifications

The dashboard lists every permission the manifest declares and asks for a justification per item. Paste from the corresponding sub-sections of "**Permission justifications**" in STORE_LISTING.md. The justifications need to actually map to what the code does, not just hand-wave — yours do.

Don't skip the host permissions. Each one needs its own justification.

### 4.3  Remote-code disclosure

There's a "Are you using remote code?" question. Answer **No** and paste the paragraph under "**Single-purpose remote-code disclosure**" if there's an explanation field.

### 4.4  Data-handling questionnaire

The big one. Answer truthfully — your code backs this up.

- "Do you collect any user data?" → **No**

If the dashboard insists on category checkboxes:
- Personally identifiable info → No
- Health → No
- Financial → No
- Authentication → No
- **Personal communications** → Yes is technically correct (the chat text IS personal communication). When you check this, the dashboard will ask "How is this data used?" — answer: *"Read into the user's own browser to render an export they explicitly requested. Never transmitted to any server."*
- Location → No
- Web history → No
- User activity → No
- Website content → No (the only website content read is the conversation page the user has explicitly told the extension to export; this is covered under Personal communications above)

Sub-questions:
- "Is the data used for anything besides the single purpose?" → No
- "Is the data sold to third parties?" → No
- "Is the data used for creditworthiness?" → No

Privacy policy URL: `https://chatvault.space/privacy`

Save the tab.

---

## 5. Fill out the Distribution tab

| Field | Value |
|---|---|
| **Visibility** | Public |
| **Regions** | All regions (default) |
| **Pricing** | Free |
| **Audience** | "This item is not directed at children" (or whatever applies — it's not a kids' app) |

Save.

---

## 6. Submit for review

Top right: **Submit for review**. The dashboard will block this if any required field is missing — it'll list them at the top of the tab they belong to.

Confirm in the modal. You're done.

Expect:
- **Within minutes** — automated checks run; if your manifest or ZIP has a structural issue you'll get rejected immediately with a clear reason
- **1–3 business days** — human review for policy and permission justifications
- **Email when decided** — either approved (extension goes live within an hour) or rejected with specific reason(s)

---

## 7. Common rejection reasons + how to avoid

| Reason | Fix |
|---|---|
| "Insufficient permission justification" | Each host permission and each API permission needs a sentence saying *which user-facing feature* requires it. Yours do — but if the reviewer flags one, re-read STORE_LISTING.md, expand the relevant line, edit your draft, re-submit. |
| "Privacy policy not specific" | Add a sentence saying explicitly that *this extension* does not collect data, not just that "we" don't. Yours does. |
| "Single purpose unclear" | Don't claim multiple purposes. One sentence: "Export the current chat to PDF/Markdown/JSON." |
| "Functionality doesn't match description" | Make sure your screenshots actually show the export flow. If you only show the popup, reviewers can't tell what the extension does. |
| "Unable to load extension" | The ZIP was packed with macOS `__MACOSX/` metadata or `.DS_Store` files. `build-zip.sh` excludes those — don't re-zip manually. |

If rejected: read the email carefully, fix the **specific** thing they cited (don't proactively change other things — that's another review surface area), bump the manifest patch version (`0.6.0` → `0.6.1`), re-run `build-zip.sh`, upload the new ZIP, re-submit. Don't argue with the reviewer.

---

## 8. After approval

### 8.1  The listing URL

After approval, your item URL looks like:
```
https://chromewebstore.google.com/detail/chatvault/{your-extension-id}
```

The extension ID is assigned at first upload and never changes. Add this URL to:
- The root `README.md` (replace "Install (developer mode)" section with "Install from Chrome Web Store: <link>")
- The `extension/README.md`
- The chatvault.space landing page's "Use the browser extension" card

### 8.2  Updating

For any future change:
1. Edit code
2. Bump `version` in `extension/manifest.json` (e.g. `0.6.0` → `0.6.1` for fixes, `0.7.0` for features)
3. `bash extension/scripts/build-zip.sh`
4. Dashboard → your item → **Package** → upload new ZIP → **Submit for review**

Updates usually go through faster than first submissions (often <24h) because the reviewer is diffing against a known-good baseline.

### 8.3  Monitoring

The dashboard has a per-item stats page showing installs, weekly active users, and any reviewer feedback. Check it once a week for the first month. After that, only when you push an update.

---

## 9. If something goes wrong mid-submission

- **Forgot to bump the version** → re-edit `manifest.json`, re-zip, re-upload. The dashboard rejects a re-upload of the same version number.
- **Dashboard times out during ZIP upload** → wait 60s, refresh, try again. ChatVault is 36 KB, this should never happen, but just in case.
- **Closed the tab mid-form** → drafts auto-save. Reopen the item from the dashboard list, you'll be where you left off.
- **Wrong file in the ZIP** → `unzip -l dist/chatvault-extension-v0.6.0.zip` to inspect contents. Should be: manifest, background, content-*.js, lib/, icons/, popup.{html,js,css}. Nothing else.

---

That's the whole flow. The riskiest part is the data-handling questionnaire — go slow there. Everything else is paperwork.
