import { useState } from "react";
import { Landing } from "./components/Landing";
import { UploadZip } from "./components/UploadZip";
import type { LocatedConversationFile } from "./lib/zip/findConversationFile";

type Stage =
  | { kind: "landing" }
  | { kind: "upload-zip" }
  | {
      kind: "zip-located";
      sourceFile: File;
      located: LocatedConversationFile;
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
            onLocated={(sourceFile, located) =>
              setStage({ kind: "zip-located", sourceFile, located })
            }
            onCancel={() => setStage({ kind: "landing" })}
          />
        )}

        {stage.kind === "zip-located" && (
          <ZipLocatedPreview
            sourceFile={stage.sourceFile}
            located={stage.located}
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

function ZipLocatedPreview({
  sourceFile,
  located,
  onReset,
}: {
  sourceFile: File;
  located: LocatedConversationFile;
  onReset: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8">
      <h2 className="text-xl font-semibold text-slate-900">ZIP read OK</h2>
      <p className="mt-2 text-sm text-slate-600">
        Conversations will appear in M3 once the parser is wired up. For now
        you can verify the file was extracted and located correctly.
      </p>
      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Source file" value={sourceFile.name} mono />
        <Field
          label="Size"
          value={`${(sourceFile.size / 1024 / 1024).toFixed(2)} MB`}
        />
        <Field label="Conversation file" value={located.filename} mono />
        <Field
          label="Top-level entries"
          value={String(located.topLevelCount)}
        />
        <Field
          label="Raw JSON size"
          value={`${(located.rawJson.length / 1024).toFixed(1)} KB`}
        />
      </dl>
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

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-slate-800 ${mono ? "font-mono text-xs break-all" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
