// Content script for claude.ai. Same protocol as the ChatGPT script.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.kind !== "extract") return false;
  extractConversation()
    .then((conversation) => sendResponse({ conversation }))
    .catch((err) => sendResponse({ error: err?.message ?? String(err) }));
  return true;
});

const USER_SELECTORS = [
  '[data-testid="user-message"]',
  ".font-user-message",
  '[data-message-author-role="user"]',
  ".user-message",
];

const ASSISTANT_SELECTORS = [
  '[data-testid="assistant-message"]',
  '[data-testid="claude-message"]',
  ".font-claude-message",
  ".font-claude-response",
  ".claude-message",
  '[data-message-author-role="assistant"]',
  "[data-is-streaming]",
  ".standard-markdown",
  ".prose",
];

const CDN_HOST_RE = new RegExp(
  [
    "files\\.anthropic\\.com",
    "claude\\.ai\\/api\\/",
    "cdn\\.anthropic\\.com",
    "a-cdn\\.anthropic\\.com",
    "a-api\\.anthropic\\.com\\/v1",
    // Relative path that Claude uses for inline previews + downloads:
    //   /api/{org_uuid}/files/{file_uuid}/[preview|content|download]
    "^\\/api\\/[a-f0-9-]{8,}\\/files\\/[a-f0-9-]{8,}",
  ].join("|"),
  "i",
);

function isAttachmentUrl(url) {
  if (!url) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  return CDN_HOST_RE.test(url);
}

let claudeFileIndex = null;

async function extractConversation() {
  try {
    console.log(
      "[ChatVault cs] starting extract; cache summary:",
      window.__chatvaultCacheSummary?.() ?? "(no summary fn)",
    );
  } catch {
    /* ignore */
  }
  const entries = findMessageEntries();
  if (entries.length === 0) {
    throw new Error(
      "No messages found on this page. Open a conversation thread first.",
    );
  }

  // Pull file UUIDs straight from Claude's conversation API. For non-image
  // documents (.mlx, .mat, .ipynb, etc.), Claude doesn't fetch a preview
  // when you click the card, so auto-click times out. The conv API gives
  // us the file_uuid → we can hit the file endpoint directly.
  claudeFileIndex = await harvestClaudeFileIndex();

  // Claude renders attachment thumbnails/cards OUTSIDE the message text
  // bubble (in a sibling subtree of the same "turn container"). For each
  // user entry, expand to the largest ancestor that doesn't include any
  // other message; run attachment detection on THAT scope. This catches
  // both inline preview <img> tags AND filename cards for documents
  // (.mlx, .mat, .ipynb, etc.) that Claude renders without a preview img.
  const detectionScope = new Map();
  for (const entry of entries) {
    detectionScope.set(
      entry,
      entry.role === "user" ? expandToTurnContainer(entry, entries) : entry.node,
    );
  }

  // Global img safety net: if expansion missed a thumbnail subtree (the
  // turn container can be hard to pin down on Claude), route it by
  // nearest user message.
  const globalImgAttachments = mapGlobalImgsToEntries(entries);

  // For any detected attachments not yet in cache, drive the page's own
  // click handler to make it fetch them (works for documents the page
  // doesn't auto-fetch).
  if (window.__chatvaultAutoClickUncached) {
    await window.__chatvaultAutoClickUncached(
      entries.map((e) => detectionScope.get(e)),
      (n) => window.__chatvaultDetectAttachments(n, isAttachmentUrl),
    );
  }

  const messages = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const detected = window.__chatvaultDetectAttachments(
      detectionScope.get(entry),
      isAttachmentUrl,
    );
    // Merge in global-img attachments routed to this entry.
    const extras = globalImgAttachments.get(entry) || [];
    for (const extra of extras) {
      if (
        !detected.some(
          (d) => d.filename === extra.filename || d.url === extra.url,
        )
      ) {
        detected.push(extra);
      }
    }
    const attachments = await materializeAll(detected);
    const filenames = detected.map((d) => d.filename);
    const raw = window.__chatvaultHtmlToMarkdown(entry.node);
    const content = window.__chatvaultStripAttachmentText(raw, filenames);
    if (!content.trim() && attachments.length === 0) continue;
    messages.push({
      id: `msg-${i}`,
      role: entry.role,
      content,
      messageIndex: messages.length,
      metadata: { contentType: "text" },
      ...(attachments.length > 0 ? { attachments } : {}),
    });
  }

  return {
    id: `claude-ext-${Date.now()}`,
    title: pageTitle(),
    source: "browser_extension",
    createdAt: new Date().toISOString(),
    messages,
    metadata: { provider: "claude", extractedFrom: location.href },
  };
}

async function probeClaudeFileEndpoints(orgId, fileId, filename) {
  const base = `/api/organizations/${orgId}/files/${fileId}`;
  const candidates = [
    base,
    `${base}/content`,
    `${base}/download`,
    `${base}/preview`,
    `${base}/raw`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { credentials: "include" });
      const ct = res.headers.get("content-type") || "";
      const cd = res.headers.get("content-disposition") || "";
      console.log(
        `[ChatVault cs] probe ${filename}: ${url} → ${res.status} ${ct} ${cd.slice(0, 80)}`,
      );
      if (!res.ok) continue;

      // If JSON, inspect for download_url / extracted_content / similar.
      if (ct.includes("application/json")) {
        const json = await res.clone().json().catch(() => null);
        if (json && typeof json === "object") {
          console.log(
            `  ↳ json keys: ${Object.keys(json).slice(0, 12).join(", ")}`,
          );
          const followUrl =
            json.download_url ||
            json.preview_url ||
            json.url ||
            json.signed_url;
          if (typeof followUrl === "string") {
            console.log(`  ↳ following ${followUrl.slice(0, 80)}`);
            const dres = await fetch(followUrl, { credentials: "include" });
            console.log(
              `  ↳ ${dres.status} ${dres.headers.get("content-type") || ""}`,
            );
            if (dres.ok) {
              return await responseToB64(dres);
            }
          }
          // Some Claude responses inline the file's text content directly.
          if (typeof json.extracted_content === "string") {
            const text = json.extracted_content;
            return {
              dataBase64: textToB64(text),
              mimeType: "text/plain; charset=utf-8",
              size: text.length,
            };
          }
        }
        continue;
      }

      // Otherwise treat as binary.
      return await responseToB64(res);
    } catch (err) {
      console.log(`[ChatVault cs] probe ${filename}: ${url} → ERROR ${err.message}`);
    }
  }
  console.log(`[ChatVault cs] all endpoints failed for ${filename}`);
  return null;
}

async function responseToB64(res) {
  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return {
    dataBase64: btoa(bin),
    mimeType:
      res.headers.get("content-type") || "application/octet-stream",
    size: bytes.length,
  };
}

function textToB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function harvestClaudeFileIndex() {
  try {
    const convId = location.pathname.match(/\/chat\/([a-f0-9-]+)/i)?.[1];
    if (!convId) {
      console.log("[ChatVault cs] harvest: no conv id in url");
      return null;
    }
    const orgId = await findClaudeOrgId();
    if (!orgId) {
      console.log("[ChatVault cs] harvest: no org id found");
      return null;
    }
    console.log("[ChatVault cs] harvest: using org", orgId.slice(0, 8));
    const url = `/api/organizations/${orgId}/chat_conversations/${convId}?tree=True&rendering_mode=messages&render_all_tools=true`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      console.log("[ChatVault cs] harvest: conv fetch failed", res.status);
      return null;
    }
    const json = await res.json();
    const byFilename = new Map();
    const collectFiles = (obj) => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        for (const item of obj) collectFiles(item);
        return;
      }
      const name = obj.file_name || obj.filename || obj.name;
      const id = obj.file_uuid || obj.uuid || obj.id;
      if (
        typeof name === "string" &&
        typeof id === "string" &&
        /\.[a-zA-Z0-9]{1,10}$/.test(name) &&
        /^[a-f0-9-]{8,}$/i.test(id)
      ) {
        byFilename.set(name, id);
      }
      for (const v of Object.values(obj)) collectFiles(v);
    };
    collectFiles(json);
    console.log(
      "[ChatVault cs] harvest found",
      byFilename.size,
      "file(s) in conv api for org",
      orgId.slice(0, 8),
    );
    return { orgId, byFilename };
  } catch (err) {
    console.log("[ChatVault cs] harvest error", err);
    return null;
  }
}

async function findClaudeOrgId() {
  const re = /\/organizations\/([a-f0-9-]{8,})/i;
  // DOM first (fast, no extra request).
  for (const el of document.querySelectorAll("[href],[src]")) {
    const v = el.getAttribute("href") || el.getAttribute("src") || "";
    const m = re.exec(v);
    if (m) return m[1];
  }
  // /api/organizations — the API itself tells us.
  try {
    const res = await fetch("/api/organizations", { credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const active = json.find((o) => o.is_default) || json[0];
        if (active?.uuid) return active.uuid;
      }
    }
  } catch {
    /* ignore */
  }
  // Last resort: outerHTML scrape (the org id is sometimes baked into
  // inline scripts as a string literal).
  const m = re.exec(document.documentElement.outerHTML);
  return m?.[1] || null;
}

function expandToTurnContainer(entry, allEntries) {
  // Walk up until including the next ancestor would also include another
  // message entry. The result is the "turn container" — the user's
  // message text + any attachment thumbnails/cards rendered alongside.
  let candidate = entry.node;
  let parent = entry.node.parentElement;
  while (parent) {
    const containsOther = allEntries.some(
      (e) => e !== entry && parent.contains(e.node),
    );
    if (containsOther) break;
    candidate = parent;
    parent = parent.parentElement;
  }
  return candidate;
}

function mapGlobalImgsToEntries(entries) {
  // For each attachment-shaped <img> in the document, walk up its parent
  // chain. The first ancestor that contains exactly ONE user entry is the
  // "turn container" — assign the img to that user message. Stops when an
  // ancestor contains more than one user entry (too broad).
  const result = new Map();
  const allImgs = Array.from(document.querySelectorAll("img[src]"));
  let count = 0;
  for (const img of allImgs) {
    const src = img.getAttribute("src") || "";
    if (!src || !isAttachmentUrl(src)) continue;
    const filename =
      img.getAttribute("alt") || filenameFromUrlForLog(src) || "attachment";
    let parent = img.parentElement;
    let owner = null;
    while (parent) {
      const matching = entries.filter(
        (e) => e.role === "user" && parent.contains(e.node),
      );
      if (matching.length === 1) {
        owner = matching[0];
        break;
      }
      if (matching.length > 1) break;
      parent = parent.parentElement;
    }
    if (!owner) continue;
    const list = result.get(owner) || [];
    if (!list.some((x) => x.url === src || x.filename === filename)) {
      list.push({ filename, url: src });
      count++;
    }
    result.set(owner, list);
  }
  console.log(
    "[ChatVault cs] mapped",
    count,
    "global img attachments to",
    result.size,
    "user message(s)",
  );
  return result;
}

function filenameFromUrlForLog(url) {
  try {
    const u = new URL(url, location.href);
    return decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    return "";
  }
}

function diagnoseGlobalAttachments(entries) {
  try {
    const allImgs = Array.from(document.querySelectorAll("img[src]"));
    const matching = allImgs.filter((img) =>
      isAttachmentUrl(img.getAttribute("src") || ""),
    );
    console.log(
      "[ChatVault cs] global img scan:",
      allImgs.length,
      "imgs total,",
      matching.length,
      "match attachment URL pattern",
    );
    if (matching.length === 0) {
      // Also try with a broader pattern, in case my isAttachmentUrl is wrong.
      const broader = allImgs.filter((img) => {
        const src = img.getAttribute("src") || "";
        return /\/files\/|\/preview|anthropic\.com/i.test(src);
      });
      console.log(
        "[ChatVault cs] broader scan (any /files/ or anthropic.com):",
        broader.length,
        "imgs",
      );
      broader.slice(0, 3).forEach((img, i) => {
        console.log(
          `  [${i}] alt="${img.getAttribute("alt") || ""}" src="${img.getAttribute("src") || ""}"`,
        );
      });
      return;
    }
    matching.slice(0, 3).forEach((img, i) => {
      const alt = img.getAttribute("alt") || "";
      const src = img.getAttribute("src") || "";
      // Find which (if any) message entry contains this img.
      const containingEntry = entries.find((e) => e.node.contains(img));
      // Walk up parent chain to find closest ancestor that contains an entry.
      let parent = img.parentElement;
      let ancestorContainsMsg = null;
      while (parent) {
        for (const e of entries) {
          if (parent.contains(e.node)) {
            ancestorContainsMsg = parent.tagName + (parent.className ? "." + parent.className.split(" ").slice(0, 2).join(".") : "");
            break;
          }
        }
        if (ancestorContainsMsg) break;
        parent = parent.parentElement;
      }
      console.log(
        `[ChatVault cs] matching img [${i}]: alt="${alt}" src="${src.slice(0, 80)}"`,
        "containing entry?",
        !!containingEntry,
        "| closest msg-containing ancestor:",
        ancestorContainsMsg,
      );
    });
  } catch (err) {
    console.log("[ChatVault cs] diagnose error", err);
  }
}

async function materializeAll(detected) {
  const out = [];
  for (const d of detected) {
    // 1) Cache: captured by the MAIN-world bridge when the page itself
    //    fetched the file (image previews, opened PDFs, etc.).
    const cachedByName = window.__chatvaultCapturedAttachment(d.filename);
    if (cachedByName) {
      out.push({
        filename: cachedByName.filename || d.filename,
        dataBase64: cachedByName.dataBase64,
        mimeType: cachedByName.mimeType,
        size: cachedByName.size,
      });
      continue;
    }
    if (d.url) {
      const cachedByUrl = window.__chatvaultCapturedAttachmentByUrl(d.url);
      if (cachedByUrl) {
        out.push({
          filename: cachedByUrl.filename || d.filename,
          dataBase64: cachedByUrl.dataBase64,
          mimeType: cachedByUrl.mimeType,
          size: cachedByUrl.size,
        });
        continue;
      }
    }

    // 2) Direct content-script fetch if we have a URL.
    if (d.url) {
      const fetched = await window.__chatvaultFetchAttachment(d.url);
      if (fetched && !fetched.fetchError && fetched.dataBase64) {
        out.push({ filename: d.filename, ...fetched });
        continue;
      }
    }

    // 2.5) Claude file-index lookup: try the file endpoint(s) directly using
    //      the file_uuid we harvested from the conversation API. Logs the
    //      response shape of each so we can adapt to whatever Claude returns.
    if (claudeFileIndex) {
      const fileId = claudeFileIndex.byFilename.get(d.filename);
      if (fileId) {
        const success = await probeClaudeFileEndpoints(
          claudeFileIndex.orgId,
          fileId,
          d.filename,
        );
        if (success) {
          out.push({ filename: d.filename, ...success });
          continue;
        }
      }
    }

    // 3) Nothing worked — ask the user to open the file once.
    out.push({
      filename: d.filename,
      fetchError:
        "Open the file in the chat (click it) so the page fetches it, then click Export again.",
    });
  }
  return out;
}

/* -------------------- selector strategies (in order) -------------------- */

function findMessageEntries() {
  const all = [];
  for (const sel of USER_SELECTORS) {
    for (const node of safeSelectAll(sel)) {
      all.push({ node, role: "user" });
    }
  }
  for (const sel of ASSISTANT_SELECTORS) {
    for (const node of safeSelectAll(sel)) {
      all.push({ node, role: "assistant" });
    }
  }

  const byNode = new Map();
  for (const e of all) {
    const prev = byNode.get(e.node);
    if (!prev || (prev.role === "assistant" && e.role === "user")) {
      byNode.set(e.node, e);
    }
  }

  let entries = Array.from(byNode.values());
  entries = entries.filter(
    (e) =>
      !entries.some((other) => other !== e && other.node.contains(e.node)),
  );
  entries = collectByDomOrder(entries);

  const counts = entries.reduce(
    (acc, e) => ((acc[e.role] = (acc[e.role] ?? 0) + 1), acc),
    {},
  );
  if (entries.length > 0 && !counts.assistant) {
    debugDumpForMissingAssistant();
  }

  return entries;
}

function safeSelectAll(selector) {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function collectByDomOrder(items) {
  return items.sort((a, b) => {
    if (a.node === b.node) return 0;
    const pos = a.node.compareDocumentPosition(b.node);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

function pageTitle() {
  const raw = document.title.replace(/\s*[—–-]?\s*Claude\s*$/i, "").trim();
  if (raw) return raw;
  const heading = document.querySelector("main h1, header h1");
  return (heading?.textContent || "Untitled conversation").trim();
}

function debugDumpForMissingAssistant() {
  console.warn(
    "[ChatVault] No assistant messages matched any known selector on claude.ai.",
  );
  console.warn(
    "[ChatVault] Tried (user):",
    USER_SELECTORS.map(
      (s) => `${s} → ${document.querySelectorAll(s).length}`,
    ),
  );
  console.warn(
    "[ChatVault] Tried (assistant):",
    ASSISTANT_SELECTORS.map(
      (s) => `${s} → ${document.querySelectorAll(s).length}`,
    ),
  );
}
