import { useState } from "react";
import { Landing } from "./components/Landing";
import { UploadZip } from "./components/UploadZip";
import { ConversationPicker } from "./components/ConversationPicker";
import { ConversationPreview } from "./components/ConversationPreview";
import { ManualPasteInput } from "./components/ManualPasteInput";
import type { NormalizedConversation } from "./types/conversation";

interface PickerCtx {
  sourceFile: File;
  conversations: NormalizedConversation[];
}

type Stage =
  | { kind: "landing" }
  | { kind: "upload-zip" }
  | { kind: "paste" }
  | ({ kind: "picker" } & PickerCtx)
  | {
      kind: "selected";
      conversation: NormalizedConversation;
      pickerCtx?: PickerCtx;
    };

export default function App() {
  const [stage, setStage] = useState<Stage>({ kind: "landing" });

  const handleBackFromSelected = (pickerCtx?: PickerCtx) => {
    if (pickerCtx) setStage({ kind: "picker", ...pickerCtx });
    else setStage({ kind: "landing" });
  };

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
            onChoosePaste={() => setStage({ kind: "paste" })}
          />
        )}

        {stage.kind === "upload-zip" && (
          <UploadZip
            onLoaded={(sourceFile, conversations) =>
              setStage({ kind: "picker", sourceFile, conversations })
            }
            onCancel={() => setStage({ kind: "landing" })}
          />
        )}

        {stage.kind === "paste" && (
          <ManualPasteInput
            onParsed={(conversation) =>
              setStage({ kind: "selected", conversation })
            }
            onCancel={() => setStage({ kind: "landing" })}
          />
        )}

        {stage.kind === "picker" && (
          <ConversationPicker
            conversations={stage.conversations}
            onSelect={(conversation) =>
              setStage({
                kind: "selected",
                conversation,
                pickerCtx: {
                  sourceFile: stage.sourceFile,
                  conversations: stage.conversations,
                },
              })
            }
            onReset={() => setStage({ kind: "landing" })}
          />
        )}

        {stage.kind === "selected" && (
          <ConversationPreview
            conversation={stage.conversation}
            onBack={() => handleBackFromSelected(stage.pickerCtx)}
          />
        )}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-3 text-xs text-slate-500 flex items-center justify-between gap-4 flex-wrap">
          <span>
            All parsing happens locally in your browser. No uploads, no
            accounts.
          </span>
          <a
            href="https://github.com/johnivanov04/ChatGPT-Exporter"
            target="_blank"
            rel="noreferrer"
            className="text-slate-600 hover:text-slate-900 underline underline-offset-2"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
