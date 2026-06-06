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
  try {
    sendResponse({ conversation: extractConversation() });
  } catch (err) {
    sendResponse({ error: err?.message ?? String(err) });
  }
  return false;
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
  '[data-is-streaming]',
  ".standard-markdown",
  ".prose",
];

function extractConversation() {
  const entries = findMessageEntries();
  if (entries.length === 0) {
    throw new Error(
      "No messages found on this page. Open a conversation thread first.",
    );
  }

  const messages = [];
  entries.forEach((entry, i) => {
    const content = window.__chatvaultHtmlToMarkdown(entry.node);
    if (!content.trim()) return;
    messages.push({
      id: `msg-${i}`,
      role: entry.role,
      content,
      messageIndex: messages.length,
      metadata: { contentType: "text" },
    });
  });

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
  // Pass 1: collect every node matched by any role's selectors.
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

  // Pass 2: dedupe by node identity (a node matched by two selectors of the
  // same role only counts once; if matched by both roles, user wins as a
  // safer default).
  const byNode = new Map();
  for (const e of all) {
    const prev = byNode.get(e.node);
    if (!prev || (prev.role === "assistant" && e.role === "user")) {
      byNode.set(e.node, e);
    }
  }

  // Pass 3: drop nested duplicates. The .prose / .standard-markdown selectors
  // are deliberately greedy and will match content inside a more-specific
  // message container; keep only the outermost match.
  let entries = Array.from(byNode.values());
  entries = entries.filter(
    (e) =>
      !entries.some((other) => other !== e && other.node.contains(e.node)),
  );

  // Pass 4: sort by DOM order so the conversation reads chronologically.
  entries = collectByDomOrder(entries);

  // If we found user messages but no assistant ones, dump diagnostic info to
  // the console — this is exactly the case where Claude's selectors have
  // changed for the assistant role.
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

/* ----------------------- diagnostic dump ------------------------------- */

function debugDumpForMissingAssistant() {
  // Print a small report so the user can paste it back when an update breaks
  // assistant detection.
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
  // Sample any element on the page that looks like it could be an assistant
  // turn — large text blocks under main that aren't user messages.
  const main = document.querySelector("main, [role='main']");
  if (main) {
    main.querySelectorAll("div, article, section").forEach((el) => {
      if (candidates.length >= 5) return;
      if (el.matches(USER_SELECTORS.join(","))) return;
      const text = (el.textContent || "").trim();
      if (text.length < 80) return;
      const looksLikeContainer = el.children.length > 0 && el.children.length < 30;
      if (!looksLikeContainer) return;
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
