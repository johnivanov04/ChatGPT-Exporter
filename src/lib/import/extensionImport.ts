import type {
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";

/**
 * Decode and validate a NormalizedConversation handed off via a URL fragment
 * by the browser extension. Returns null when the fragment is missing,
 * malformed, or doesn't look like a conversation.
 *
 * The fragment format is `#import=<base64url(JSON.stringify(conversation))>`.
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
  return validate(parsed);
}

function decodeBase64Url(s: string): string {
  let normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function validate(value: unknown): NormalizedConversation | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  if (typeof o.title !== "string") return null;
  if (!Array.isArray(o.messages)) return null;
  const messages: NormalizedMessage[] = [];
  o.messages.forEach((m, i) => {
    if (!m || typeof m !== "object") return;
    const mo = m as Record<string, unknown>;
    if (typeof mo.content !== "string" || !mo.content.trim()) return;
    messages.push({
      id: typeof mo.id === "string" ? mo.id : `msg-${i}`,
      role: normalizeRole(mo.role),
      content: mo.content,
      createdAt: typeof mo.createdAt === "string" ? mo.createdAt : undefined,
      updatedAt: typeof mo.updatedAt === "string" ? mo.updatedAt : undefined,
      messageIndex: typeof mo.messageIndex === "number" ? mo.messageIndex : i,
      metadata:
        mo.metadata && typeof mo.metadata === "object"
          ? (mo.metadata as Record<string, unknown>)
          : undefined,
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

function normalizeRole(role: unknown): NormalizedMessage["role"] {
  if (typeof role !== "string") return "unknown";
  const r = role.toLowerCase().trim();
  if (r === "user" || r === "assistant" || r === "system" || r === "tool") {
    return r;
  }
  return "unknown";
}

/**
 * Strip the `#import=` fragment from the URL so a refresh doesn't re-trigger
 * the import. Uses replaceState so we don't touch the history stack.
 */
export function clearImportHash(): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", pathname + search);
}
