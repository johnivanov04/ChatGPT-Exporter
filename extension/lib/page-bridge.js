// Runs in the PAGE'S MAIN world at document_start. Wraps window.fetch so that
// every attachment-shaped response (PDFs, images, etc. coming from
// ChatGPT/Claude file CDNs) is captured and forwarded to the content script
// via window.postMessage with a base64 payload + filename from the
// Content-Disposition header.
//
// The content script (isolated world) has its own listener that pushes these
// into a Map keyed by filename. At export time it looks attachments up by
// filename before falling back to a direct fetch.
//
// Why MAIN world? Content scripts run in an isolated JS world that doesn't
// share globals with the page. To intercept the page's own fetch calls we
// have to inject into the same world where those calls happen.

(function () {
  if (window.__chatvaultBridgeInstalled) return;
  window.__chatvaultBridgeInstalled = true;

  // Match URLs that look like attachment binaries from ChatGPT or Claude.
  // We deliberately do NOT capture the conversation API itself or the
  // sea of telemetry/tracking calls — only fetches that look like file CDN
  // or files-API responses.
  const ATTACHMENT_URL_RE =
    /^https?:\/\/(?:files\.oaiusercontent\.com|cdn\.oaistatic\.com|chatgpt\.com\/backend-api\/files\/|chat\.openai\.com\/backend-api\/files\/|files\.anthropic\.com|claude\.ai\/api\/[^/]*\/files\/|claude\.ai\/api\/files\/|cdn\.anthropic\.com)/i;

  const MAX_CAPTURE_BYTES = 100 * 1024 * 1024; // 100 MB safety cap

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = urlOf(args[0]);
      if (url && ATTACHMENT_URL_RE.test(url) && response.ok) {
        // Don't block the page on capture work; the response itself is
        // returned synchronously.
        captureResponse(url, response.clone()).catch(() => {});
      }
    } catch {
      /* never throw from interceptor */
    }
    return response;
  };

  async function captureResponse(url, response) {
    try {
      const cl = response.headers.get("content-length");
      if (cl && Number(cl) > MAX_CAPTURE_BYTES) return;
      const blob = await response.blob();
      if (blob.size === 0 || blob.size > MAX_CAPTURE_BYTES) return;
      const filename = extractFilename(url, response.headers);
      const dataBase64 = await blobToBase64(blob);
      window.postMessage(
        {
          type: "chatvault:attachment-captured",
          url,
          filename,
          mimeType: blob.type || "",
          size: blob.size,
          dataBase64,
        },
        window.location.origin,
      );
    } catch {
      /* swallow */
    }
  }

  function urlOf(arg) {
    if (typeof arg === "string") return arg;
    if (arg && typeof arg === "object" && typeof arg.url === "string") {
      return arg.url;
    }
    return "";
  }

  function extractFilename(url, headers) {
    const cd = headers.get?.("content-disposition") || "";
    // RFC 5987 UTF-8 form: filename*=UTF-8''<encoded>
    const m1 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
    if (m1) {
      try {
        return decodeURIComponent(m1[1].trim().replace(/"$/, ""));
      } catch {
        /* fallthrough */
      }
    }
    const m2 = /filename\s*=\s*"?([^";\n]+)"?/i.exec(cd);
    if (m2) return m2[1].trim();
    try {
      const u = new URL(url, window.location.href);
      // ChatGPT signed URLs sometimes carry filename in `rscd` (Response
      // Content-Disposition) param.
      const rscd = u.searchParams.get("rscd") || "";
      const m3 = /filename\s*=\s*"?([^";\n]+)"?/i.exec(rscd);
      if (m3) return m3[1].trim();
      const last = u.pathname.split("/").filter(Boolean).pop() || "";
      return last ? decodeURIComponent(last) : "";
    } catch {
      return "";
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const r = reader.result;
        if (typeof r !== "string") {
          reject(new Error("Could not read blob"));
          return;
        }
        const comma = r.indexOf(",");
        resolve(comma === -1 ? r : r.slice(comma + 1));
      };
      reader.onerror = () =>
        reject(reader.error || new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });
  }
})();
