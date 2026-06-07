// Content script for claude.ai. Same protocol as the ChatGPT script: listens
// for an "extract" message from the service worker and returns a
// NormalizedConversation matching ChatVault's schema.
//
// Claude's DOM has moved around over time, and the user/assistant message
// containers often use *different* selectors (e.g. user has a test-id but
// assistant does not). Strategy: try every known selector for each role
// independently, combine matches by DOM position, drop any nested duplicates.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.kind !== "extract") return false;
  extractConversation()
    .then((conversation) => sendResponse({ conversation }))
    .catch((err) => sendResponse({ error: err?.message ?? String(err) }));
  return true; // async response
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

const CDN_HOST_RE =
  /^(?:https?:\/\/)?(?:files\.anthropic\.com|claude\.ai\/api\/|cdn\.anthropic\.com)/i;

async function extractConversation() {
  const entries = findMessageEntries();
  if (entries.length === 0) {
    throw new Error(
      "No messages found on this page. Open a conversation thread first.",
    );
  }

  const messages = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const content = window.__chatvaultHtmlToMarkdown(entry.node);
    const attachments = await extractAttachments(entry.node);
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

/* ----------------------------- attachments ---------------------------- */

async function extractAttachments(messageNode) {
  const seen = new Set();
  const out = [];

  for (const a of messageNode.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (!href || seen.has(href)) continue;
    if (!isAttachmentUrl(href)) continue;
    seen.add(href);
    out.push(
      await materialize(
        a.getAttribute("download") || textOf(a) || filenameFromUrl(href),
        href,
      ),
    );
  }

  for (const img of messageNode.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src") || "";
    if (!src || seen.has(src)) continue;
    if (!isAttachmentUrl(src)) continue;
    seen.add(src);
    out.push(
      await materialize(
        img.getAttribute("alt") ||
          filenameFromUrl(src) ||
          `image-${out.length + 1}.png`,
        src,
      ),
    );
  }

  return out;
}

function isAttachmentUrl(url) {
  if (!url) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  return CDN_HOST_RE.test(url);
}

function textOf(node) {
  return (node.textContent || "").trim();
}

function filenameFromUrl(url) {
  try {
    const u = new URL(url, location.href);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(last || "");
  } catch {
    return "";
  }
}

async function materialize(filename, url) {
  const safe = filename || "attachment";
  const fetched = await window.__chatvaultFetchAttachment(url);
  return { filename: safe, ...fetched };
}

/* ------------------------- diagnostic dump ---------------------------- */

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
  const candidates = [];
  const main = document.querySelector("main, [role='main']");
  if (main) {
    main.querySelectorAll("div, article, section").forEach((el) => {
      if (candidates.length >= 5) return;
      if (el.matches(USER_SELECTORS.join(","))) return;
      const text = (el.textContent || "").trim();
      if (text.length < 80) return;
      if (el.children.length < 1 || el.children.length > 30) return;
      candidates.push({
        tag: el.tagName,
        className: el.className,
        dataset: { ...el.dataset },
        textPreview: text.slice(0, 80),
      });
    });
  }
  if (candidates.length > 0) {
    console.warn(
      "[ChatVault] Candidate assistant containers (paste these to report a fix):",
      candidates,
    );
  }
}
