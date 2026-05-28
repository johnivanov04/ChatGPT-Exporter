import { useState } from "react";
import { Landing } from "./components/Landing";
import { UploadZip } from "./components/UploadZip";
import type { NormalizedConversation } from "./types/conversation";
import { formatDateShort } from "./lib/utils/date";

type Stage =
  | { kind: "landing" }
  | { kind: "upload-zip" }
  | {
      kind: "loaded";
      sourceFile: File;
      conversations: NormalizedConversation[];
    };

export default function App() {
  const [stage, setStage] = useState<Stage>({ kind: "landing" });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStage({ kind: "landing" })}
            className="text-left"
          >
            <h1 className="text-lg font-semibold text-slate-900">
              ChatGPT Conversation Exporter
            </h1>
            <p className="text-xs text-slate-500">
              Local-first &middot; nothing leaves your browser
            </p>
          </button>
          <span className="text-xs text-slate-400">MVP</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {stage.kind === "landing" && (
          <Landing
            onChooseZip={() => setStage({ kind: "upload-zip" })}
            onChoosePaste={() => {
              /* M8 */
            }}
          />
        )}

        {stage.kind === "upload-zip" && (
          <UploadZip
            onLoaded={(sourceFile, conversations) =>
              setStage({ kind: "loaded", sourceFile, conversations })
            }
            onCancel={() => setStage({ kind: "landing" })}
          />
        )}

        {stage.kind === "loaded" && (
          <ParsedSummary
            conversations={stage.conversations}
            onReset={() => setStage({ kind: "landing" })}
          />
        )}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-3 text-xs text-slate-500">
          All parsing happens locally in your browser. No uploads, no accounts.
        </div>
      </footer>
    </div>
  );
}

function ParsedSummary({
  conversations,
  onReset,
}: {
  conversations: NormalizedConversation[];
  onReset: () => void;
}) {
  const totalMessages = conversations.reduce(
    (sum, c) => sum + c.messages.length,
    0,
  );
  const empty = conversations.filter((c) => c.messages.length === 0).length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8">
      <h2 className="text-xl font-semibold text-slate-900">
        Parsed {conversations.length} conversation
        {conversations.length === 1 ? "" : "s"}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {totalMessages.toLocaleString()} messages total
        {empty > 0 ? ` · ${empty} empty` : ""}. The searchable picker and
        preview arrive in the next milestones — this is a parser sanity check.
      </p>

      <ul className="mt-6 divide-y divide-slate-100 border border-slate-100 rounded-md max-h-[28rem] overflow-auto">
        {conversations.map((c) => (
          <li key={c.id} className="px-4 py-3 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">
                {c.title}
              </p>
              <p className="text-xs text-slate-500">
                {formatDateShort(c.updatedAt ?? c.createdAt) || "no date"}
              </p>
            </div>
            <span
              className={`shrink-0 text-xs px-2 py-0.5 rounded ${
                c.messages.length === 0
                  ? "bg-slate-100 text-slate-400"
                  : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {c.messages.length} msg
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-sm text-indigo-600 hover:underline"
      >
        Start over
      </button>
    </div>
  );
}
