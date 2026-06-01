// Service worker for the ChatVault extension. Handles "export" messages from
// the popup: asks the active tab's content script for the current conversation,
// encodes it as a base64-url URL fragment, and opens the ChatVault web app
// with the conversation pre-loaded (no file upload needed).

const CHATVAULT_URL = "https://chatvault.space";
const SUPPORTED_URL_RE = /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//;

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
    throw new Error("Open a ChatGPT conversation tab first.");
  }
  if (typeof tab.id !== "number") {
    throw new Error("Active tab has no id.");
  }
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { kind: "extract" });
  } catch {
    throw new Error(
      "Couldn't reach the page. Reload the ChatGPT tab and try again.",
    );
  }
  if (!response || response.error) {
    throw new Error(response?.error ?? "Could not extract the conversation.");
  }
  if (!response.conversation?.messages?.length) {
    throw new Error("No messages found on this page.");
  }
  const encoded = encodePayload(response.conversation);
  await chrome.tabs.create({
    url: `${CHATVAULT_URL}/#import=${encoded}`,
  });
  return { ok: true, messageCount: response.conversation.messages.length };
}

function encodePayload(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
