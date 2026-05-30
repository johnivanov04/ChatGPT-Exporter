import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ExportOptions,
  NormalizedConversation,
  NormalizedMessage,
} from "../types/conversation";
import { formatDateTime } from "../lib/utils/date";

interface PrintViewProps {
  conversation: NormalizedConversation;
  options: ExportOptions;
  now?: Date;
}

/**
 * A clean, print-only layout used when the user hits Save as PDF.
 * Lives in the DOM at all times but is hidden on screen via `.print-only`
 * (see index.css). Hidden chrome continues to be marked `.no-print`.
 */
export function PrintView({
  conversation,
  options,
  now = new Date(),
}: PrintViewProps) {
  return (
    <div className="print-only print-root">
      {options.includeMetadataPage && (
        <section className="print-cover">
          <h1>{conversation.title}</h1>
          <dl>
            {conversation.createdAt && (
              <MetaRow label="Created" value={formatDateTime(conversation.createdAt)} />
            )}
            {conversation.updatedAt &&
              conversation.updatedAt !== conversation.createdAt && (
                <MetaRow
                  label="Updated"
                  value={formatDateTime(conversation.updatedAt)}
                />
              )}
            <MetaRow label="Exported" value={formatDateTime(now.toISOString())} />
            <MetaRow label="Messages" value={String(conversation.messages.length)} />
            {options.includeSourceMetadata && (
              <>
                <MetaRow label="Source" value={conversation.source} />
                {typeof conversation.metadata?.model === "string" && (
                  <MetaRow
                    label="Model"
                    value={String(conversation.metadata.model)}
                  />
                )}
              </>
            )}
          </dl>
          <p className="print-disclaimer">
            Exported with ChatGPT Conversation Exporter. Files were processed
            locally in the browser; review the contents before sharing.
          </p>
        </section>
      )}

      <section className="print-transcript">
        {!options.includeMetadataPage && (
          <h1 className="print-transcript-title">{conversation.title}</h1>
        )}
        {conversation.messages.map((m, i) => (
          <PrintMessage
            key={m.id}
            message={m}
            displayIndex={i}
            options={options}
          />
        ))}
      </section>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PrintMessage({
  message,
  displayIndex,
  options,
}: {
  message: NormalizedMessage;
  displayIndex: number;
  options: ExportOptions;
}) {
  const segments: string[] = [];
  if (options.includeMessageNumbers) segments.push(`#${displayIndex + 1}`);
  segments.push(message.role);
  if (options.includeTimestamps && message.createdAt)
    segments.push(formatDateTime(message.createdAt));

  const contentType = (message.metadata?.contentType as string) ?? "text";
  const isCodeBlock =
    contentType === "code" || contentType === "execution_output";

  return (
    <article className={`print-message print-message-${message.role}`}>
      <header className="print-message-header">{segments.join(" · ")}</header>
      <div className="print-message-body">
        {isCodeBlock ? (
          <pre>
            <code>{message.content}</code>
          </pre>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </article>
  );
}
