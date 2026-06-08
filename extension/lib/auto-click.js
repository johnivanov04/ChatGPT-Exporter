// When proactive metadata fetch fails (typically for PDFs/documents that
// ChatGPT only fetches binaries for on user click), we fall back to driving
// the page ourselves: find the attachment card's clickable element, dispatch
// a click, wait for the bridge to capture the binary, then close the modal
// the page opened.
//
// Exposes window.__chatvaultAutoClickUncached(messageNodes, detectFn) which
// the per-provider content scripts call after their normal extraction pass.
//
// Sequential by design — modals fight if you click multiple at once.

(function () {
  if (typeof window === "undefined") return;
  if (window.__chatvaultAutoClickUncached) return;

  const MAX_CLICKS = 10; // bound the UX disruption
  const CAPTURE_TIMEOUT_MS = 5000;
  const POLL_INTERVAL_MS = 100;
  const POST_CLOSE_DELAY_MS = 250;

  async function autoClickUncached(messageNodes, detectFn) {
    console.log(
      "[ChatVault cs] autoClickUncached scanning",
      messageNodes.length,
      "messages",
    );
    const tasks = [];
    let totalDetected = 0;
    for (const node of messageNodes) {
      const detected = detectFn(node);
      totalDetected += detected.length;
      for (const d of detected) {
        if (window.__chatvaultCapturedAttachment(d.filename)) continue;
        tasks.push({ node, filename: d.filename });
        if (tasks.length >= MAX_CLICKS) break;
      }
      if (tasks.length >= MAX_CLICKS) break;
    }
    console.log(
      "[ChatVault cs] auto-click scan:",
      totalDetected,
      "attachments detected,",
      tasks.length,
      "uncached and queued for click",
    );
    if (tasks.length === 0) return;
    console.log(
      "[ChatVault cs] auto-clicking",
      tasks.length,
      "uncached attachment(s):",
      tasks.map((t) => t.filename),
    );
    for (const task of tasks) {
      // Recheck — the bridge may have populated this filename via a previous
      // click (e.g. when a single click triggered multiple downloads).
      if (window.__chatvaultCapturedAttachment(task.filename)) continue;
      await autoClickOne(task.node, task.filename);
    }
  }

  async function autoClickOne(messageNode, filename) {
    const target = findClickTarget(messageNode, filename);
    if (!target) {
      console.log("[ChatVault cs] no click target for", filename);
      return;
    }
    console.log("[ChatVault cs] auto-clicking", filename);
    try {
      target.click();
      const captured = await waitForCache(filename, CAPTURE_TIMEOUT_MS);
      await closeOpenModal();
      await sleep(POST_CLOSE_DELAY_MS);
      console.log(
        captured
          ? `[ChatVault cs] auto-click captured ${filename}`
          : `[ChatVault cs] auto-click TIMEOUT for ${filename}`,
      );
    } catch (err) {
      console.log("[ChatVault cs] auto-click error", filename, err);
      await closeOpenModal();
    }
  }

  /* -------------------- click-target finder ------------------------------ */

  function findClickTarget(messageNode, filename) {
    // Walk text nodes — anything whose trimmed text matches the filename.
    const walker = document.createTreeWalker(
      messageNode,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || "").trim();
      if (text !== filename) continue;
      // Walk up looking for a clickable ancestor.
      let el = node.parentElement;
      while (el && el !== messageNode) {
        if (isClickable(el)) return el;
        el = el.parentElement;
      }
    }
    return null;
  }

  function isClickable(el) {
    const tag = el.tagName?.toLowerCase();
    if (tag === "button" || tag === "a") return true;
    if (el.getAttribute("role") === "button") return true;
    try {
      const style = window.getComputedStyle(el);
      if (style.cursor === "pointer") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  /* -------------------- wait for capture --------------------------------- */

  function waitForCache(filename, timeoutMs) {
    return new Promise((resolve) => {
      let elapsed = 0;
      const tick = () => {
        const entry = window.__chatvaultCapturedAttachment(filename);
        if (entry) return resolve(true);
        elapsed += POLL_INTERVAL_MS;
        if (elapsed >= timeoutMs) return resolve(false);
        setTimeout(tick, POLL_INTERVAL_MS);
      };
      setTimeout(tick, POLL_INTERVAL_MS);
    });
  }

  /* -------------------- modal close -------------------------------------- */

  async function closeOpenModal() {
    // 1) Try the Escape key — works for most React modal libraries.
    dispatchKey("Escape");
    await sleep(150);

    // 2) Look for visible close buttons inside any open dialog/modal.
    const closeBtns = document.querySelectorAll(
      [
        '[role="dialog"] [aria-label*="close" i]',
        '[role="dialog"] [data-testid*="close" i]',
        '[role="dialog"] button[aria-label*="dismiss" i]',
        'button[aria-label="Close" i]',
        'button[data-testid*="close" i]',
      ].join(","),
    );
    for (const btn of closeBtns) {
      if (isVisible(btn)) {
        try {
          btn.click();
          await sleep(100);
        } catch {
          /* ignore */
        }
      }
    }

    // 3) Final fallback — if a modal is still open, dispatch Escape again.
    const stillOpen = document.querySelector('[role="dialog"]');
    if (stillOpen && isVisible(stillOpen)) {
      dispatchKey("Escape");
      await sleep(150);
    }
  }

  function dispatchKey(key) {
    const opts = {
      key,
      code: key === "Escape" ? "Escape" : key,
      keyCode: key === "Escape" ? 27 : 0,
      which: key === "Escape" ? 27 : 0,
      bubbles: true,
      cancelable: true,
    };
    // Dispatch on both document and body, since some handlers listen on each.
    try {
      document.dispatchEvent(new KeyboardEvent("keydown", opts));
      document.dispatchEvent(new KeyboardEvent("keyup", opts));
    } catch {
      /* ignore */
    }
    try {
      document.body?.dispatchEvent(new KeyboardEvent("keydown", opts));
      document.body?.dispatchEvent(new KeyboardEvent("keyup", opts));
    } catch {
      /* ignore */
    }
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    try {
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden") return false;
      if (style.display === "none") return false;
    } catch {
      /* ignore */
    }
    return true;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  window.__chatvaultAutoClickUncached = autoClickUncached;
  console.log("[ChatVault cs] auto-click module loaded");
})();
