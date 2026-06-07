// Isolated-world helpers for the per-provider content scripts. Three things:
//
//   __chatvaultFetchAttachment(url)
//       Direct content-script fetch (uses the page's session cookies via
//       credentials: "include"). Returns { dataBase64, mimeType, size } or
//       { fetchError } on failure.
//
//   __chatvaultCapturedAttachment(filename)
//   __chatvaultCapturedAttachmentByUrl(url)
//       Look up an attachment that was captured by the MAIN-world bridge
//       (lib/page-bridge.js) as the page itself fetched it.

(function () {
  if (typeof window === "undefined") return;
  if (window.__chatvaultFetchAttachment) return;

  /* ----------------------- captured-by-bridge cache ---------------------- */

  const byFilename = new Map();
  const byUrl = new Map();

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    if (e.origin !== window.location.origin) return;
    const d = e.data;
    if (!d || d.type !== "chatvault:attachment-captured") return;
    if (typeof d.dataBase64 !== "string") return;
    const entry = {
      dataBase64: d.dataBase64,
      mimeType: d.mimeType || "",
      size: typeof d.size === "number" ? d.size : undefined,
      url: typeof d.url === "string" ? d.url : "",
    };
    if (d.filename && typeof d.filename === "string") {
      byFilename.set(d.filename, entry);
    }
    if (entry.url) byUrl.set(entry.url, entry);
  });

  window.__chatvaultCapturedAttachment = function (filename) {
    return filename ? byFilename.get(filename) || null : null;
  };

  window.__chatvaultCapturedAttachmentByUrl = function (url) {
    return url ? byUrl.get(url) || null : null;
  };

  /* ----------------------- direct content-script fetch -------------------- */

  async function fetchAttachment(url) {
    if (typeof url !== "string" || !url) {
      return { fetchError: "Missing URL" };
    }
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        return {
          fetchError: `HTTP ${res.status} ${res.statusText || ""}`.trim(),
        };
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
        const comma = result.indexOf(",");
        resolve(comma === -1 ? result : result.slice(comma + 1));
      };
      reader.onerror = () =>
        reject(reader.error || new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });
  }

  window.__chatvaultFetchAttachment = fetchAttachment;
})();
