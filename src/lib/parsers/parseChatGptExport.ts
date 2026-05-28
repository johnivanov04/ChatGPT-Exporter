import type {
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";
import { safeStringify } from "../utils/safeStringify";
import { toIsoString } from "../utils/date";
import {
  generateId,
  normalizeRole,
  sortMessagesByTimeIfComplete,
} from "./normalizeConversation";

/* ----------------------------- raw shapes ----------------------------- */

interface RawAuthor {
  role?: unknown;
  name?: unknown;
}

interface RawContent {
  content_type?: string;
  parts?: unknown[];
  text?: unknown;
  result?: unknown;
  summary?: unknown;
  content?: unknown;
  thoughts?: unknown;
}

interface RawMessage {
  id?: string;
  author?: RawAuthor;
  content?: RawContent | string | null;
  create_time?: unknown;
  update_time?: unknown;
  recipient?: unknown;
  metadata?: Record<string, unknown>;
}

interface RawNode {
  id?: string;
  message?: RawMessage | null;
  parent?: string | null;
  children?: string[];
}

type RawMapping = Record<string, RawNode>;

interface RawConversation {
  id?: string;
  conversation_id?: string;
  title?: unknown;
  create_time?: unknown;
  update_time?: unknown;
  current_node?: string;
  mapping?: RawMapping;
  messages?: unknown;
  default_model_slug?: unknown;
  is_archived?: unknown;
  is_starred?: unknown;
}

/* ------------------------- content extraction -------------------------- */

function partToText(part: unknown): string {
  if (typeof part === "string") return part;
  if (part && typeof part === "object") {
    const p = part as Record<string, unknown>;
    if (p.content_type === "image_asset_pointer") return "[image]";
    if (p.content_type === "audio_transcription" && typeof p.text === "string")
      return p.text;
    if (typeof p.text === "string") return p.text;
    // Unknown structured part: omit rather than dump raw JSON.
    return "";
  }
  return safeStringify(part);
}

/**
 * Turns a raw ChatGPT message into plain text, handling every content type
 * seen in real exports: text, multimodal_text, code, execution_output,
 * thoughts, reasoning_recap, tether_browsing_display. Falls back to
 * content.text / plain string / safe-stringify for anything unexpected.
 */
export function extractMessageContent(message: RawMessage | null): string {
  if (!message) return "";
  const content = message.content;
  if (content == null) return "";
  if (typeof content === "string") return content.trim();
  if (typeof content !== "object") return safeStringify(content);

  const c = content as RawContent;

  if (Array.isArray(c.parts)) {
    return c.parts
      .map(partToText)
      .filter((s) => s.length > 0)
      .join("\n")
      .trim();
  }

  if (typeof c.text === "string") return c.text.trim();

  if (c.content_type === "reasoning_recap" && typeof c.content === "string")
    return c.content.trim();

  if (c.content_type === "thoughts" && Array.isArray(c.thoughts)) {
    return c.thoughts
      .map((t) => {
        if (!t || typeof t !== "object") return "";
        const obj = t as Record<string, unknown>;
        const summary = typeof obj.summary === "string" ? obj.summary : "";
        const chunks = Array.isArray(obj.chunks)
          ? obj.chunks.filter((x) => typeof x === "string").join("\n")
          : "";
        return [summary, chunks].filter(Boolean).join("\n");
      })
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  if (typeof c.result === "string" && c.result.trim()) return c.result.trim();
  if (typeof c.summary === "string" && c.summary.trim())
    return c.summary.trim();

  // Object content we couldn't turn into clean text (e.g. an empty
  // tether_browsing_display, or an unrecognized internal type). Skip it
  // rather than dumping raw JSON into the transcript.
  return "";
}

/* --------------------------- mapping traversal ------------------------- */

/**
 * Returns the ordered list of nodes representing the visible conversation
 * thread. Prefers walking parent links up from current_node (the exact thread
 * ChatGPT displays); falls back to a depth-first walk from the root when
 * current_node is missing.
 */
function orderNodes(mapping: RawMapping, currentNode?: string): RawNode[] {
  if (currentNode && mapping[currentNode]) {
    const chain: RawNode[] = [];
    const seen = new Set<string>();
    let cur: string | null | undefined = currentNode;
    while (cur && mapping[cur] && !seen.has(cur)) {
      seen.add(cur);
      chain.push(mapping[cur]);
      cur = mapping[cur].parent;
    }
    chain.reverse();
    return chain;
  }

  // Fallback: depth-first from root(s), visiting children in order.
  const roots = Object.values(mapping).filter(
    (n) => n.parent == null || !mapping[n.parent as string],
  );
  const ordered: RawNode[] = [];
  const seen = new Set<string>();
  const visit = (node: RawNode | undefined) => {
    if (!node || (node.id && seen.has(node.id))) return;
    if (node.id) seen.add(node.id);
    ordered.push(node);
    for (const childId of node.children ?? []) visit(mapping[childId]);
  };
  for (const root of roots) visit(root);
  return ordered;
}

export function extractMessagesFromMapping(
  mapping: RawMapping,
  currentNode?: string,
): NormalizedMessage[] {
  const nodes = orderNodes(mapping, currentNode);
  const messages: NormalizedMessage[] = [];
  let index = 0;

  for (const node of nodes) {
    const msg = node.message;
    if (!msg) continue;
    const content = extractMessageContent(msg);
    if (!content.trim()) continue;

    const contentType =
      msg.content && typeof msg.content === "object"
        ? (msg.content as RawContent).content_type
        : "text";

    messages.push({
      id: msg.id ?? node.id ?? generateId("msg"),
      role: normalizeRole(msg.author?.role),
      content,
      createdAt: toIsoString(msg.create_time),
      updatedAt: toIsoString(msg.update_time),
      messageIndex: index++,
      metadata: {
        contentType: contentType ?? "text",
        authorName:
          typeof msg.author?.name === "string" ? msg.author.name : undefined,
        recipient: typeof msg.recipient === "string" ? msg.recipient : undefined,
      },
    });
  }

  return sortMessagesByTimeIfComplete(messages);
}

/* ----------------------------- normalizer ------------------------------ */

export function normalizeChatGptConversation(
  raw: RawConversation,
): NormalizedConversation {
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : "Untitled conversation";

  let messages: NormalizedMessage[] = [];
  if (raw.mapping && typeof raw.mapping === "object") {
    messages = extractMessagesFromMapping(raw.mapping, raw.current_node);
  } else if (Array.isArray(raw.messages)) {
    // Tolerate a flat messages array shape (non-standard exports).
    messages = raw.messages
      .map((m, i): NormalizedMessage | null => {
        const rm = m as RawMessage;
        const content = extractMessageContent(rm);
        if (!content.trim()) return null;
        return {
          id: rm.id ?? generateId("msg"),
          role: normalizeRole(rm.author?.role),
          content,
          createdAt: toIsoString(rm.create_time),
          updatedAt: toIsoString(rm.update_time),
          messageIndex: i,
        };
      })
      .filter((m): m is NormalizedMessage => m !== null)
      .map((m, i) => ({ ...m, messageIndex: i }));
  }

  return {
    id: raw.id ?? raw.conversation_id ?? generateId("conv"),
    title,
    createdAt: toIsoString(raw.create_time),
    updatedAt: toIsoString(raw.update_time),
    source: "chatgpt_export_zip",
    messages,
    metadata: {
      model:
        typeof raw.default_model_slug === "string"
          ? raw.default_model_slug
          : undefined,
      isArchived: raw.is_archived === true,
      isStarred: raw.is_starred === true,
    },
  };
}

export function parseChatGptExportJson(
  rawJson: string,
): NormalizedConversation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(
      "Could not parse the export JSON. The file may be corrupted or the format may have changed.",
      { cause: err as Error },
    );
  }

  let rawConversations: unknown[];
  if (Array.isArray(parsed)) {
    rawConversations = parsed;
  } else if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Record<string, unknown>).conversations)
  ) {
    rawConversations = (parsed as Record<string, unknown>)
      .conversations as unknown[];
  } else if (parsed && typeof parsed === "object") {
    rawConversations = [parsed];
  } else {
    throw new Error(
      "The export JSON didn't contain any conversations in a recognizable shape.",
    );
  }

  const result: NormalizedConversation[] = [];
  for (const raw of rawConversations) {
    if (!raw || typeof raw !== "object") continue;
    try {
      result.push(normalizeChatGptConversation(raw as RawConversation));
    } catch {
      // Skip a single malformed conversation rather than failing the batch.
    }
  }
  return result;
}
