// Runs only on chatvault.space. Bridges the conversation payload from
// `chrome.storage.local` (where background.js dropped it) into the web app
// via `window.postMessage`. We use storage instead of a URL fragment because
// fragment size is the wrong shape for multi-MB payloads (attachments).

(async function () {
  if (window.__chatvaultBridgeFired) return;
  window.__chatvaultBridgeFired = true;
  try {
    const stored = await chrome.storage.local.get("chatvault.pending");
    const payload = stored["chatvault.pending"];
    if (!payload) return;
    await chrome.storage.local.remove("chatvault.pending");
    // Same-origin postMessage; the listener in App.tsx checks event.origin.
    window.postMessage(
      { type: "chatvault:import", payload },
      window.location.origin,
    );
  } catch (err) {
    console.error("[ChatVault bridge]", err);
  }
})();
