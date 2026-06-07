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

const CDN_HOST_RE =
  /^(?:https?:\/\/)?(?:files\.anthropic\.com|claude\.ai\/api\/|cdn\.anthropic\.com)/i;

function isAttachmentUrl(url) {
  if (!url) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  return CDN_HOST_RE.test(url);
}

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
    const detected = window.__chatvaultDetectAttachments(
      entry.node,
      isAttachmentUrl,
    );
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

async function materializeAll(detected) {
  const out = [];
  for (const d of detected) {
    if (!d.url) {
      out.push({
        filename: d.filename,
        fetchError:
          "Filename detected but no downloadable URL in the page DOM.",
      });
      continue;
    }
    const fetched = await window.__chatvaultFetchAttachment(d.url);
    out.push({ filename: d.filename, ...fetched });
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
