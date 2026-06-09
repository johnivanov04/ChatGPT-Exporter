import { useMemo, useState } from "react";
import {
  Search,
  ArrowLeft,
  MessageSquare,
  Calendar,
  Inbox,
} from "lucide-react";
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
    <div className="max-w-4xl mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Choose a conversation
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {conversations.length} parsed &middot; sorted newest first
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="shrink-0 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition px-2 py-1 rounded-md hover:bg-slate-100 focus-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Start over
        </button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or message content…"
          className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-24 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
        {query && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {filtered.length} match{filtered.length === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-12 text-center">
          <Inbox className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            No conversations match &ldquo;{query}&rdquo;
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Try a different word or clear the search.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="group w-full text-left rounded-xl border border-slate-200/80 bg-white p-4 hover:border-amber-300 hover:shadow-md hover:shadow-amber-500/5 hover:-translate-y-0.5 transition-all duration-150 focus-ring"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium text-slate-900 truncate text-[15px]">
                    {c.title}
                  </h3>
                  <MessageCountBadge count={c.messages.length} />
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {dateLabel(c)}
                  </span>
                </div>
                {firstUserMessagePreview(c) && (
                  <p className="mt-2.5 text-sm text-slate-600 line-clamp-2 leading-relaxed">
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

function MessageCountBadge({ count }: { count: number }) {
  const empty = count === 0;
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
        empty
          ? "bg-slate-100 text-slate-400"
          : "bg-amber-50 text-amber-700 border border-amber-100"
      }`}
    >
      <MessageSquare className="h-3 w-3" />
      {count}
    </span>
  );
}

function dateLabel(c: NormalizedConversation): string {
  const updated = formatDateShort(c.updatedAt);
  const created = formatDateShort(c.createdAt);
  if (updated && c.updatedAt !== c.createdAt) return `Updated ${updated}`;
  if (created) return `Created ${created}`;
  if (updated) return `Updated ${updated}`;
  return "No date";
}
