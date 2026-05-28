import type { ChatRole, NormalizedMessage } from "../../types/conversation";

const KNOWN_ROLES: ReadonlySet<string> = new Set([
  "user",
  "assistant",
  "system",
  "tool",
]);

export function normalizeRole(raw: unknown): ChatRole {
  if (typeof raw !== "string") return "unknown";
  const lower = raw.toLowerCase().trim();
  if (KNOWN_ROLES.has(lower)) return lower as ChatRole;
  return "unknown";
}

let counter = 0;
export function generateId(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/**
 * Stable-sorts messages by createdAt only when every message has a timestamp.
 * Otherwise the original traversal order is preserved (the design doc's
 * "fall back to traversal/order" rule), since partial timestamps would
 * scramble an otherwise-correct thread order.
 */
export function sortMessagesByTimeIfComplete(
  messages: NormalizedMessage[],
): NormalizedMessage[] {
  if (messages.length === 0) return messages;
  const allTimed = messages.every((m) => typeof m.createdAt === "string");
  if (!allTimed) return messages;
  return [...messages]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const ta = Date.parse(a.m.createdAt as string);
      const tb = Date.parse(b.m.createdAt as string);
      if (ta === tb) return a.i - b.i;
      return ta - tb;
    })
    .map(({ m }) => m);
}
