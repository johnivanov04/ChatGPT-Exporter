// Content script for chatgpt.com / chat.openai.com. Listens for an "extract"
// message from the service worker, scrapes the open conversation's DOM, and
// returns a NormalizedConversation that matches ChatVault's schema.
//
// DOM-scraping is fragile by nature — ChatGPT can change its markup and break
// this anytime. We rely on `data-message-author-role` and `data-message-id`
// attributes that have been stable for a long while, with sensible fallbacks.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.kind !== "extract") return false;
  try {
    sendResponse({ conversation: extractConversation() });
  } catch (err) {
    sendResponse({ error: err?.message ?? String(err) });
  }
  return false;
});

function extractConversation() {
  const nodes = document.querySelectorAll("[data-message-author-role]");
  if (nodes.length === 0) {
    throw new Error(
      "No messages found on this page. Open a conversation thread first.",
    );
  }
  const messages = [];
  nodes.forEach((node, i) => {
    const role = normalizeRole(node.getAttribute("data-message-author-role"));
    const content = extractMessageContent(node);
    if (!content.trim()) return;
    messages.push({
      id: node.getAttribute("data-message-id") || `msg-${i}`,
      role,
      content,
      messageIndex: messages.length,
      metadata: { contentType: "text" },
    });
  });

  return {
    id: `chatgpt-ext-${Date.now()}`,
    title: pageTitle(),
    source: "browser_extension",
    createdAt: new Date().toISOString(),
    messages,
    metadata: { provider: "chatgpt", extractedFrom: location.href },
  };
}

function pageTitle() {
  const raw = document.title.replace(/\s*[—|·-]?\s*ChatGPT\s*$/i, "").trim();
  return raw || "Untitled conversation";
}

function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "user" || r === "assistant" || r === "system" || r === "tool")
    return r;
  return "unknown";
}

function extractMessageContent(node) {
  // Assistant messages keep their rendered markdown inside a .markdown child;
  // user messages don't have it (they're shown as plain text).
  const target = node.querySelector(".markdown") || node;
  return window.__chatvaultHtmlToMarkdown(target);
}
