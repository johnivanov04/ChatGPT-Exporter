import type {
  ChatRole,
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";
import { safeStringify } from "../utils/safeStringify";
import { toIsoString } from "../utils/date";
import { generateId, normalizeRole } from "./normalizeConversation";

/* ----------------------------- raw shapes ----------------------------- */

interface RawClaudeContentBlock {
  type?: string;
  text?: unknown;
  input?: unknown;
  content?: unknown;
  name?: unknown;
  source?: { type?: string; media_type?: string };
}

interface RawClaudeAttachment {
  file_name?: string;
  file_size?: number;
  file_type?: string;
}

interface RawClaudeFile {
  file_name?: string;
  file_kind?: string;
}

interface RawClaudeMessage {
  uuid?: string;
  text?: unknown;
  content?: RawClaudeContentBlock[] | string | null;
  sender?: unknown;
  index?: number;
  created_at?: unknown;
  updated_at?: unknown;
  attachments?: RawClaudeAttachment[];
  files?: RawClaudeFile[];
}

interface RawClaudeConversation {
  uuid?: string;
  name?: unknown;
  summary?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  account?: { uuid?: string };
  chat_messages?: RawClaudeMessage[];
}

/* ------------------------------ helpers ------------------------------- */

function claudeSenderToRole(sender: unknown): ChatRole {
  if (typeof sender !== "string") return "unknown";
  const lower = sender.toLowerCase().trim();
  if (lower === "human" || lower === "user") return "user";
  if (lower === "assistant") return "assistant";
  return normalizeRole(sender);
}

function contentBlockToText(block: RawClaudeContentBlock): string {
  const type = typeof block.type === "string" ? block.type : "text";
  if ((type === "text" || type === "input_text") && typeof block.text === "string")
    return block.text;
  if (type === "image") {
    const media =
      typeof block.source?.media_type === "string"
        ? ` (${block.source.media_type})`
        : "";
    return `[image${media}]`;
  }
  if (type === "tool_use") {
    const name = typeof block.name === "string" ? block.name : "tool";
    return `[tool call: ${name}]`;
  }
  if (type === "tool_result") {
    if (typeof block.content === "string") return block.content;
    if (Array.isArray(block.content)) {
      return (block.content as RawClaudeContentBlock[])
        .map(contentBlockToText)
        .filter(Boolean)
        .join("\n");
    }
    return "";
  }
  if (typeof block.text === "string") return block.text;
  return "";
}

export function extractClaudeMessageContent(message: RawClaudeMessage): string {
  // Preferred: structured content array
  if (Array.isArray(message.content)) {
    return message.content
      .map(contentBlockToText)
      .filter((s) => s.length > 0)
      .join("\n")
      .trim();
  }
  if (typeof message.content === "string") return message.content.trim();
  if (typeof message.text === "string") return message.text.trim();
  if (message.content == null) return "";
  return safeStringify(message.content);
}

/* ------------------------------ public API ---------------------------- */

export function normalizeClaudeConversation(
  raw: RawClaudeConversation,
): NormalizedConversation {
  const title =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : "Untitled conversation";

  const rawMessages = Array.isArray(raw.chat_messages) ? raw.chat_messages : [];
  const messages: NormalizedMessage[] = [];
  for (const rm of rawMessages) {
    const content = extractClaudeMessageContent(rm);
    if (!content.trim()) continue;
    const attachmentNotes: string[] = [];
    for (const a of rm.attachments ?? []) {
      if (typeof a.file_name === "string")
        attachmentNotes.push(`[attached: ${a.file_name}]`);
    }
    for (const f of rm.files ?? []) {
      if (typeof f.file_name === "string")
        attachmentNotes.push(`[attached: ${f.file_name}]`);
    }
    const finalContent =
      attachmentNotes.length > 0
        ? `${attachmentNotes.join("\n")}\n${content}`
        : content;

    messages.push({
      id: rm.uuid ?? generateId("msg"),
      role: claudeSenderToRole(rm.sender),
      content: finalContent,
      createdAt: toIsoString(rm.created_at),
      updatedAt: toIsoString(rm.updated_at),
      messageIndex: messages.length,
      metadata: {
        contentType: "text",
      },
    });
  }

  return {
    id: raw.uuid ?? generateId("conv"),
    title,
    createdAt: toIsoString(raw.created_at),
    updatedAt: toIsoString(raw.updated_at),
    source: "claude_export_zip",
    messages,
    metadata: {
      summary: typeof raw.summary === "string" ? raw.summary : undefined,
    },
  };
}

export function parseClaudeExportJson(
  rawJson: string,
): NormalizedConversation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(
      "Could not parse the Claude export JSON. The file may be corrupted or the format may have changed.",
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
      "The Claude export JSON didn't contain any conversations in a recognizable shape.",
    );
  }

  const result: NormalizedConversation[] = [];
  for (const raw of rawConversations) {
    if (!raw || typeof raw !== "object") continue;
    try {
      result.push(normalizeClaudeConversation(raw as RawClaudeConversation));
    } catch {
      // Skip a single bad conversation rather than failing the batch.
    }
  }
  return result;
}
