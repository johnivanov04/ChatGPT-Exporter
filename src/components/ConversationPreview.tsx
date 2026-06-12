import { memo, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  User,
  Bot,
  Settings,
  Wrench,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
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
import { generatePdf } from "../lib/exporters/generatePdf";
import { redactConversation } from "../lib/redaction/redactText";
import {
  buildAttachmentsOnlyZip,
  buildJsonZip,
  buildMarkdownZip,
  buildPdfZip,
  hasDownloadableAttachments,
  summarizeAttachments,
} from "../lib/exporters/buildExportZip";
import { AttachmentChip } from "./AttachmentChip";

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

  const exportable = useMemo<NormalizedConversation>(
    () => redactConversation({ ...conversation, messages: visible }, options),
    [conversation, visible, options],
  );

  const baseFilename = safeFilename(conversation.title);
  const hasAttachments = useMemo(
    () => hasDownloadableAttachments(exportable),
    [exportable],
  );
  const attachmentSummary = useMemo(
    () => summarizeAttachments(exportable),
    [exportable],
  );

  const handleExportMarkdown = async () => {
    if (hasAttachments) {
      const blob = await buildMarkdownZip(exportable, options, baseFilename);
      downloadFile(`${baseFilename}.zip`, blob, "application/zip");
    } else {
      const md = exportMarkdown(exportable, options);
      downloadFile(`${baseFilename}.md`, md, "text/markdown;charset=utf-8");
    }
  };

  const handleExportJson = async () => {
    if (hasAttachments) {
      const blob = await buildJsonZip(exportable, options, baseFilename);
      downloadFile(`${baseFilename}.zip`, blob, "application/zip");
    } else {
      const json = exportJson(exportable, options);
      downloadFile(
        `${baseFilename}.json`,
        json,
        "application/json;charset=utf-8",
      );
    }
  };

  const handleExportPdf = async () => {
    if (hasAttachments) {
      const blob = await buildPdfZip(exportable, options, baseFilename);
      downloadFile(`${baseFilename}.zip`, blob, "application/zip");
    } else {
      const pdf = await generatePdf(exportable, options);
      downloadFile(`${baseFilename}.pdf`, pdf, "application/pdf");
    }
  };

  const handleExportAttachmentsZip = async () => {
    const blob = await buildAttachmentsOnlyZip(exportable, options);
    downloadFile(
      `${baseFilename}-attachments.zip`,
      blob,
      "application/zip",
    );
  };

  return (
    <div>
      <div className="no-print flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100 transition px-2 py-1 rounded-md hover:bg-slate-800 focus-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to list
        </button>
        <span className="text-xs text-slate-400">
          <span className="font-semibold text-slate-200">
            {conversation.messages.length}
          </span>{" "}
          total messages
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_19rem] gap-6">
        <article className="rounded-2xl border border-slate-700/80 bg-slate-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
          <header className="border-b border-slate-800 px-7 py-6 bg-gradient-to-r from-slate-50/80 to-transparent">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100 leading-tight">
              {conversation.title}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              {conversation.createdAt && (
                <span>Created {formatDateTime(conversation.createdAt)}</span>
              )}
              {conversation.updatedAt &&
                conversation.updatedAt !== conversation.createdAt && (
                  <span>Updated {formatDateTime(conversation.updatedAt)}</span>
                )}
              {typeof conversation.metadata?.model === "string" && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-amber-500" />
                  {String(conversation.metadata.model)}
                </span>
              )}
            </div>
          </header>

          {exportable.messages.length === 0 ? (
            <div className="px-7 py-16 text-center text-sm text-slate-400">
              <p>
                No messages to show
                {internalCount > 0 &&
                  ` (${internalCount} internal hidden — toggle in the side panel)`}
                .
              </p>
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
          visibleCount={exportable.messages.length}
          onExportMarkdown={handleExportMarkdown}
          onExportJson={handleExportJson}
          onExportPdf={handleExportPdf}
          onExportAttachmentsZip={
            hasAttachments ? handleExportAttachmentsZip : undefined
          }
          attachmentSummary={attachmentSummary}
          exportDisabled={exportable.messages.length === 0}
        />
      </div>
    </div>
  );
}

/* ----------------------------- message row ----------------------------- */

interface MessageRowProps {
  message: NormalizedMessage;
  displayIndex: number;
  showTimestamps: boolean;
  showMessageNumbers: boolean;
}

// Memoized so toggling export/redaction options in the side panel doesn't
// reparse the markdown of every message. Markdown rendering dominates the
// render budget for long chats.
const MessageRow = memo(function MessageRow({
  message,
  displayIndex,
  showTimestamps,
  showMessageNumbers,
}: MessageRowProps) {
  const tone = roleStyles(message.role);
  const Icon = tone.icon;
  const contentType = (message.metadata?.contentType as string) ?? "text";
  const internal = isInternalMessage(message);

  return (
    // content-visibility:auto lets the browser skip rendering work for
    // off-screen rows; contain-intrinsic-size gives it a reasonable
    // estimate so the scrollbar doesn't jump.
    <li
      className={`px-7 py-5 border-l-2 ${tone.leftBorder}`}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "1px 280px",
      }}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${tone.avatar}`}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
        <span
          className={`text-[10.5px] uppercase font-semibold tracking-wider ${tone.label}`}
        >
          {message.role}
        </span>
        {internal && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
            {contentType}
          </span>
        )}
        {showMessageNumbers && (
          <span className="text-[11px] text-slate-500 font-mono">
            #{displayIndex + 1}
          </span>
        )}
        {showTimestamps && message.createdAt && (
          <span className="text-[11px] text-slate-500 ml-auto">
            {formatDateTime(message.createdAt)}
          </span>
        )}
      </div>
      <div
        className={`prose prose-invert max-w-none prose-sm prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg prose-code:before:hidden prose-code:after:hidden prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline ${tone.body}`}
      >
        {contentType === "code" || contentType === "execution_output" ? (
          <pre className="!bg-slate-900 !text-slate-100 rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">
            <code>{message.content}</code>
          </pre>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>
      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {message.attachments.map((a, i) => (
            <AttachmentChip key={`${a.filename}-${i}`} attachment={a} />
          ))}
        </div>
      )}
    </li>
  );
});

/* ------------------------------- role tones ----------------------------- */

interface Tone {
  icon: LucideIcon;
  avatar: string;
  label: string;
  body: string;
  leftBorder: string;
}

function roleStyles(role: ChatRole): Tone {
  switch (role) {
    case "user":
      return {
        icon: User,
        avatar:
          "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30",
        label: "text-amber-300",
        body: "text-slate-100",
        leftBorder: "border-l-amber-500/70",
      };
    case "assistant":
      return {
        icon: Bot,
        avatar: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        label: "text-emerald-700",
        body: "text-slate-100",
        leftBorder: "border-l-emerald-400/60",
      };
    case "system":
      return {
        icon: Settings,
        avatar: "bg-amber-500/15 text-amber-300 border border-amber-500/40",
        label: "text-amber-300",
        body: "text-slate-200 italic",
        leftBorder: "border-l-amber-400/60",
      };
    case "tool":
      return {
        icon: Wrench,
        avatar: "bg-slate-800 text-slate-300 border border-slate-700",
        label: "text-slate-300",
        body: "text-slate-200",
        leftBorder: "border-l-slate-300",
      };
    default:
      return {
        icon: HelpCircle,
        avatar: "bg-slate-800 text-slate-400 border border-slate-700",
        label: "text-slate-400",
        body: "text-slate-200",
        leftBorder: "border-l-slate-200",
      };
  }
}
