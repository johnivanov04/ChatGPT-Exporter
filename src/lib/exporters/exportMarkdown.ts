import type {
  ExportOptions,
  NormalizedConversation,
} from "../../types/conversation";
import { formatDateTime } from "../utils/date";
import { redactConversation } from "../redaction/redactText";

export function exportMarkdown(
  conversation: NormalizedConversation,
  options: ExportOptions,
  now: Date = new Date(),
): string {
  const redacted = redactConversation(conversation, options);
  const lines: string[] = [];

  lines.push(`# ${redacted.title}`, "");

  if (options.includeMetadataPage) {
    if (redacted.createdAt)
      lines.push(`- **Created:** ${formatDateTime(redacted.createdAt)}`);
    if (redacted.updatedAt && redacted.updatedAt !== redacted.createdAt)
      lines.push(`- **Updated:** ${formatDateTime(redacted.updatedAt)}`);
    lines.push(`- **Exported:** ${formatDateTime(now.toISOString())}`);
    lines.push(`- **Messages:** ${redacted.messages.length}`);
    if (options.includeSourceMetadata) {
      lines.push(`- **Source:** ${redacted.source}`);
      const model = redacted.metadata?.model;
      if (typeof model === "string" && model)
        lines.push(`- **Model:** ${model}`);
    }
    lines.push("", "---", "");
  }

  redacted.messages.forEach((m, i) => {
    const segments: string[] = [];
    if (options.includeMessageNumbers) segments.push(`#${i + 1}`);
    segments.push(m.role);
    if (options.includeTimestamps && m.createdAt)
      segments.push(formatDateTime(m.createdAt));
    lines.push(`## ${segments.join(" · ")}`, "");
    lines.push(m.content.trim(), "");
  });

  // Collapse 3+ consecutive blank lines and ensure a single trailing newline.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") + "\n";
}
