import type {
  ExportOptions,
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";
import { redactConversation } from "../redaction/redactText";

export interface JsonExportEnvelope {
  exporter: { name: string; version: string };
  exportedAt: string;
  conversation: Partial<NormalizedConversation>;
}

export const EXPORTER_NAME = "chatvault";
export const EXPORTER_VERSION = "0.1.0";

export function exportJson(
  conversation: NormalizedConversation,
  options: ExportOptions,
  now: Date = new Date(),
): string {
  const redacted = redactConversation(conversation, options);
  const trimmed = trimConversation(redacted, options);

  if (options.includeMetadataPage) {
    const envelope: JsonExportEnvelope = {
      exporter: { name: EXPORTER_NAME, version: EXPORTER_VERSION },
      exportedAt: now.toISOString(),
      conversation: trimmed,
    };
    return JSON.stringify(envelope, null, 2) + "\n";
  }
  return JSON.stringify(trimmed, null, 2) + "\n";
}

function trimConversation(
  c: NormalizedConversation,
  options: ExportOptions,
): Partial<NormalizedConversation> {
  const messages: Partial<NormalizedMessage>[] = c.messages.map((m) => {
    const out: Partial<NormalizedMessage> = {
      id: m.id,
      role: m.role,
      content: m.content,
      messageIndex: m.messageIndex,
    };
    if (options.includeTimestamps) {
      if (m.createdAt) out.createdAt = m.createdAt;
      if (m.updatedAt) out.updatedAt = m.updatedAt;
    }
    if (options.includeSourceMetadata && m.metadata) out.metadata = m.metadata;
    return out;
  });

  const out: Partial<NormalizedConversation> = {
    id: c.id,
    title: c.title,
    source: c.source,
    messages: messages as NormalizedMessage[],
  };
  if (options.includeTimestamps) {
    if (c.createdAt) out.createdAt = c.createdAt;
    if (c.updatedAt) out.updatedAt = c.updatedAt;
  }
  if (options.includeSourceMetadata && c.metadata) out.metadata = c.metadata;
  return out;
}
