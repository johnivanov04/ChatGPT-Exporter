// Content script for chatgpt.com / chat.openai.com. Listens for an "extract"
// message from the service worker, scrapes the open conversation's DOM, and
// returns a NormalizedConversation that matches ChatVault's schema.
//
// Now also detects per-message attachments (PDFs, images, files) and tries
// to fetch their binary content using the page's session cookies. Anything
// we can't fetch comes through as filename-only with `fetchError`.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.kind !== "extract") return false;
  extractConversation()
    .then((conversation) => sendResponse({ conversation }))
    .catch((err) => sendResponse({ error: err?.message ?? String(err) }));
  return true; // async response
});

async function extractConversation() {
  const nodes = document.querySelectorAll("[data-message-author-role]");
  if (nodes.length === 0) {
    throw new Error(
      "No messages found on this page. Open a conversation thread first.",
    );
  }
  const messages = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const role = normalizeRole(node.getAttribute("data-message-author-role"));
    const content = extractMessageContent(node);
    const attachments = await extractAttachments(node);
    if (!content.trim() && attachments.length === 0) continue;
    messages.push({
      id: node.getAttribute("data-message-id") || `msg-${i}`,
      role,
      content,
      messageIndex: messages.length,
      metadata: { contentType: "text" },
      ...(attachments.length > 0 ? { attachments } : {}),
    });
  }

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

/* ---------------------------- attachments ---------------------------- */

const CDN_HOST_RE =
  /^(?:https?:\/\/)?(?:files\.oaiusercontent\.com|cdn\.oaistatic\.com|chat\.openai\.com\/backend-api\/files\/|chatgpt\.com\/backend-api\/files\/)/i;

async function extractAttachments(messageNode) {
  const seen = new Set();
  const out = [];

  // 1. Anchor tags with a CDN href — usually attached files.
  for (const a of messageNode.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (!href || seen.has(href)) continue;
    if (!isAttachmentUrl(href)) continue;
    seen.add(href);
    const filename =
      a.getAttribute("download") || textOf(a) || filenameFromUrl(href);
    out.push(await materialize(filename, href));
  }

  // 2. Image tags with CDN src.
  for (const img of messageNode.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src") || "";
    if (!src || seen.has(src)) continue;
    if (!isAttachmentUrl(src)) continue;
    seen.add(src);
    const filename =
      img.getAttribute("alt") ||
      filenameFromUrl(src) ||
      `image-${out.length + 1}.png`;
    out.push(await materialize(filename, src));
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
