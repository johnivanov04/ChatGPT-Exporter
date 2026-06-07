// Runs in the PAGE'S MAIN world at document_start. Two responsibilities:
//
//   (1) Wrap window.fetch + XMLHttpRequest to capture attachment binaries
//       that the page itself downloads (image previews, fully-streamed PDFs).
//
//   (2) When a "file metadata" response is observed (e.g. ChatGPT's
//       /backend-api/files/download/file_xxx?download_intent=false), parse
//       the JSON, force a second request with download_intent=true to learn
//       the signed CDN URL, fetch the binary, and post it to the content
//       script as a captured attachment.
//
// All important events go through `log(...)` which uses console.log so
// they're visible in DevTools without enabling verbose mode.

(function () {
  if (window.__chatvaultBridgeInstalled) return;
  window.__chatvaultBridgeInstalled = true;

  const BINARY_URL_PATTERNS = [
    // Direct ChatGPT/Claude CDN endpoints
    /files\.oaiusercontent\.com/i,
    /cdn\.oaistatic\.com/i,
    /sdmnt-[\w-]+\.oaiusercontent\.com/i,
    /[\w.]+\.oaiusercontent\.com/i,
    /files\.anthropic\.com/i,
    /cdn\.anthropic\.com/i,
    /claude\.ai\/api\/[^/]+\/files\/[^/]+\/(?:content|download)/i,
  ];

  // Metadata URLs — JSON responses that describe a file and (sometimes)
  // contain a `download_url` field. We follow these to get the real binary.
  const CHATGPT_FILE_META_RE =
    /^https?:\/\/(?:chatgpt\.com|chat\.openai\.com)\/backend-api\/files\/download\/(file_[a-z0-9]+)/i;
  // Claude file metadata pattern (placeholder; we'll widen as we learn the
  // real shape).
  const CLAUDE_FILE_META_RE =
    /^https?:\/\/claude\.ai\/api\/[^/]+\/files\/([a-f0-9-]+)\/?$/i;

  // Endpoints we explicitly never follow even though they contain "files".
  const NEVER_FOLLOW = [
    /\/backend-api\/files\/library/i, // user's file index — not what we want
  ];

  const ATTACHMENT_CONTENT_TYPES = [
    /^application\/pdf/i,
    /^application\/zip/i,
    /^application\/vnd\.openxmlformats/i,
    /^application\/vnd\.ms-/i,
    /^application\/msword/i,
    /^application\/octet-stream/i,
    /^text\/csv/i,
    /^image\//i,
    /^audio\//i,
    /^video\//i,
  ];

  const MAX_CAPTURE_BYTES = 100 * 1024 * 1024;

  log("installed at", location.href);

  // Headers captured from the page's own working metadata fetches.
  // Replayed for on-demand fetches so we get past 403s.
  let capturedMetaInit = null;

  // Listen for "please fetch this file_id" requests from the content script,
  // which uses them to proactively pull attachments that the page itself
  // never bothered to fetch (typically PDFs, since no inline thumbnail).
  window.addEventListener("message", async (e) => {
    if (e.source !== window) return;
    if (e.origin !== window.location.origin) return;
    const d = e.data;
    if (!d || d.type !== "chatvault:fetch-file-id-request") return;
    const { requestId, fileId } = d;
    try {
      // Match the exact URL shape the page uses so we don't trip stricter
      // server-side validation:
      //   /backend-api/files/download/{file_id}?post_id=&inline=false&download_intent=false
      const metaUrl = `${location.origin}/backend-api/files/download/${fileId}?post_id=&inline=false&download_intent=false`;
      log(
        "on-demand metadata fetch",
        metaUrl,
        capturedMetaInit ? "(with replayed headers)" : "(plain)",
      );
      const init = buildOnDemandInit();
      const res = await originalFetch(metaUrl, init);
      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (/json/i.test(ct)) {
          const text = await res.text();
          await followMetadata(metaUrl, text);
        } else {
          const blob = await res.blob();
          await captureBlob(metaUrl, blob, res.headers, "(on-demand direct)");
        }
      } else {
        log("on-demand metadata HTTP error", res.status, fileId);
      }
    } catch (err) {
      log("on-demand fetch error", err, fileId);
    }
    window.postMessage(
      { type: "chatvault:fetch-file-id-done", requestId },
      window.location.origin,
    );
  });

  function buildOnDemandInit() {
    if (!capturedMetaInit) {
      return { credentials: "include" };
    }
    // Clone the captured Headers; drop ones that wouldn't transfer cleanly.
    const headers = new Headers();
    capturedMetaInit.forEach((value, key) => {
      const k = key.toLowerCase();
      if (k === "host" || k === "cookie" || k === "content-length") return;
      headers.set(key, value);
    });
    return { credentials: "include", headers };
  }

  function captureMetaInit(initOrRequest) {
    try {
      if (!initOrRequest) return;
      // Request object
      if (typeof Request !== "undefined" && initOrRequest instanceof Request) {
        capturedMetaInit = new Headers(initOrRequest.headers);
        return;
      }
      // plain init
      const headers = initOrRequest.headers;
      if (!headers) return;
      if (headers instanceof Headers) {
        capturedMetaInit = new Headers(headers);
      } else if (Array.isArray(headers)) {
        capturedMetaInit = new Headers(headers);
      } else if (typeof headers === "object") {
        capturedMetaInit = new Headers(headers);
      }
    } catch {
      /* ignore */
    }
  }

  /* ----------------------------- fetch wrap ----------------------------- */

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (...args) {
    // Snapshot the request init for metadata calls so we can replay it for
    // on-demand fetches later.
    try {
      const url = urlOf(args[0]);
      if (
        CHATGPT_FILE_META_RE.test(url) ||
        CLAUDE_FILE_META_RE.test(url)
      ) {
        captureMetaInit(args[1] || args[0]);
      }
    } catch {
      /* ignore */
    }
    const response = await originalFetch(...args);
    try {
      const url = urlOf(args[0]);
      processResponse(url, response.clone());
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
          if (this.responseType === "blob" && this.response instanceof Blob) {
            processXhr(url, this.response, this.getAllResponseHeaders?.() || "");
          } else if (this.responseType === "arraybuffer" && this.response) {
            const blob = new Blob([this.response]);
            processXhr(url, blob, this.getAllResponseHeaders?.() || "");
          }
        } catch (err) {
          log("xhr wrap error", err);
        }
      });
      return origSend.apply(this, args);
    };
    log("XHR wrapped");
  }

  /* ------------------------ response router ----------------------------- */

  async function processResponse(url, response) {
    if (!url || !response.ok) return;
    if (NEVER_FOLLOW.some((re) => re.test(url))) return;

    const ct = response.headers.get("content-type") || "";

    // (1) Direct binary on a known attachment URL — capture as-is.
    if (BINARY_URL_PATTERNS.some((re) => re.test(url))) {
      const blob = await response.blob();
      await captureBlob(url, blob, response.headers, "(direct CDN)");
      return;
    }

    // (2) JSON metadata for a file endpoint — try to follow.
    if (/json/i.test(ct)) {
      if (CHATGPT_FILE_META_RE.test(url) || CLAUDE_FILE_META_RE.test(url)) {
        const text = await response.text();
        await followMetadata(url, text);
        return;
      }
    }

    // (3) Binary content-type from a recognized host (catch-all).
    if (ATTACHMENT_CONTENT_TYPES.some((re) => re.test(ct))) {
      if (/oaiusercontent|openai\.com|chatgpt\.com|anthropic\.com|claude\.ai/i.test(url)) {
        const blob = await response.blob();
        await captureBlob(url, blob, response.headers, "(binary CT)");
        return;
      }
    }

    log("ignored (didn't match attachment patterns)", url);
  }

  async function processXhr(url, blob, rawHeaders) {
    if (BINARY_URL_PATTERNS.some((re) => re.test(url))) {
      await captureBlob(url, blob, rawHeaders, "(XHR direct)");
      return;
    }
    log("ignored XHR", url);
  }

  /* ----------------------- metadata follower ---------------------------- */

  async function followMetadata(metaUrl, jsonText) {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      log("metadata not JSON", metaUrl);
      return;
    }

    let downloadUrl = parsed.download_url || parsed.url || parsed.signed_url;
    let filename = parsed.file_name || parsed.filename || parsed.name;
    log("metadata seen", { metaUrl, downloadUrl, filename, keys: Object.keys(parsed) });

    // If the metadata didn't include a download URL, retry with
    // download_intent=true to coax the server into emitting one.
    if (!downloadUrl) {
      try {
        const forced = new URL(metaUrl);
        forced.searchParams.set("download_intent", "true");
        forced.searchParams.set("inline", "false");
        log("retrying with download_intent=true", forced.toString());
        const res = await originalFetch(forced.toString(), {
          credentials: "include",
        });
        if (!res.ok) {
          log("retry failed", res.status);
          return;
        }
        const ct = res.headers.get("content-type") || "";
        if (/json/i.test(ct)) {
          const j = await res.json();
          downloadUrl =
            j.download_url || j.url || j.signed_url || downloadUrl;
          filename = filename || j.file_name || j.filename || j.name;
        } else {
          // Server returned the binary directly.
          const blob = await res.blob();
          await captureBlob(
            forced.toString(),
            blob,
            res.headers,
            "(retry direct)",
            filename,
          );
          return;
        }
      } catch (err) {
        log("retry error", err);
        return;
      }
    }

    if (!downloadUrl) {
      log("still no download_url after retry", metaUrl);
      return;
    }

    // Now fetch the actual binary from the signed CDN URL.
    try {
      const res = await originalFetch(downloadUrl);
      if (!res.ok) {
        log("CDN fetch failed", res.status, downloadUrl);
        return;
      }
      const blob = await res.blob();
      await captureBlob(
        downloadUrl,
        blob,
        res.headers,
        "(via metadata)",
        filename,
      );
    } catch (err) {
      log("CDN fetch error", err, downloadUrl);
    }
  }

  /* ----------------------------- capture --------------------------------- */

  async function captureBlob(url, blob, headers, sourceTag, forcedFilename) {
    if (!(blob instanceof Blob)) return;
    if (blob.size === 0 || blob.size > MAX_CAPTURE_BYTES) {
      log("skipped (size out of range)", blob.size, url);
      return;
    }
    const ct = (blob.type || "").toLowerCase();
    // Skip 0.4KB JSON-looking responses; they're typically metadata.
    if (/json/i.test(ct)) {
      log("skipped (looks like metadata)", `${(blob.size / 1024).toFixed(1)}KB`, url);
      return;
    }
    const filename =
      forcedFilename || extractFilenameFromHeaders(url, headers);
    const dataBase64 = await blobToBase64(blob);
    log(
      "captured",
      sourceTag,
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

  /* ----------------------------- helpers --------------------------------- */

  function urlOf(arg) {
    if (typeof arg === "string") return arg;
    if (arg && typeof arg === "object" && typeof arg.url === "string") {
      return arg.url;
    }
    return "";
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
      console.log("[ChatVault bridge]", ...args);
    } catch {
      /* ignore */
    }
  }
})();
