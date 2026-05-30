import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ChatRole,
  ExportOptions,
  NormalizedConversation,
  NormalizedMessage,
} from "../types/conversation";
import { DEFAULT_EXPORT_OPTIONS } from "../types/conversation";
import { formatDateTime } from "../lib/utils/date";
import { isInternalMessage } from "../lib/utils/conversationSummary";
import { ExportOptionsPanel } from "./ExportOptionsPanel";
import { exportMarkdown } from "../lib/exporters/exportMarkdown";
import { exportJson } from "../lib/exporters/exportJson";
import { downloadFile, safeFilename } from "../lib/utils/downloadFile";
import { PrintView } from "./PrintView";
import { printConversation } from "../lib/exporters/printPdf";
import { redactConversation } from "../lib/redaction/redactText";

interface ConversationPreviewProps {
  conversation: NormalizedConversation;
  onBack: () => void;
}

export function ConversationPreview({
  conversation,
  onBack,
}: ConversationPreviewProps) {
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [showInternal, setShowInternal] = useState(false);

  const { visible, internalCount } = useMemo(() => {
    const visible: NormalizedMessage[] = [];
    let internalCount = 0;
    for (const m of conversation.messages) {
      const internal = isInternalMessage(m);
      if (internal) internalCount++;
      if (!internal || showInternal) visible.push(m);
    }
    return { visible, internalCount };
  }, [conversation.messages, showInternal]);

  // Single source of truth: this is what the user sees in the preview AND
  // what every exporter receives. Redaction is applied here so toggling a
  // redaction checkbox immediately shows the redacted text in the preview
  // (WYSIWYG).
  const exportable = useMemo<NormalizedConversation>(
    () => redactConversation({ ...conversation, messages: visible }, options),
    [conversation, visible, options],
  );

  const baseFilename = safeFilename(conversation.title);

  const handleExportMarkdown = () => {
    const md = exportMarkdown(exportable, options);
    downloadFile(`${baseFilename}.md`, md, "text/markdown;charset=utf-8");
  };

  const handleExportJson = () => {
    const json = exportJson(exportable, options);
    downloadFile(`${baseFilename}.json`, json, "application/json;charset=utf-8");
  };

  const handleExportPdf = () => {
    printConversation(baseFilename);
  };

  return (
    <div>
      <div className="no-print flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Back to list
        </button>
        <span className="text-xs text-slate-400">
          {conversation.messages.length} total messages
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-6">
        <article className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <header className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-2xl font-semibold text-slate-900">
              {conversation.title}
            </h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {conversation.createdAt && (
                <span>Created {formatDateTime(conversation.createdAt)}</span>
              )}
              {conversation.updatedAt &&
                conversation.updatedAt !== conversation.createdAt && (
                  <span>Updated {formatDateTime(conversation.updatedAt)}</span>
                )}
              {typeof conversation.metadata?.model === "string" && (
                <span>Model: {String(conversation.metadata.model)}</span>
              )}
            </div>
          </header>

          {exportable.messages.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No messages to show
              {internalCount > 0 &&
                ` (${internalCount} internal hidden — toggle in the side panel)`}
              .
            </div>
          ) : (
            <ol className="divide-y divide-slate-100">
              {exportable.messages.map((m, displayIndex) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  displayIndex={displayIndex}
                  showTimestamps={options.includeTimestamps}
                  showMessageNumbers={options.includeMessageNumbers}
                />
              ))}
            </ol>
          )}
        </article>

        <ExportOptionsPanel
          options={options}
          onChange={setOptions}
          showInternal={showInternal}
          onToggleShowInternal={setShowInternal}
          internalCount={internalCount}
          visibleCount={visible.length}
          onExportMarkdown={handleExportMarkdown}
          onExportJson={handleExportJson}
          onExportPdf={handleExportPdf}
          exportDisabled={visible.length === 0}
        />
      </div>

      <PrintView conversation={exportable} options={options} />
    </div>
  );
}

interface MessageRowProps {
  message: NormalizedMessage;
  displayIndex: number;
  showTimestamps: boolean;
  showMessageNumbers: boolean;
}

function MessageRow({
  message,
  displayIndex,
  showTimestamps,
  showMessageNumbers,
}: MessageRowProps) {
  const tone = roleStyles(message.role);
  const contentType = (message.metadata?.contentType as string) ?? "text";
  const internal = isInternalMessage(message);

  return (
    <li className="px-6 py-5">
      <div className="flex items-center gap-2 mb-2 text-xs">
        <span
          className={`uppercase font-semibold tracking-wide px-2 py-0.5 rounded ${tone.badge}`}
        >
          {message.role}
        </span>
        {internal && (
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            {contentType}
          </span>
        )}
        {showMessageNumbers && (
          <span className="text-slate-400">#{displayIndex + 1}</span>
        )}
        {showTimestamps && message.createdAt && (
          <span className="text-slate-400 ml-auto">
            {formatDateTime(message.createdAt)}
          </span>
        )}
      </div>
      <div
        className={`prose prose-slate max-w-none prose-sm prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-md prose-code:before:hidden prose-code:after:hidden ${tone.body}`}
      >
        {contentType === "code" || contentType === "execution_output" ? (
          <pre className="!bg-slate-900 !text-slate-100 rounded-md p-4 overflow-x-auto text-xs leading-relaxed">
            <code>{message.content}</code>
          </pre>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </li>
  );
}

function roleStyles(role: ChatRole): { badge: string; body: string } {
  switch (role) {
    case "user":
      return {
        badge: "bg-indigo-100 text-indigo-700",
        body: "text-slate-900",
      };
    case "assistant":
      return {
        badge: "bg-emerald-100 text-emerald-700",
        body: "text-slate-800",
      };
    case "system":
      return {
        badge: "bg-amber-100 text-amber-800",
        body: "text-slate-600 italic",
      };
    case "tool":
      return {
        badge: "bg-slate-200 text-slate-700",
        body: "text-slate-600",
      };
    default:
      return {
        badge: "bg-slate-100 text-slate-500",
        body: "text-slate-600",
      };
  }
}
