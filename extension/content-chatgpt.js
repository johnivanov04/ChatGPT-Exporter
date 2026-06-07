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
  try {
    console.log(
      "[ChatVault cs] starting extract; cache summary:",
      window.__chatvaultCacheSummary?.() ?? "(no summary fn)",
    );
  } catch {
    /* ignore */
  }
  const nodes = document.querySelectorAll("[data-message-author-role]");
  if (nodes.length === 0) {
    throw new Error(
      "No messages found on this page. Open a conversation thread first.",
    );
  }

  // Phase 1: collect all file_xxx IDs across the conversation and ask the
  // bridge to proactively fetch any that aren't already cached (typically
  // PDFs — ChatGPT doesn't auto-fetch metadata for files without an inline
  // thumbnail).
  await proactivelyFetchUncached(nodes);

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

async function proactivelyFetchUncached(messageNodes) {
  const fileIds = new Set();
  const re = /file_[a-z0-9]{16,}/gi;
  for (const node of messageNodes) {
    const html = node.outerHTML || "";
    let m;
    while ((m = re.exec(html)) !== null) fileIds.add(m[0]);
  }
  if (fileIds.size === 0) return;
  console.log(
    "[ChatVault cs] found file_ids in DOM:",
    Array.from(fileIds),
  );
  const pending = Array.from(fileIds).map((id) => fetchFileIdViaBridge(id));
  await Promise.all(pending);
}

function fetchFileIdViaBridge(fileId) {
  return new Promise((resolve) => {
    const requestId = `req-${Math.random().toString(36).slice(2)}`;
    const handler = (e) => {
      if (e.source !== window) return;
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.type !== "chatvault:fetch-file-id-done") return;
      if (d.requestId !== requestId) return;
      window.removeEventListener("message", handler);
      resolve();
    };
    window.addEventListener("message", handler);
    window.postMessage(
      {
        type: "chatvault:fetch-file-id-request",
        requestId,
        fileId,
      },
      window.location.origin,
    );
    setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve();
    }, 15000);
  });
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
    // 1) Cache: captured by the MAIN-world bridge when the page itself
    //    fetched the file (image previews, opened PDFs, etc.).
    const cachedByName = window.__chatvaultCapturedAttachment(d.filename);
    if (cachedByName) {
      out.push({
        filename: d.filename,
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
          filename: d.filename,
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
      out.push({ filename: d.filename, ...fetched });
      continue;
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
