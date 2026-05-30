import { useMemo, useState } from "react";
import { parseManualPaste } from "../lib/parsers/parseManualPaste";
import type { NormalizedConversation } from "../types/conversation";

interface ManualPasteInputProps {
  onParsed: (conversation: NormalizedConversation) => void;
  onCancel: () => void;
}

const PLACEHOLDER = `Paste your chat transcript here.

A plain Ctrl+A / Cmd+A on the ChatGPT page works: we detect attached file names and "Thought for X" markers to split turns automatically.

Also recognized: User:, [User], Assistant:, [Assistant], ChatGPT:, You said:, ChatGPT said:, Copilot said:, Claude said:, Gemini said:, System:, [System].`;

export function ManualPasteInput({ onParsed, onCancel }: ManualPasteInputProps) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");

  // Live preview: parse on every keystroke so the user sees how their text
  // splits before committing. Cheap since parse is a single pass.
  const preview = useMemo(() => parseManualPaste(text, { title }), [text, title]);

  const roleSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of preview.messages) {
      counts[m.role] = (counts[m.role] ?? 0) + 1;
    }
    return counts;
  }, [preview]);

  const totalMessages = preview.messages.length;
  const canSubmit = totalMessages > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Paste a chat manually
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            A best-effort fallback. We split on common role markers; without
            markers, the whole paste becomes a single unknown-role message.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Back
        </button>
      </div>

      <label className="block">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Title (optional)
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Pasted conversation"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </label>

      <label className="block mt-4">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Transcript
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={16}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </label>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-sm text-slate-600">
          {text.trim() === "" ? (
            <span className="text-slate-400">Waiting for input…</span>
          ) : totalMessages === 0 ? (
            <span className="text-slate-400">No content detected.</span>
          ) : (
            <>
              <span className="font-medium">{totalMessages}</span>{" "}
              message{totalMessages === 1 ? "" : "s"} detected
              {Object.keys(roleSummary).length > 0 && (
                <span className="text-slate-500">
                  {" "}
                  ·{" "}
                  {Object.entries(roleSummary)
                    .map(([r, n]) => `${n} ${r}`)
                    .join(", ")}
                </span>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => canSubmit && onParsed(preview)}
          disabled={!canSubmit}
          className="rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Role detection is best-effort. If your transcript has no markers, we'll
        keep it as one block. You can still preview and export it.
      </p>
    </div>
  );
}
