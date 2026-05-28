import type { NormalizedConversation } from "../../types/conversation";

/** Collapses whitespace and truncates to a single-line preview. */
export function firstUserMessagePreview(
  conversation: NormalizedConversation,
  maxLen = 140,
): string {
  const first =
    conversation.messages.find((m) => m.role === "user") ??
    conversation.messages[0];
  if (!first) return "";
  const text = first.content.replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

/**
 * Sort key for a conversation: updatedAt, then createdAt. Undated
 * conversations sort last (treated as -Infinity).
 */
export function conversationTimestamp(
  conversation: NormalizedConversation,
): number {
  const iso = conversation.updatedAt ?? conversation.createdAt;
  if (!iso) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

export function sortConversationsNewestFirst(
  conversations: NormalizedConversation[],
): NormalizedConversation[] {
  return conversations
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const diff = conversationTimestamp(b.c) - conversationTimestamp(a.c);
      if (diff !== 0 && Number.isFinite(diff)) return diff;
      // Equal or non-finite (both undated): keep original relative order.
      if (conversationTimestamp(b.c) === conversationTimestamp(a.c))
        return a.i - b.i;
      return diff > 0 ? 1 : -1;
    })
    .map(({ c }) => c);
}

/** Lowercased title + all message content, for substring search. */
export function buildSearchText(conversation: NormalizedConversation): string {
  return [conversation.title, ...conversation.messages.map((m) => m.content)]
    .join(" ")
    .toLowerCase();
}

/**
 * Filters by an AND-of-terms substring match over a precomputed search index.
 * `searchIndex` maps conversation id -> lowercased blob (see buildSearchText).
 */
export function filterConversations(
  conversations: NormalizedConversation[],
  query: string,
  searchIndex: Map<string, string>,
): NormalizedConversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return conversations;
  const terms = q.split(/\s+/).filter(Boolean);
  return conversations.filter((c) => {
    const blob = searchIndex.get(c.id) ?? buildSearchText(c);
    return terms.every((t) => blob.includes(t));
  });
}
