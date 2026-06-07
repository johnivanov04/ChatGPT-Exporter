// Runs in the PAGE'S MAIN world at document_start. Wraps `fetch` AND
// `XMLHttpRequest` so attachment-shaped responses (PDFs, images, etc. coming
// from ChatGPT/Claude file CDNs) get captured and forwarded to the content
// script via window.postMessage with a base64 payload + filename.
//
// Verbose `console.debug` calls help diagnose URL-pattern mismatches when
// the provider changes its CDN paths. Look in DevTools → Console for
// `[ChatVault bridge]` lines.

(function () {
  if (window.__chatvaultBridgeInstalled) return;
  window.__chatvaultBridgeInstalled = true;

  // Patterns that look like attachment binaries. We deliberately accept many
  // shapes because providers move things around. We DON'T capture obvious
  // non-attachment endpoints (conversation API, telemetry, etc.).
  const ATTACHMENT_URL_PATTERNS = [
    // ChatGPT
    /files\.oaiusercontent\.com/i,
    /cdn\.oaistatic\.com/i,
    /[\w.]*\.oaiusercontent\.com/i,
    /chatgpt\.com\/backend-api\/files\//i,
    /chat\.openai\.com\/backend-api\/files\//i,
    // Claude
    /files\.anthropic\.com/i,
    /claude\.ai\/api\/[^/]+\/files\//i,
    /claude\.ai\/api\/files\//i,
    /cdn\.anthropic\.com/i,
    // Generic CDN-shaped paths for either provider
    /sdmnt-[\w-]+\.oaiusercontent\.com/i,
  ];

  // Also capture if the response is binary-shaped AND the request came from a
  // recognised host.
  const ATTACHMENT_HOST_PATTERNS = [
    /oaiusercontent\.com/i,
    /openai\.com/i,
    /chatgpt\.com/i,
    /anthropic\.com/i,
    /claude\.ai/i,
  ];

  const ATTACHMENT_CONTENT_TYPES = [
    /^application\/pdf/i,
    /^application\/zip/i,
    /^application\/vnd\.openxmlformats/i,
    /^application\/vnd\.ms-/i,
    /^application\/msword/i,
    /^application\/octet-stream/i,
    /^text\/csv/i,
    /^audio\//i,
    /^video\//i,
  ];

  const MAX_CAPTURE_BYTES = 100 * 1024 * 1024;

  log("installed at", location.href);

  /* ----------------------------- fetch wrap ----------------------------- */

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = urlOf(args[0]);
      maybeCapture(url, response.clone());
    } catch (err) {
      log("fetch wrap error", err);
    }
    return response;
  };

  /* ----------------------------- XHR wrap ------------------------------- */

  const Xhr = window.XMLHttpRequest;
  if (Xhr && Xhr.prototype) {
    const origOpen = Xhr.prototype.open;
    const origSend = Xhr.prototype.send;
    Xhr.prototype.open = function (method, url, ...rest) {
      this.__chatvaultUrl = String(url || "");
      return origOpen.call(this, method, url, ...rest);
    };
    Xhr.prototype.send = function (...args) {
      this.addEventListener("load", () => {
        try {
          const url = this.__chatvaultUrl || "";
          if (!url) return;
          if (!looksLikeAttachmentByUrl(url)) {
            const ct = this.getResponseHeader?.("content-type") || "";
            if (!looksLikeAttachmentByContentType(ct) || !matchesAttachmentHost(url)) {
              return;
            }
          }
          // We can only capture the body if it was requested as blob/array.
          if (this.responseType === "blob" && this.response instanceof Blob) {
            captureBlob(url, this.response, this.getAllResponseHeaders?.() || "");
          } else if (this.responseType === "arraybuffer" && this.response) {
            const blob = new Blob([this.response]);
            captureBlob(url, blob, this.getAllResponseHeaders?.() || "");
          } else {
            log("XHR matched but responseType unsupported", this.responseType, url);
          }
        } catch (err) {
          log("xhr wrap error", err);
        }
      });
      return origSend.apply(this, args);
    };
    log("XHR wrapped");
  }

  /* ----------------------------- capture --------------------------------- */

  async function maybeCapture(url, response) {
    if (!url) return;
    let matched = looksLikeAttachmentByUrl(url);
    if (!matched) {
      const ct = response.headers.get("content-type") || "";
      if (looksLikeAttachmentByContentType(ct) && matchesAttachmentHost(url)) {
        matched = true;
      }
    }
    if (!matched) {
      // Quieter log so DevTools isn't drowned by every fetch.
      if (matchesAttachmentHost(url)) {
        log("ignored (didn't match attachment patterns)", url);
      }
      return;
    }
    if (!response.ok) {
      log("not ok response", response.status, url);
      return;
    }
    try {
      const blob = await response.blob();
      await captureBlob(url, blob, rawHeaders(response.headers));
    } catch (err) {
      log("capture error", err, url);
    }
  }

  async function captureBlob(url, blob, headerBlob) {
    if (!(blob instanceof Blob)) return;
    if (blob.size === 0 || blob.size > MAX_CAPTURE_BYTES) {
      log("skipped (size out of range)", blob.size, url);
      return;
    }
    const filename = extractFilenameFromHeaders(url, headerBlob);
    const dataBase64 = await blobToBase64(blob);
    log(
      "captured",
      filename || "(no filename)",
      `${(blob.size / 1024).toFixed(1)}KB`,
      blob.type || "(no mime)",
      url,
    );
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
  }

  /* ---------------------------- predicates ------------------------------- */

  function looksLikeAttachmentByUrl(url) {
    return ATTACHMENT_URL_PATTERNS.some((re) => re.test(url));
  }
  function looksLikeAttachmentByContentType(ct) {
    if (!ct) return false;
    return ATTACHMENT_CONTENT_TYPES.some((re) => re.test(ct));
  }
  function matchesAttachmentHost(url) {
    return ATTACHMENT_HOST_PATTERNS.some((re) => re.test(url));
  }

  /* ----------------------------- helpers --------------------------------- */

  function urlOf(arg) {
    if (typeof arg === "string") return arg;
    if (arg && typeof arg === "object" && typeof arg.url === "string") {
      return arg.url;
    }
    return "";
  }

  function rawHeaders(headers) {
    // Pass headers through extractFilenameFromHeaders as an object; for fetch
    // we have a Headers instance, for XHR we have the raw header blob string.
    return headers;
  }

  function extractFilenameFromHeaders(url, headers) {
    let cd = "";
    if (typeof headers === "string") {
      const m = /content-disposition:\s*([^\r\n]+)/i.exec(headers);
      cd = m ? m[1] : "";
    } else if (headers && typeof headers.get === "function") {
      cd = headers.get("content-disposition") || "";
    }
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

  function log(...args) {
    try {
      console.debug("[ChatVault bridge]", ...args);
    } catch {
      /* ignore */
    }
  }
})();
