// Content script for chatgpt.com / chat.openai.com. Listens for an "extract"
// message from the service worker, scrapes the open conversation's DOM, and
// returns a NormalizedConversation that matches ChatVault's schema.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.kind !== "extract") return false;
  extractConversation()
    .then((conversation) => sendResponse({ conversation }))
    .catch((err) => sendResponse({ error: err?.message ?? String(err) }));
  return true; // async response
});

const CDN_HOST_RE =
  /^(?:https?:\/\/)?(?:files\.oaiusercontent\.com|cdn\.oaistatic\.com|chat\.openai\.com\/backend-api\/files\/|chatgpt\.com\/backend-api\/files\/)/i;

function isAttachmentUrl(url) {
  if (!url) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  return CDN_HOST_RE.test(url);
}

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
    const detected = window.__chatvaultDetectAttachments(node, isAttachmentUrl);
    const attachments = await materializeAll(detected);
    const filenames = detected.map((d) => d.filename);
    const content = extractMessageContent(node, filenames);
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

function extractMessageContent(node, attachmentFilenames) {
  // Assistant messages keep their rendered markdown inside a .markdown child;
  // user messages don't have it (they're shown as plain text).
  const target = node.querySelector(".markdown") || node;
  const raw = window.__chatvaultHtmlToMarkdown(target);
  return window.__chatvaultStripAttachmentText(raw, attachmentFilenames);
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
