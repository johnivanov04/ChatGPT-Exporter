import { useCallback, useRef, useState } from "react";
import {
  ArrowLeft,
  UploadCloud,
  AlertTriangle,
  Loader2,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { loadZip } from "../lib/zip/readZip";
import { locateConversationFile } from "../lib/zip/findConversationFile";
import { parseChatGptExportJson } from "../lib/parsers/parseChatGptExport";
import { parseClaudeExportJson } from "../lib/parsers/parseClaudeExport";
import { parseGeminiActivityJson } from "../lib/parsers/parseGeminiExport";
import type {
  NormalizedConversation,
  Provider,
} from "../types/conversation";
import { HowToExport } from "./HowToExport";

interface UploadZipProps {
  onLoaded: (
    sourceFile: File,
    conversations: NormalizedConversation[],
  ) => void;
  onCancel: () => void;
}

type State =
  | { kind: "idle" }
  | { kind: "confirm-huge"; file: File }
  | { kind: "reading"; filename: string }
  | { kind: "error"; message: string };

const HUGE_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function providerLabel(p: Provider): string {
  return p === "chatgpt" ? "ChatGPT" : p === "claude" ? "Claude" : "Gemini";
}

function parseForProvider(
  provider: Provider,
  rawJson: string,
): NormalizedConversation[] {
  switch (provider) {
    case "chatgpt":
      return parseChatGptExportJson(rawJson);
    case "claude":
      return parseClaudeExportJson(rawJson);
    case "gemini":
      return parseGeminiActivityJson(rawJson);
  }
}

export function UploadZip({ onLoaded, onCancel }: UploadZipProps) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setState({ kind: "reading", filename: file.name });
      await new Promise((r) => setTimeout(r, 0));
      try {
        const zip = await loadZip(file);
        const located = await locateConversationFile(zip);
        if (!located) {
          setState({
            kind: "error",
            message:
              "No conversation data found in this ZIP. We look for ChatGPT (conversations.json), Claude (chat_messages), and Gemini Takeout (My Activity/Gemini Apps/MyActivity.json). The export may not include chat history or the format may have changed.",
          });
          return;
        }
        const conversations = parseForProvider(
          located.provider,
          located.rawJson,
        );
        if (conversations.length === 0) {
          setState({
            kind: "error",
            message: `Found a ${providerLabel(located.provider)} export but couldn't read any conversations from it. The format may have changed.`,
          });
          return;
        }
        onLoaded(file, conversations);
      } catch (err) {
        setState({
          kind: "error",
          message:
            err instanceof Error ? err.message : "Could not read this file.",
        });
      }
    },
    [onLoaded],
  );

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > HUGE_FILE_BYTES) {
        setState({ kind: "confirm-huge", file });
      } else {
        void processFile(file);
      }
    },
    [processFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm shadow-sm p-8">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Upload an export ZIP
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
            We auto-detect <strong>ChatGPT</strong>, <strong>Claude</strong>,
            and <strong>Gemini (Google Takeout)</strong> exports. Drop the ZIP
            in &mdash; we'll show what we found.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition px-2 py-1 rounded-md hover:bg-slate-100 focus-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`group block rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-amber-500 bg-amber-50/70 scale-[1.01]"
            : "border-slate-300 hover:border-amber-400 hover:bg-slate-50/60 bg-white/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <div
          className={`mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl transition ${
            dragOver
              ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30"
              : "bg-slate-100 text-slate-500 group-hover:bg-amber-100 group-hover:text-amber-700"
          }`}
        >
          <UploadCloud className="h-6 w-6" strokeWidth={2} />
        </div>
        <p className="mt-4 text-slate-800 font-medium">
          Drag and drop your <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">.zip</code> here
        </p>
        <p className="mt-1 text-sm text-slate-500">
          or click anywhere in this box to choose a file
        </p>
      </label>

      {state.kind === "confirm-huge" && (
        <div className="mt-6 rounded-xl bg-amber-50/80 border border-amber-200 p-4 text-sm text-amber-900 animate-fade-up">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium">Large file warning</p>
              <p className="mt-1 leading-relaxed">
                <span className="font-mono">{state.file.name}</span> is{" "}
                <span className="font-semibold">{formatMB(state.file.size)}</span>.
                Parsing and PDF export may take a few seconds and use significant
                memory. Everything still runs locally in your browser.
              </p>
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const f = state.file;
                    void processFile(f);
                  }}
                  className="rounded-md bg-amber-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-amber-700 transition focus-ring"
                >
                  Continue anyway
                </button>
                <button
                  type="button"
                  onClick={() => setState({ kind: "idle" })}
                  className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100 transition focus-ring"
                >
                  Pick a different file
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {state.kind === "reading" && (
        <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 flex items-center gap-3 animate-fade-up">
          <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
          <span>
            Reading and parsing{" "}
            <span className="font-mono">{state.filename}</span>&hellip;
          </span>
        </div>
      )}

      {state.kind === "error" && (
        <div className="mt-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-900 animate-fade-up">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1">
              <p className="font-medium">Couldn't process that file</p>
              <p className="mt-1 leading-relaxed">{state.message}</p>
              <button
                type="button"
                onClick={() => setState({ kind: "idle" })}
                className="mt-3 inline-flex items-center gap-1 text-rose-700 hover:text-rose-900 underline underline-offset-2 transition focus-ring"
              >
                Try another file
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        The file never leaves your browser. Read in-memory with JSZip and
        discarded when you close the tab.
      </p>

      <HowToExport />
    </div>
  );
}
