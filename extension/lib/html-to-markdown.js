// Shared HTML → markdown-ish text walker, used by both the ChatGPT and Claude
// content scripts. Defines `window.__chatvaultHtmlToMarkdown(node)` as a
// global so manifest-loaded content scripts can use it without ES modules.

(function () {
  if (typeof window === "undefined") return;
  if (window.__chatvaultHtmlToMarkdown) return; // idempotent

  function htmlToMarkdown(node) {
    if (!node) return "";
    const out = [];
    walk(node, out);
    return out.join("").replace(/\n{3,}/g, "\n\n").trim();
  }

  function walk(node, out) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(node.textContent || "");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();

    // Skip UI chrome that shouldn't leak into the export.
    if (
      tag === "button" ||
      node.getAttribute("role") === "button" ||
      (node.classList && node.classList.contains("sr-only"))
    ) {
      return;
    }

    switch (tag) {
      case "pre": {
        const code = node.querySelector("code");
        const lang = code ? langFromClass(code.className) : "";
        const body = (code ? code.textContent : node.textContent) || "";
        out.push(`\n\n\`\`\`${lang}\n${body.replace(/\n+$/, "")}\n\`\`\`\n\n`);
        return;
      }
      case "code":
        out.push("`");
        out.push(node.textContent || "");
        out.push("`");
        return;
      case "br":
        out.push("\n");
        return;
      case "strong":
      case "b":
        out.push("**");
        for (const c of node.childNodes) walk(c, out);
        out.push("**");
        return;
      case "em":
      case "i":
        out.push("*");
        for (const c of node.childNodes) walk(c, out);
        out.push("*");
        return;
      case "a": {
        out.push("[");
        for (const c of node.childNodes) walk(c, out);
        const href = node.getAttribute("href") || "";
        out.push(`](${href})`);
        return;
      }
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = "#".repeat(Number(tag[1]));
        out.push(`\n\n${level} `);
        for (const c of node.childNodes) walk(c, out);
        out.push("\n\n");
        return;
      }
      case "ul":
      case "ol": {
        let idx = 0;
        for (const child of node.children) {
          if (child.tagName.toLowerCase() !== "li") continue;
          idx++;
          const marker = tag === "ol" ? `${idx}. ` : "- ";
          out.push("\n" + marker);
          for (const c of child.childNodes) walk(c, out);
        }
        out.push("\n");
        return;
      }
      case "blockquote":
        out.push("\n> ");
        for (const c of node.childNodes) walk(c, out);
        out.push("\n");
        return;
      case "p":
      case "div":
        for (const c of node.childNodes) walk(c, out);
        out.push("\n\n");
        return;
      case "table": {
        out.push("\n");
        const rows = node.querySelectorAll("tr");
        rows.forEach((row, rowIdx) => {
          const cells = row.querySelectorAll("th,td");
          out.push("| ");
          cells.forEach((c, i) => {
            out.push((c.textContent || "").trim().replace(/\|/g, "\\|"));
            if (i < cells.length - 1) out.push(" | ");
          });
          out.push(" |\n");
          if (rowIdx === 0) {
            out.push("| ");
            cells.forEach((_, i) => {
              out.push("---");
              if (i < cells.length - 1) out.push(" | ");
            });
            out.push(" |\n");
          }
        });
        out.push("\n");
        return;
      }
      case "img": {
        const alt = node.getAttribute("alt") || "image";
        out.push(`[${alt}]`);
        return;
      }
      default:
        for (const c of node.childNodes) walk(c, out);
    }
  }

  function langFromClass(className) {
    const m = /language-([\w+#-]+)/.exec(className || "");
    return m ? m[1] : "";
  }

  window.__chatvaultHtmlToMarkdown = htmlToMarkdown;
})();
