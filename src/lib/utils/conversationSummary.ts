import type {
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";

/**
 * A message is "internal" when it isn't part of the visible user/assistant
 * dialogue: system prompts, tool messages (thoughts, reasoning recaps,
 * browsing results, execution output), and assistant tool-calls (code-type
 * content from the assistant — not assistant-authored markdown code blocks,
 * which arrive as content_type "text").
 */
export function isInternalMessage(message: NormalizedMessage): boolean {
  if (message.role === "system" || message.role === "tool") return true;
  const ct = message.metadata?.contentType;
  if (message.role === "assistant" && ct === "code") return true;
  return false;
}

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

/**
 * For a given query, find the first message containing one of the query
 * terms and return a windowed snippet of text around the match. Used by
 * the picker to show *where* in the chat the search hit lives.
 *
 * Returns null when the query is empty or no match is found in any
 * message body. (Title-only matches return null — the caller falls back
 * to the standard preview.)
 */
export function findMessageSnippet(
  conversation: NormalizedConversation,
  query: string,
  windowChars = 80,
): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return null;

  for (const message of conversation.messages) {
    const lower = message.content.toLowerCase();
    let earliestIdx = -1;
    let matchedTerm = "";
    for (const t of terms) {
      const idx = lower.indexOf(t);
      if (idx === -1) continue;
      if (earliestIdx === -1 || idx < earliestIdx) {
        earliestIdx = idx;
        matchedTerm = t;
      }
    }
    if (earliestIdx === -1) continue;

    const start = Math.max(0, earliestIdx - windowChars);
    const end = Math.min(
      message.content.length,
      earliestIdx + matchedTerm.length + windowChars,
    );
    let snippet = message.content.slice(start, end).replace(/\s+/g, " ").trim();
    if (start > 0) snippet = "… " + snippet;
    if (end < message.content.length) snippet = snippet + " …";
    return snippet;
  }
  return null;
}

/**
 * Split `text` into alternating non-match / match segments for inline
 * highlight rendering. Each segment is `{ text, match: boolean }`. Used
 * by the picker to wrap query hits in <mark> without dangerouslySet.
 */
export function highlightSegments(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  const q = query.trim().toLowerCase();
  if (!q || !text) return [{ text, match: false }];
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [{ text, match: false }];

  const lower = text.toLowerCase();
  // Build a flat list of [start,end] match ranges, then merge overlaps.
  const ranges: Array<[number, number]> = [];
  for (const t of terms) {
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(t, from);
      if (idx === -1) break;
      ranges.push([idx, idx + t.length]);
      from = idx + t.length;
    }
  }
  if (ranges.length === 0) return [{ text, match: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const top = merged[merged.length - 1];
    const next = ranges[i];
    if (next[0] <= top[1]) top[1] = Math.max(top[1], next[1]);
    else merged.push(next);
  }

  const out: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor) out.push({ text: text.slice(cursor, s), match: false });
    out.push({ text: text.slice(s, e), match: true });
    cursor = e;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), match: false });
  return out;
}
