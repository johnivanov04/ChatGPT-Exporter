const btn = document.getElementById("export-btn");
const status = document.getElementById("status");

async function checkTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const supported =
    !!tab?.url &&
    /^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai)\//.test(tab.url);
  if (!supported) {
    btn.disabled = true;
    setStatus(
      "Open a ChatGPT or Claude conversation tab, then click the extension icon there.",
      "error",
    );
  }
}
checkTab();

btn.addEventListener("click", async () => {
  btn.classList.add("is-loading");
  btn.disabled = true;
  setStatus("Extracting conversation…", "");
  try {
    const res = await chrome.runtime.sendMessage({ kind: "export" });
    if (!res || res.ok === false) {
      throw new Error(res?.error ?? "Unknown error.");
    }
    setStatus(
      `Sent ${res.messageCount} message${res.messageCount === 1 ? "" : "s"} to ChatVault.`,
      "success",
    );
    setTimeout(() => window.close(), 700);
  } catch (err) {
    setStatus(err?.message ?? String(err), "error");
    btn.disabled = false;
  } finally {
    btn.classList.remove("is-loading");
  }
});

function setStatus(text, variant) {
  status.textContent = text;
  status.classList.remove("is-error", "is-success");
  if (variant === "error") status.classList.add("is-error");
  if (variant === "success") status.classList.add("is-success");
}
