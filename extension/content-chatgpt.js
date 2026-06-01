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

  const title = pageTitle();
  return {
    id: `chatgpt-ext-${Date.now()}`,
    title,
    source: "browser_extension",
    createdAt: new Date().toISOString(),
    messages,
    metadata: { provider: "chatgpt", extractedFrom: location.href },
  };
}

function pageTitle() {
  // ChatGPT puts " | ChatGPT" or similar at the end of the document title.
  const raw = document.title.replace(/\s*[—|·-]?\s*ChatGPT\s*$/i, "").trim();
  return raw || "Untitled conversation";
}

function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "user" || r === "assistant" || r === "system" || r === "tool")
    return r;
  return "unknown";
}

/* ---------------------- HTML → markdown-ish text ---------------------- */

function extractMessageContent(node) {
  // Assistant messages keep their rendered markdown inside a .markdown child;
  // user messages don't have it (they're shown as plain text).
  const target = node.querySelector(".markdown") || node;
  const out = [];
  walk(target, out);
  // Collapse trailing whitespace and 3+ consecutive blank lines.
  return out.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function walk(node, out) {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(node.textContent || "");
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const tag = node.tagName.toLowerCase();

  // Skip ChatGPT UI chrome that shouldn't leak into the export.
  if (
    tag === "button" ||
    node.getAttribute("role") === "button" ||
    node.classList?.contains("sr-only")
  ) {
    return;
  }

  switch (tag) {
    case "pre": {
      const code = node.querySelector("code");
      const lang = code ? langFromClass(code.className) : "";
      const body = (code ? code.textContent : node.textContent) || "";
      out.push(`\n\n\`\`\`${lang}\n${body.replace(/\n+$/, "")}\n\`\`\`\n\n`);
      return;
    }
    case "code":
      // Inline code (block code is handled above and short-circuits).
      out.push("`");
      out.push(node.textContent || "");
      out.push("`");
      return;
    case "br":
      out.push("\n");
      return;
    case "strong":
    case "b":
      out.push("**");
      for (const c of node.childNodes) walk(c, out);
      out.push("**");
      return;
    case "em":
    case "i":
      out.push("*");
      for (const c of node.childNodes) walk(c, out);
      out.push("*");
      return;
    case "a": {
      out.push("[");
      for (const c of node.childNodes) walk(c, out);
      const href = node.getAttribute("href") || "";
      out.push(`](${href})`);
      return;
    }
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = "#".repeat(Number(tag[1]));
      out.push(`\n\n${level} `);
      for (const c of node.childNodes) walk(c, out);
      out.push("\n\n");
      return;
    }
    case "ul":
    case "ol": {
      let idx = 0;
      for (const child of node.children) {
        if (child.tagName.toLowerCase() !== "li") continue;
        idx++;
        const marker = tag === "ol" ? `${idx}. ` : "- ";
        out.push("\n" + marker);
        for (const c of child.childNodes) walk(c, out);
      }
      out.push("\n");
      return;
    }
    case "blockquote":
      out.push("\n> ");
      for (const c of node.childNodes) walk(c, out);
      out.push("\n");
      return;
    case "p":
    case "div":
      for (const c of node.childNodes) walk(c, out);
      out.push("\n\n");
      return;
    case "table": {
      out.push("\n");
      const rows = node.querySelectorAll("tr");
      rows.forEach((row, rowIdx) => {
        const cells = row.querySelectorAll("th,td");
        out.push("| ");
        cells.forEach((c, i) => {
          out.push((c.textContent || "").trim().replace(/\|/g, "\\|"));
          if (i < cells.length - 1) out.push(" | ");
        });
        out.push(" |\n");
        if (rowIdx === 0) {
          out.push("| ");
          cells.forEach((_, i) => {
            out.push("---");
            if (i < cells.length - 1) out.push(" | ");
          });
          out.push(" |\n");
        }
      });
      out.push("\n");
      return;
    }
    case "img": {
      const alt = node.getAttribute("alt") || "image";
      out.push(`[${alt}]`);
      return;
    }
    default:
      for (const c of node.childNodes) walk(c, out);
  }
}

function langFromClass(className) {
  const m = /language-([\w+#-]+)/.exec(className || "");
  return m ? m[1] : "";
}
