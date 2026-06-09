import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { Landing } from "./components/Landing";
import { UploadZip } from "./components/UploadZip";
import { ConversationPicker } from "./components/ConversationPicker";
import { ConversationPreview } from "./components/ConversationPreview";
import { ManualPasteInput } from "./components/ManualPasteInput";
import type { NormalizedConversation } from "./types/conversation";
import {
  clearImportHash,
  tryParseImportHash,
  tryParseImportMessage,
} from "./lib/import/extensionImport";

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

interface NavState {
  idx: number;
}

function isNavState(s: unknown): s is NavState {
  return (
    typeof s === "object" &&
    s !== null &&
    typeof (s as Record<string, unknown>).idx === "number"
  );
}

const LANDING: Stage = { kind: "landing" };

export default function App() {
  const [stage, setStage] = useState<Stage>(LANDING);

  // In-memory stack of stages the user has visited. Forward navigation pushes
  // onto it (truncating any "future" entries past the cursor). Browser back /
  // forward moves the cursor via the popstate listener — we never drop entries
  // on back, so browser forward also restores correctly.
  const stackRef = useRef<Stage[]>([LANDING]);
  const cursorRef = useRef(0);

  const acceptImport = useCallback((conversation: NormalizedConversation) => {
    clearImportHash();
    stackRef.current = [LANDING, { kind: "selected", conversation }];
    cursorRef.current = 1;
    window.history.replaceState({ idx: 0 } satisfies NavState, "");
    window.history.pushState({ idx: 1 } satisfies NavState, "");
    setStage({ kind: "selected", conversation });
  }, []);

  // Claim ownership of the current history entry on first mount, and pick
  // up a conversation handed off by the browser extension via the URL hash.
  useEffect(() => {
    const imported = tryParseImportHash();
    if (imported) {
      acceptImport(imported);
    } else {
      window.history.replaceState({ idx: 0 } satisfies NavState, "");
    }
  }, [acceptImport]);

  // The bridge content script (extension/content-chatvault.js) posts a
  // `chatvault:import` message after pulling the payload out of
  // chrome.storage. We trust only same-origin messages.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const imported = tryParseImportMessage(e.data);
      if (!imported) return;
      acceptImport(imported);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [acceptImport]);

  // Browser back / forward → look up the target stage in our stack.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const targetIdx = isNavState(e.state) ? e.state.idx : 0;
      cursorRef.current = targetIdx;
      const target = stackRef.current[targetIdx] ?? LANDING;
      setStage(target);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goTo = useCallback((next: Stage) => {
    // Drop any entries past the current cursor (matches browser behavior:
    // navigating forward after a back wipes the "forward" branch).
    stackRef.current = stackRef.current.slice(0, cursorRef.current + 1);
    stackRef.current.push(next);
    cursorRef.current = stackRef.current.length - 1;
    window.history.pushState(
      { idx: cursorRef.current } satisfies NavState,
      "",
    );
    setStage(next);
  }, []);

  const goBack = useCallback(() => {
    if (cursorRef.current > 0) {
      window.history.back(); // triggers popstate -> setStage
    } else {
      setStage(LANDING);
    }
  }, []);

  const goHome = useCallback(() => {
    if (cursorRef.current > 0) {
      // Pop the browser stack back to the original landing entry so browser
      // back/forward stay coherent with the in-app journey.
      window.history.go(-cursorRef.current);
    } else {
      setStage(LANDING);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print sticky top-0 z-30 backdrop-blur-md bg-white/70 border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={goHome}
            className="flex items-center gap-2.5 text-left group focus-ring rounded-md"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30 transition group-hover:shadow-md group-hover:shadow-amber-500/40">
              <Sparkles className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight text-slate-900">
                Chat<span className="brand-gradient">Vault</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Local-first &middot; private by design
              </span>
            </div>
          </button>
          <a
            href="https://github.com/johnivanov04/ChatVault"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition px-2.5 py-1.5 rounded-md hover:bg-slate-100 focus-ring"
          >
            <span className="hidden sm:inline">GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      <main
        key={stage.kind + (stage.kind === "selected" ? `:${stage.conversation.id}` : "")}
        className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 animate-fade-up"
      >
        {stage.kind === "landing" && (
          <Landing
            onChooseZip={() => goTo({ kind: "upload-zip" })}
            onChoosePaste={() => goTo({ kind: "paste" })}
          />
        )}

        {stage.kind === "upload-zip" && (
          <UploadZip
            onLoaded={(sourceFile, conversations) =>
              goTo({ kind: "picker", sourceFile, conversations })
            }
            onCancel={goBack}
          />
        )}

        {stage.kind === "paste" && (
          <ManualPasteInput
            onParsed={(conversation) => goTo({ kind: "selected", conversation })}
            onCancel={goBack}
          />
        )}

        {stage.kind === "picker" && (
          <ConversationPicker
            conversations={stage.conversations}
            onSelect={(conversation) =>
              goTo({
                kind: "selected",
                conversation,
                pickerCtx: {
                  sourceFile: stage.sourceFile,
                  conversations: stage.conversations,
                },
              })
            }
            onReset={goHome}
          />
        )}

        {stage.kind === "selected" && (
          <ConversationPreview
            conversation={stage.conversation}
            onBack={goBack}
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
