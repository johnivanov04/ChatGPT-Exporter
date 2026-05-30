import { useCallback, useRef, useState } from "react";
import { loadZip } from "../lib/zip/readZip";
import { locateConversationFile } from "../lib/zip/findConversationFile";
import { parseChatGptExportJson } from "../lib/parsers/parseChatGptExport";
import type { NormalizedConversation } from "../types/conversation";

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

export function UploadZip({ onLoaded, onCancel }: UploadZipProps) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setState({ kind: "reading", filename: file.name });
      // Yield so the "reading" state paints before heavy parsing work.
      await new Promise((r) => setTimeout(r, 0));
      try {
        const zip = await loadZip(file);
        const located = await locateConversationFile(zip);
        if (!located) {
          setState({
            kind: "error",
            message:
              "No conversation data found in this ZIP. The export may not include chat history, or ChatGPT's export format may have changed.",
          });
          return;
        }
        const conversations = parseChatGptExportJson(located.rawJson);
        if (conversations.length === 0) {
          setState({
            kind: "error",
            message:
              "Found the conversation file but couldn't read any conversations from it. The export format may have changed.",
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
    <div className="rounded-lg border border-slate-200 bg-white p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Upload ChatGPT Export ZIP
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Get this from ChatGPT &rarr; Settings &rarr; Data Controls &rarr;
            Export data. The ZIP contains <em>all</em> your chats; you'll pick
            one to export in the next step.
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

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`block rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition ${
          dragOver
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-300 hover:border-slate-400 bg-slate-50"
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
        <p className="text-slate-700 font-medium">
          Drag and drop your <code>.zip</code> here
        </p>
        <p className="mt-1 text-sm text-slate-500">or click to choose a file</p>
      </label>

      {state.kind === "confirm-huge" && (
        <div className="mt-6 rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          <p className="font-medium">Large file warning</p>
          <p className="mt-1">
            <span className="font-mono">{state.file.name}</span> is{" "}
            {formatMB(state.file.size)}. Parsing and PDF export may take a few
            seconds and use significant memory. Everything still runs locally
            in your browser.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const f = state.file;
                void processFile(f);
              }}
              className="rounded-md bg-amber-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-amber-700"
            >
              Continue anyway
            </button>
            <button
              type="button"
              onClick={() => setState({ kind: "idle" })}
              className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100"
            >
              Pick a different file
            </button>
          </div>
        </div>
      )}

      {state.kind === "reading" && (
        <div className="mt-6 rounded-md bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin"
          />
          <span>
            Reading and parsing{" "}
            <span className="font-mono">{state.filename}</span>&hellip;
          </span>
        </div>
      )}

      {state.kind === "error" && (
        <div className="mt-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <p className="font-medium">Couldn't process that file</p>
          <p className="mt-1">{state.message}</p>
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="mt-3 text-red-700 underline"
          >
            Try another file
          </button>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        The file never leaves your browser. We read it in-memory with JSZip and
        discard it when you close the tab.
      </p>
    </div>
  );
}
