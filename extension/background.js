// Service worker for the ChatVault extension. Handles "export" messages from
// the popup: asks the active tab's content script for the current conversation,
// stashes it in chrome.storage.local, and opens the ChatVault web app where
// a bridge content script forwards it to the page via window.postMessage.
//
// We use chrome.storage instead of a URL-fragment payload so we can carry
// arbitrarily-large data (e.g. PDF attachments encoded as base64).

const CHATVAULT_URL = "https://chatvault.space";
const SUPPORTED_URL_RE =
  /^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai)\//;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.kind !== "export") return false;
  handleExport()
    .then((res) => sendResponse(res))
    .catch((err) =>
      sendResponse({ ok: false, error: err?.message ?? String(err) }),
    );
  return true; // keep channel open for the async reply
});

async function handleExport() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab.");
  if (!tab.url || !SUPPORTED_URL_RE.test(tab.url)) {
    throw new Error("Open a ChatGPT or Claude conversation tab first.");
  }
  if (typeof tab.id !== "number") {
    throw new Error("Active tab has no id.");
  }
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { kind: "extract" });
  } catch {
    throw new Error("Couldn't reach the page. Reload the tab and try again.");
  }
  if (!response || response.error) {
    throw new Error(response?.error ?? "Could not extract the conversation.");
  }
  if (!response.conversation?.messages?.length) {
    throw new Error("No messages found on this page.");
  }

  await chrome.storage.local.set({
    "chatvault.pending": response.conversation,
  });
  await chrome.tabs.create({ url: `${CHATVAULT_URL}/#from-extension` });
  return { ok: true, messageCount: response.conversation.messages.length };
}
