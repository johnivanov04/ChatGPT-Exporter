// Shared helper that fetches a file URL (using the page's existing session
// cookies via `credentials: "include"`) and returns a base64-encoded payload
// the content script can ship to ChatVault.
//
// Returns `{ dataBase64, mimeType, size }` on success or `{ fetchError }`
// when the fetch fails (CORS, 404, auth, etc.). The caller is expected to
// pair the result with a filename it already has.
//
// Exposed as `window.__chatvaultFetchAttachment(url)`.

(function () {
  if (typeof window === "undefined") return;
  if (window.__chatvaultFetchAttachment) return;

  async function fetchAttachment(url) {
    if (typeof url !== "string" || !url) {
      return { fetchError: "Missing URL" };
    }
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        return { fetchError: `HTTP ${res.status} ${res.statusText || ""}`.trim() };
      }
      const blob = await res.blob();
      const dataBase64 = await blobToBase64(blob);
      return {
        dataBase64,
        mimeType: blob.type || undefined,
        size: blob.size,
      };
    } catch (err) {
      return {
        fetchError:
          (err && (err.message || String(err))) || "Network or CORS error",
      };
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Could not read attachment as base64"));
          return;
        }
        // result is "data:<mime>;base64,<payload>"
        const comma = result.indexOf(",");
        resolve(comma === -1 ? result : result.slice(comma + 1));
      };
      reader.onerror = () => reject(reader.error || new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });
  }

  window.__chatvaultFetchAttachment = fetchAttachment;
})();
