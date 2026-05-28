import { useMemo, useState } from "react";
import type { NormalizedConversation } from "../types/conversation";
import { formatDateShort } from "../lib/utils/date";
import {
  buildSearchText,
  filterConversations,
  firstUserMessagePreview,
  sortConversationsNewestFirst,
} from "../lib/utils/conversationSummary";

interface ConversationPickerProps {
  conversations: NormalizedConversation[];
  onSelect: (conversation: NormalizedConversation) => void;
  onReset: () => void;
}

export function ConversationPicker({
  conversations,
  onSelect,
  onReset,
}: ConversationPickerProps) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => sortConversationsNewestFirst(conversations),
    [conversations],
  );

  const searchIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) map.set(c.id, buildSearchText(c));
    return map;
  }, [conversations]);

  const filtered = useMemo(
    () => filterConversations(sorted, query, searchIndex),
    [sorted, query, searchIndex],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Choose a conversation
          </h2>
          <p className="text-sm text-slate-600">
            {conversations.length} parsed &middot; sorted newest first
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Start over
        </button>
      </div>

      <div className="relative mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or message content…"
          className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        {query && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {filtered.length} match{filtered.length === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No conversations match “{query}”.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="w-full text-left rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium text-slate-900 truncate">
                    {c.title}
                  </h3>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded ${
                      c.messages.length === 0
                        ? "bg-slate-100 text-slate-400"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {c.messages.length} msg
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {dateLabel(c)}
                </p>
                {firstUserMessagePreview(c) && (
                  <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                    {firstUserMessagePreview(c)}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function dateLabel(c: NormalizedConversation): string {
  const updated = formatDateShort(c.updatedAt);
  const created = formatDateShort(c.createdAt);
  if (updated && c.updatedAt !== c.createdAt) return `Updated ${updated}`;
  if (created) return `Created ${created}`;
  if (updated) return `Updated ${updated}`;
  return "No date available";
}
