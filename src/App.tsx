import { useState } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
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
      <header className="no-print sticky top-0 z-30 backdrop-blur-md bg-white/70 border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStage({ kind: "landing" })}
            className="flex items-center gap-2.5 text-left group focus-ring rounded-md"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm shadow-violet-500/30 transition group-hover:shadow-md group-hover:shadow-violet-500/40">
              <Sparkles className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight text-slate-900">
                Conversation <span className="brand-gradient">Exporter</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Local-first &middot; private by design
              </span>
            </div>
          </button>
          <a
            href="https://github.com/johnivanov04/ChatGPT-Exporter"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition px-2.5 py-1.5 rounded-md hover:bg-slate-100 focus-ring"
          >
            <span className="hidden sm:inline">GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 animate-fade-up">
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

      <footer className="no-print mt-12">
        <div className="max-w-6xl mx-auto px-6 py-5 text-xs text-slate-500 flex items-center justify-between gap-4 flex-wrap border-t border-slate-200/60">
          <span>
            All parsing happens locally in your browser. No uploads, no
            accounts, no tracking.
          </span>
          <span className="text-slate-400">v0.1.0</span>
        </div>
      </footer>
    </div>
  );
}
