import { useState } from "react";
import type { NormalizedConversation } from "./types/conversation";
import { Landing } from "./components/Landing";

type Stage =
  | { kind: "landing" }
  | { kind: "loaded"; conversations: NormalizedConversation[] };

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
            onLoaded={(conversations) =>
              setStage({ kind: "loaded", conversations })
            }
          />
        )}
        {stage.kind === "loaded" && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-700">
              Loaded {stage.conversations.length} conversation
              {stage.conversations.length === 1 ? "" : "s"}. Picker + preview
              coming in the next milestone.
            </p>
            <button
              type="button"
              onClick={() => setStage({ kind: "landing" })}
              className="mt-4 text-sm text-indigo-600 hover:underline"
            >
              Start over
            </button>
          </div>
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
