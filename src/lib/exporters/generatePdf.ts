import type { jsPDF as JsPdf } from "jspdf";
import type {
  ExportOptions,
  NormalizedConversation,
} from "../../types/conversation";
import { sourceLabel } from "../../types/conversation";
import { redactConversation } from "../redaction/redactText";

/**
 * jsPDF (and its transitive html2canvas / DOMPurify) is large (~750KB).
 * Lazy-load it so the cost is only paid when the user actually exports a
 * PDF — most exports are Markdown/JSON.
 */
async function loadJsPdf(): Promise<typeof JsPdf> {
  const mod = await import("jspdf");
  return mod.jsPDF;
}

/**
 * Render the conversation to a real, text-selectable PDF Blob using jsPDF.
 *
 * Replaces the older browser-print path (which left the bytes inside the OS
 * print dialog and couldn't be bundled with attachments). The output is
 * intentionally simpler than the HTML PrintView — no nested lists, no
 * tables — because we want clean page breaks and selectable text rather
 * than a pixel-perfect replica of the HTML.
 */
export async function generatePdf(
  conversation: NormalizedConversation,
  options: ExportOptions,
  now: Date = new Date(),
): Promise<Blob> {
  const JsPdfCtor = await loadJsPdf();
  const redacted = redactConversation(conversation, options);
  const doc = new JsPdfCtor({ unit: "pt", format: "letter" });

  // Layout constants (points; 72pt = 1in).
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 54; // 0.75in
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  const newPage = () => {
    doc.addPage();
    y = margin;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) newPage();
  };

  const writeWrapped = (
    text: string,
    opts: {
      size?: number;
      style?: "normal" | "bold" | "italic" | "bolditalic";
      font?: "helvetica" | "courier" | "times";
      color?: [number, number, number];
      lineHeight?: number;
      after?: number;
    } = {},
  ) => {
    const size = opts.size ?? 10.5;
    const lh = opts.lineHeight ?? size * 1.35;
    const font = opts.font ?? "helvetica";
    const style = opts.style ?? "normal";
    const color = opts.color ?? [17, 24, 39];

    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    for (const line of lines) {
      ensureSpace(lh);
      doc.text(line, margin, y);
      y += lh;
    }
    if (opts.after) y += opts.after;
  };

  /* ----------------------------- cover page ----------------------------- */

  if (options.includeMetadataPage) {
    writeWrapped(redacted.title || "Untitled conversation", {
      size: 22,
      style: "bold",
      color: [15, 23, 42],
      after: 18,
    });

    const metaRows: Array<[string, string]> = [];
    if (redacted.createdAt) metaRows.push(["Created", fmt(redacted.createdAt)]);
    if (redacted.updatedAt) metaRows.push(["Updated", fmt(redacted.updatedAt)]);
    metaRows.push(["Source", sourceLabel(redacted.source)]);
    metaRows.push(["Messages", String(redacted.messages.length)]);
    metaRows.push(["Exported", fmt(now.toISOString())]);

    for (const [k, v] of metaRows) {
      ensureSpace(18);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(k.toUpperCase(), margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(17, 24, 39);
      doc.text(v, margin + 90, y);
      y += 18;
    }

    if (
      options.redactEmails ||
      options.redactPhoneNumbers ||
      options.redactApiKeys
    ) {
      y += 8;
      const applied = [
        options.redactEmails && "emails",
        options.redactPhoneNumbers && "phone numbers",
        options.redactApiKeys && "API keys",
      ]
        .filter(Boolean)
        .join(", ");
      writeWrapped(
        `Redaction applied to ${applied}. Best-effort — review before sharing.`,
        { size: 9, color: [100, 116, 139], style: "italic", after: 4 },
      );
    }

    newPage();
  }

  /* ----------------------------- messages ----------------------------- */

  redacted.messages.forEach((m, i) => {
    if (i > 0) y += 14;

    // Role header: small caps, accented, with optional message number and time.
    const tone = ROLE_TONE[m.role] ?? ROLE_TONE.unknown;
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(tone[0], tone[1], tone[2]);
    let header = m.role.toUpperCase();
    if (options.includeMessageNumbers) header += `   #${i + 1}`;
    doc.text(header, margin, y);

    if (options.includeTimestamps && m.createdAt) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const ts = fmt(m.createdAt);
      const w = doc.getTextWidth(ts);
      doc.text(ts, pageWidth - margin - w, y);
    }
    y += 16;

    // Body. Code-type messages get monospace; everything else gets prose.
    const contentType = (m.metadata?.contentType as string) ?? "text";
    if (contentType === "code" || contentType === "execution_output") {
      renderCodeBlock(doc, m.content, {
        margin,
        contentWidth,
        getY: () => y,
        setY: (v) => (y = v),
        ensureSpace,
        pageHeight,
      });
    } else {
      renderMarkdownLite(m.content, writeWrapped);
    }

    // Attachments line.
    if (m.attachments && m.attachments.length > 0) {
      y += 4;
      const names = m.attachments.map((a) => a.filename).join("  ·  ");
      writeWrapped(`Attachments: ${names}`, {
        size: 9.5,
        style: "italic",
        color: [71, 85, 105],
      });
    }
  });

  return doc.output("blob");
}

/* ----------------------------------------------------------------------- */
/*                                  helpers                                */
/* ----------------------------------------------------------------------- */

const ROLE_TONE: Record<string, [number, number, number]> = {
  user: [67, 56, 202], // indigo-700
  assistant: [4, 120, 87], // emerald-700
  system: [180, 83, 9], // amber-700
  tool: [75, 85, 99], // slate-600
  unknown: [75, 85, 99],
};

function fmt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Render plain markdown-ish text. We do NOT parse markdown structurally —
 * we just route fenced code blocks to monospace boxes and pass everything
 * else through as wrapped paragraphs. Bold/italic inside paragraphs are
 * stripped of their `**`/`*` markers but otherwise preserved as text.
 */
function renderMarkdownLite(
  source: string,
  write: (
    text: string,
    opts?: {
      size?: number;
      style?: "normal" | "bold" | "italic" | "bolditalic";
      font?: "helvetica" | "courier" | "times";
      color?: [number, number, number];
      after?: number;
    },
  ) => void,
): void {
  const blocks = splitMarkdownBlocks(source);
  for (const block of blocks) {
    if (block.kind === "code") {
      // Inline fallback: render fenced code as monospace via writeWrapped.
      write(block.text, {
        font: "courier",
        size: 9.5,
        color: [30, 41, 59],
        after: 4,
      });
    } else {
      const stripped = stripInlineMarkers(block.text).trim();
      if (!stripped) continue;
      const isHeading = /^#{1,6}\s/.test(stripped);
      if (isHeading) {
        const level = stripped.match(/^#+/)?.[0].length ?? 1;
        const txt = stripped.replace(/^#+\s*/, "");
        write(txt, {
          size: Math.max(11, 16 - level * 1.2),
          style: "bold",
          color: [15, 23, 42],
          after: 4,
        });
      } else {
        write(stripped, { size: 10.5, after: 6 });
      }
    }
  }
}

function splitMarkdownBlocks(
  source: string,
): Array<{ kind: "code" | "text"; text: string }> {
  const out: Array<{ kind: "code" | "text"; text: string }> = [];
  const fence = /```[^\n]*\n([\s\S]*?)```/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(source))) {
    if (m.index > lastIdx) {
      out.push({ kind: "text", text: source.slice(lastIdx, m.index) });
    }
    out.push({ kind: "code", text: m[1].replace(/\s+$/, "") });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < source.length) {
    out.push({ kind: "text", text: source.slice(lastIdx) });
  }
  return out;
}

function stripInlineMarkers(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/(?<![*_])\*(?!\*)([^*]+)\*/g, "$1") // italic
    .replace(/_([^_]+)_/g, "$1"); // underscore italic
}

/**
 * Render a code block with a soft background and monospace text. The block
 * paginates manually so the background spans only the actual lines.
 */
function renderCodeBlock(
  doc: JsPdf,
  source: string,
  ctx: {
    margin: number;
    contentWidth: number;
    getY: () => number;
    setY: (v: number) => void;
    ensureSpace: (needed: number) => void;
    pageHeight: number;
  },
): void {
  const { margin, contentWidth, getY, setY, ensureSpace, pageHeight } = ctx;
  doc.setFont("courier", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(source, contentWidth - 16) as string[];
  const lineH = 12;
  const pad = 8;

  let i = 0;
  while (i < lines.length) {
    ensureSpace(lineH + pad);
    const top = getY();
    const remaining = Math.max(
      1,
      Math.floor((pageHeight - margin - top - pad) / lineH),
    );
    const chunk = lines.slice(i, i + remaining);
    const height = chunk.length * lineH + pad;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, top - 2, contentWidth, height, 4, 4, "F");
    doc.setTextColor(15, 23, 42);
    chunk.forEach((line, k) => {
      doc.text(line, margin + 8, top + pad + k * lineH);
    });
    setY(top + height + 4);
    i += remaining;
  }
}
