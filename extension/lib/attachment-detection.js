// Shared attachment-detection helpers. Exposes two globals:
//
//   window.__chatvaultFilenameRe         RegExp that matches "<basename>.<ext>"
//   window.__chatvaultLabelRe            RegExp that matches "PDF", "IMAGE", …
//   window.__chatvaultDetectAttachments(node, isAttachmentUrl)
//
// The detector runs THREE strategies and merges them:
//   (1) anchor tags with a CDN/blob/data href
//   (2) img tags with a CDN src
//   (3) "card" detection — a text node matching a filename pattern, wrapped
//       in a compact container (heuristic for cards without download URLs).
//
// Strategy (3) is what catches modern ChatGPT/Claude attachment cards that
// render the filename as plain text in a styled `<div>` (no `<a href>`).
//
// Each result has at least { filename }. If a usable URL is found, it's set
// as `url` so the caller can fetch the binary.

(function () {
  if (typeof window === "undefined") return;
  if (window.__chatvaultDetectAttachments) return;

  const FILE_EXT =
    "pdf|png|jpe?g|gif|webp|svg|heic|csv|xlsx?|docx?|pptx?|txt|md|markdown|py|js|tsx?|jsx?|json|yaml|yml|html?|css|sql|sh|bash|zip|tar|gz|mp[34]|mov|wav|mp4|m4a|aiff?";

  const FILENAME_RE = new RegExp(
    `^[\\w\\-. ()\\[\\]]+\\.(?:${FILE_EXT})$`,
    "i",
  );
  const LABEL_RE =
    /^(PDF|IMAGE|FILE|AUDIO|VIDEO|DOCUMENT|SPREADSHEET|TEXT|CODE|SCREENSHOT|SPREADSHEET)$/;

  function detectAttachments(messageNode, isAttachmentUrl) {
    const byKey = new Map();
    const upsert = (key, entry) => {
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, entry);
      } else if (!existing.url && entry.url) {
        // Prefer the variant that has a URL.
        byKey.set(key, { ...existing, ...entry });
      }
    };

    // (1) Anchor tags pointing at attachment URLs.
    for (const a of messageNode.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      if (!href || !isAttachmentUrl(href)) continue;
      const filename =
        a.getAttribute("download") ||
        (a.textContent || "").trim() ||
        filenameFromUrl(href);
      upsert(filename || href, {
        filename: filename || "attachment",
        url: href,
      });
    }

    // (2) Image tags pointing at attachment URLs.
    for (const img of messageNode.querySelectorAll("img[src]")) {
      const src = img.getAttribute("src") || "";
      if (!src || !isAttachmentUrl(src)) continue;
      const filename =
        img.getAttribute("alt") ||
        filenameFromUrl(src) ||
        `image-${byKey.size + 1}.png`;
      upsert(filename, { filename, url: src });
    }

    // (3) Card detection — filename-shaped text in a compact container.
    const walker = document.createTreeWalker(
      messageNode,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || "").trim();
      if (!text || !FILENAME_RE.test(text)) continue;
      if (byKey.has(text)) continue;
      const card = findCompactCard(node, messageNode);
      const url = card ? findAttachmentUrlInCard(card, isAttachmentUrl) : null;
      upsert(text, { filename: text, url: url || undefined });
    }

    return Array.from(byKey.values());
  }

  function findCompactCard(textNode, stopAt) {
    let best = null;
    let cursor = textNode.parentElement;
    while (cursor && cursor !== stopAt) {
      const t = (cursor.textContent || "").trim();
      if (t.length === 0) {
        cursor = cursor.parentElement;
        continue;
      }
      // The "card" is the largest ancestor whose total text is still short
      // (≤ ~200 chars). Once we cross that threshold, stop walking up.
      if (t.length <= 200) {
        best = cursor;
      } else {
        break;
      }
      cursor = cursor.parentElement;
    }
    return best;
  }

  function findAttachmentUrlInCard(card, isAttachmentUrl) {
    for (const a of card.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      if (href && isAttachmentUrl(href)) return href;
    }
    const closestA = card.closest("a[href]");
    if (closestA) {
      const href = closestA.getAttribute("href") || "";
      if (href && isAttachmentUrl(href)) return href;
    }
    // Look for `data-href` or similar custom attrs sometimes used.
    for (const el of [card, ...card.querySelectorAll("*")]) {
      for (const attr of ["data-href", "data-url", "data-file-url"]) {
        const v = el.getAttribute?.(attr);
        if (v && isAttachmentUrl(v)) return v;
      }
    }
    return null;
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

  /**
   * Remove the filename + standard type-label lines from extracted markdown so
   * an attachment that's detected as a chip doesn't also show up inline in
   * the message text.
   */
  function stripAttachmentText(markdown, filenames) {
    if (!markdown) return "";
    let out = markdown;
    for (const filename of filenames) {
      if (!filename) continue;
      const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`^\\s*${escaped}\\s*$`, "gm"), "");
    }
    out = out.replace(
      /^\s*(PDF|IMAGE|FILE|AUDIO|VIDEO|DOCUMENT|SPREADSHEET|TEXT|CODE|SCREENSHOT)\s*$/gm,
      "",
    );
    return out.replace(/\n{3,}/g, "\n\n").trim();
  }

  window.__chatvaultFilenameRe = FILENAME_RE;
  window.__chatvaultLabelRe = LABEL_RE;
  window.__chatvaultDetectAttachments = detectAttachments;
  window.__chatvaultStripAttachmentText = stripAttachmentText;
})();
