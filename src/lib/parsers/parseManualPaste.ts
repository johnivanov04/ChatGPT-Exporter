import type {
  ChatRole,
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";
import { generateId } from "./normalizeConversation";

/**
 * Line-leading markers recognized by the classic-marker parsing strategy.
 * Includes the spec's classic forms (`User:`, `[User]`, `Assistant:`,
 * `ChatGPT:`, `[Assistant]`) plus the labels that ChatGPT's web UI used to
 * emit (`You said:`, `ChatGPT said:`) and siblings (`Copilot said:`, etc.).
 * Case-insensitive; trailing colon after `[Role]` is optional.
 */
const LINE_MARKERS: ReadonlyArray<[RegExp, ChatRole]> = [
  [/^\s*you said\s*:\s*(.*)$/i, "user"],
  [/^\s*chatgpt said\s*:\s*(.*)$/i, "assistant"],
  [/^\s*copilot said\s*:\s*(.*)$/i, "assistant"],
  [/^\s*claude said\s*:\s*(.*)$/i, "assistant"],
  [/^\s*gemini said\s*:\s*(.*)$/i, "assistant"],
  [/^\s*\[user\]\s*:?\s*(.*)$/i, "user"],
  [/^\s*user\s*:\s*(.*)$/i, "user"],
  [/^\s*\[assistant\]\s*:?\s*(.*)$/i, "assistant"],
  [/^\s*assistant\s*:\s*(.*)$/i, "assistant"],
  [/^\s*chatgpt\s*:\s*(.*)$/i, "assistant"],
  [/^\s*\[system\]\s*:?\s*(.*)$/i, "system"],
  [/^\s*system\s*:\s*(.*)$/i, "system"],
];

interface MarkerMatch {
  role: ChatRole;
  rest: string;
}

function matchMarker(line: string): MarkerMatch | null {
  for (const [re, role] of LINE_MARKERS) {
    const m = re.exec(line);
    if (m) return { role, rest: m[1] };
  }
  return null;
}

interface ParseManualPasteOptions {
  title?: string;
}

export function parseManualPaste(
  rawText: string,
  options: ParseManualPasteOptions = {},
): NormalizedConversation {
  const text = rawText.replace(/\r\n/g, "\n");
  const trimmed = text.trim();
  const title = options.title?.trim() || "Pasted conversation";

  if (!trimmed) return buildConversation([], title);

  // Strategy 1: explicit line-leading role markers (User:, [User], You said:, …)
  const classic = tryClassicMarkerParse(text, title);
  if (classic) return classic;

  // Strategy 2: ChatGPT-style page-copy heuristic (no labels, but attachment
  // filenames and "Thought for X" markers provide structural anchors).
  const pageCopy = tryChatGptPageCopyParse(text, title);
  if (pageCopy) return pageCopy;

  // Strategy 3: nothing recognized — single unknown-role message with all text.
  return buildConversation(
    [
      {
        id: generateId("msg"),
        role: "unknown",
        content: trimmed,
        messageIndex: 0,
      },
    ],
    title,
  );
}

/* ----------------------- Strategy 1: classic markers --------------------- */

function tryClassicMarkerParse(
  text: string,
  title: string,
): NormalizedConversation | null {
  const lines = text.split("\n");
  const groups: Array<{ role: ChatRole; lines: string[] }> = [];
  let current: { role: ChatRole; lines: string[] } | null = null;
  let sawMarker = false;

  for (const line of lines) {
    const m = matchMarker(line);
    if (m) {
      sawMarker = true;
      if (current) groups.push(current);
      current = { role: m.role, lines: m.rest ? [m.rest] : [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) groups.push(current);

  if (!sawMarker) return null;

  const finalized: NormalizedMessage[] = [];
  for (const g of groups) {
    const content = g.lines.join("\n").trim();
    if (!content) continue;
    finalized.push({
      id: generateId("msg"),
      role: g.role,
      content,
      messageIndex: finalized.length,
    });
  }
  return buildConversation(finalized, title);
}

/* ----------------- Strategy 2: ChatGPT page-copy heuristic --------------- */

// Filename patterns: name + supported extension, allowing letters, digits,
// underscores, dashes, dots, spaces, parens, brackets in the basename.
const ATTACHMENT_FILE_RE =
  /^[\w\-. ()[\]]+\.(?:pdf|png|jpe?g|gif|webp|svg|heic|csv|xlsx?|docx?|pptx?|txt|md|markdown|py|js|tsx?|jsx?|json|yaml|yml|html?|css|sql|sh|bash|zip|tar|gz|mp[34]|mov|wav|mp4|m4a|aiff?)$/i;

// One-word ALL CAPS label that ChatGPT places under an attachment thumbnail.
const ATTACHMENT_LABEL_RE =
  /^(PDF|IMAGE|FILE|AUDIO|VIDEO|DOCUMENT|SPREADSHEET|TEXT|CODE|SCREENSHOT)$/;

// "Thought for 1m 21s", "Thought for 32 seconds", "Thought for 7s", etc.
const THOUGHT_LINE_RE =
  /^thought for\s+[0-9][\w\s.,]*$/i;

// "Thinking", "Thinking...", "Thinking…"
const THINKING_LINE_RE = /^thinking[.…]{0,3}$/i;

// Leading "ChatGPT" or "ChatGPT 4" / "GPT-4" header lines
const HEADER_LINE_RE = /^(chatgpt(\s+\d+\S*)?|gpt(-\d+\S*)?)$/i;

function isAttachmentLine(line: string): boolean {
  return ATTACHMENT_FILE_RE.test(line.trim());
}

function isThoughtLine(line: string): boolean {
  const t = line.trim();
  return THOUGHT_LINE_RE.test(t) || THINKING_LINE_RE.test(t);
}

function isHeaderLine(line: string): boolean {
  return HEADER_LINE_RE.test(line.trim());
}

function tryChatGptPageCopyParse(
  text: string,
  title: string,
): NormalizedConversation | null {
  const lines = text.split("\n");

  // Strip leading header + blank lines.
  let start = 0;
  while (
    start < lines.length &&
    (lines[start].trim() === "" || isHeaderLine(lines[start]))
  ) {
    start++;
  }

  // We need at least one structural signal to commit to this strategy.
  // Otherwise it would produce false positives on plain text pastes.
  let hasAttachment = false;
  let hasThought = false;
  for (let i = start; i < lines.length; i++) {
    if (isAttachmentLine(lines[i])) hasAttachment = true;
    if (isThoughtLine(lines[i])) hasThought = true;
    if (hasAttachment && hasThought) break;
  }
  if (!hasAttachment && !hasThought) return null;

  // Split into paragraphs by blank lines.
  const paragraphs: string[][] = [];
  let cur: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      if (cur.length > 0) {
        paragraphs.push(cur);
        cur = [];
      }
    } else {
      cur.push(lines[i]);
    }
  }
  if (cur.length > 0) paragraphs.push(cur);

  if (paragraphs.length === 0) return null;

  // Classify each paragraph and coalesce.
  interface Slot {
    role: ChatRole;
    content: string;
    forceNew: boolean; // true => starts a new message even if adjacent same role
  }
  const slots: Slot[] = [];

  for (const para of paragraphs) {
    const trimmedFirst = para[0].trim();

    // Drop paragraphs that are nothing but a "Thought for X" marker.
    if (para.length === 1 && isThoughtLine(trimmedFirst)) continue;
    if (para.length === 1 && isHeaderLine(trimmedFirst)) continue;

    // If the paragraph contains an attachment line anywhere in it, treat
    // the whole paragraph as a user turn. Format as "[attached: name]" +
    // any remaining text, skipping the attachment "PDF"/"IMAGE" label
    // that ChatGPT places right after the filename.
    const containsAttachment = para.some(isAttachmentLine);
    if (containsAttachment) {
      const formatted: string[] = [];
      for (let i = 0; i < para.length; i++) {
        const ln = para[i].trim();
        if (isAttachmentLine(ln)) {
          formatted.push(`[attached: ${ln}]`);
          // Skip a following bare label line ("PDF", "IMAGE", etc.).
          if (
            i + 1 < para.length &&
            ATTACHMENT_LABEL_RE.test(para[i + 1].trim())
          ) {
            i++;
          }
        } else if (!isThoughtLine(ln) && !isHeaderLine(ln)) {
          formatted.push(para[i]);
        }
      }
      const content = formatted.join("\n").trim();
      if (content) slots.push({ role: "user", content, forceNew: true });
      continue;
    }

    // Otherwise treat the paragraph as part of an assistant turn. Strip
    // any inline Thought / header noise just in case.
    const filtered = para
      .filter((l) => {
        const t = l.trim();
        return !isThoughtLine(t) && !isHeaderLine(t);
      })
      .join("\n")
      .trim();
    if (filtered) {
      slots.push({ role: "assistant", content: filtered, forceNew: false });
    }
  }

  if (slots.length === 0) return null;

  // Coalesce consecutive same-role slots into a single message, unless the
  // slot is `forceNew` (every user paragraph starts its own message — turn
  // boundaries on the user side are explicit because of attachments).
  const finalized: NormalizedMessage[] = [];
  for (const slot of slots) {
    const last = finalized[finalized.length - 1];
    if (last && last.role === slot.role && !slot.forceNew) {
      last.content = `${last.content}\n\n${slot.content}`;
    } else {
      finalized.push({
        id: generateId("msg"),
        role: slot.role,
        content: slot.content,
        messageIndex: finalized.length,
      });
    }
  }

  // Re-index after coalescing.
  finalized.forEach((m, i) => (m.messageIndex = i));

  // If the only thing we detected is a single block (no real split), bail
  // out so the single-unknown fallback can apply.
  if (finalized.length <= 1 && !hasAttachment) return null;

  return buildConversation(finalized, title);
}

/* --------------------------- shared helpers ------------------------------ */

function buildConversation(
  messages: NormalizedMessage[],
  title: string,
): NormalizedConversation {
  return {
    id: generateId("conv"),
    title,
    source: "manual_paste",
    messages,
  };
}
