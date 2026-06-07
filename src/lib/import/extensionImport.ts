import type {
  NormalizedAttachment,
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";

/**
 * Decode and validate a NormalizedConversation handed off via a URL fragment
 * by the browser extension. Returns null when the fragment is missing,
 * malformed, or doesn't look like a conversation.
 *
 * Fragment format: `#import=<base64url(JSON.stringify(conversation))>`.
 */
export function tryParseImportHash(
  hash: string = typeof window !== "undefined" ? window.location.hash : "",
): NormalizedConversation | null {
  const m = /^#import=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m) return null;
  let decoded: string;
  try {
    decoded = decodeBase64Url(m[1]);
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  return validateImportPayload(parsed);
}

/**
 * Validate an inbound `chatvault:import` postMessage payload from the
 * extension's chrome.storage bridge. The bridge sends the conversation as a
 * structured object, not a string — no base64 dance needed.
 */
export function tryParseImportMessage(
  data: unknown,
): NormalizedConversation | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.type !== "chatvault:import") return null;
  return validateImportPayload(obj.payload);
}

/**
 * Schema-check an unknown value and return a sanitized NormalizedConversation
 * (or null when the shape isn't right). The shape we accept matches what the
 * extension produces; we deliberately drop unknown fields to avoid surprises.
 */
export function validateImportPayload(
  value: unknown,
): NormalizedConversation | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  if (typeof o.title !== "string") return null;
  if (!Array.isArray(o.messages)) return null;

  const messages: NormalizedMessage[] = [];
  o.messages.forEach((m, i) => {
    if (!m || typeof m !== "object") return;
    const mo = m as Record<string, unknown>;
    const hasContent = typeof mo.content === "string" && mo.content.trim();
    const attachments = validateAttachments(mo.attachments);
    // Keep messages that have either non-empty content OR at least one
    // attachment — an upload-only turn still belongs in the transcript.
    if (!hasContent && attachments.length === 0) return;
    messages.push({
      id: typeof mo.id === "string" ? mo.id : `msg-${i}`,
      role: normalizeRole(mo.role),
      content: typeof mo.content === "string" ? mo.content : "",
      createdAt: typeof mo.createdAt === "string" ? mo.createdAt : undefined,
      updatedAt: typeof mo.updatedAt === "string" ? mo.updatedAt : undefined,
      messageIndex: typeof mo.messageIndex === "number" ? mo.messageIndex : i,
      metadata:
        mo.metadata && typeof mo.metadata === "object"
          ? (mo.metadata as Record<string, unknown>)
          : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  });
  if (messages.length === 0) return null;

  return {
    id: o.id,
    title: o.title,
    source: "browser_extension",
    createdAt: typeof o.createdAt === "string" ? o.createdAt : undefined,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
    messages,
    metadata:
      o.metadata && typeof o.metadata === "object"
        ? (o.metadata as Record<string, unknown>)
        : undefined,
  };
}

function decodeBase64Url(s: string): string {
  let normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function validateAttachments(value: unknown): NormalizedAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: NormalizedAttachment[] = [];
  for (const a of value) {
    if (!a || typeof a !== "object") continue;
    const ao = a as Record<string, unknown>;
    if (typeof ao.filename !== "string" || !ao.filename.trim()) continue;
    out.push({
      filename: ao.filename,
      mimeType: typeof ao.mimeType === "string" ? ao.mimeType : undefined,
      size:
        typeof ao.size === "number" && Number.isFinite(ao.size)
          ? ao.size
          : undefined,
      dataBase64:
        typeof ao.dataBase64 === "string" ? ao.dataBase64 : undefined,
      fetchError:
        typeof ao.fetchError === "string" ? ao.fetchError : undefined,
    });
  }
  return out;
}

function normalizeRole(role: unknown): NormalizedMessage["role"] {
  if (typeof role !== "string") return "unknown";
  const r = role.toLowerCase().trim();
  if (r === "user" || r === "assistant" || r === "system" || r === "tool") {
    return r;
  }
  return "unknown";
}

/**
 * Strip the `#import=` or `#from-extension` fragment from the URL so a refresh
 * doesn't re-trigger the import. Uses replaceState so we don't touch history.
 */
export function clearImportHash(): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", pathname + search);
}
