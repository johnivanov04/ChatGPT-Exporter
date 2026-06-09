import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardPaste, Sparkles } from "lucide-react";
import { parseManualPaste } from "../lib/parsers/parseManualPaste";
import type { NormalizedConversation } from "../types/conversation";

interface ManualPasteInputProps {
  onParsed: (conversation: NormalizedConversation) => void;
  onCancel: () => void;
}

const PLACEHOLDER = `Paste your chat transcript here.

A plain Ctrl+A / Cmd+A on the ChatGPT page works: we detect attached file names and "Thought for X" markers to split turns automatically.

Also recognized: User:, [User], Assistant:, [Assistant], ChatGPT:, You said:, ChatGPT said:, Copilot said:, Claude said:, Gemini said:, System:, [System].`;

export function ManualPasteInput({
  onParsed,
  onCancel,
}: ManualPasteInputProps) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");

  const preview = useMemo(
    () => parseManualPaste(text, { title }),
    [text, title],
  );

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
    <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm shadow-sm p-8">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
            <ClipboardPaste className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Paste a chat manually
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              A best-effort fallback. We try classic role markers first, then a
              heuristic for ChatGPT page-copies; without any signal, the whole
              paste becomes a single message.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition px-2 py-1 rounded-md hover:bg-slate-100 focus-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>

      <label className="block">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
          Title (optional)
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Pasted conversation"
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
      </label>

      <label className="block mt-5">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
          Transcript
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={16}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-[13px] leading-relaxed outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
      </label>

      <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm text-slate-600 inline-flex items-center gap-2">
          {text.trim() === "" ? (
            <span className="text-slate-400">Waiting for input…</span>
          ) : totalMessages === 0 ? (
            <span className="text-slate-400">No content detected.</span>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>
                <span className="font-semibold text-slate-800">
                  {totalMessages}
                </span>{" "}
                message{totalMessages === 1 ? "" : "s"} detected
              </span>
              {Object.keys(roleSummary).length > 0 && (
                <span className="text-slate-500">
                  &middot;{" "}
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
          className="rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 text-white px-4 py-2 text-sm font-medium shadow-sm shadow-amber-500/30 hover:shadow-md hover:shadow-amber-500/40 hover:-translate-y-px transition-all disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 focus-ring"
        >
          Continue &rarr;
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-500 leading-relaxed">
        Role detection is best-effort. If your transcript has no markers, we'll
        keep it as one block &mdash; you can still preview and export it.
      </p>
    </div>
  );
}
