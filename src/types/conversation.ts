export type ChatRole = "user" | "assistant" | "system" | "tool" | "unknown";

export interface NormalizedAttachment {
  /** Filename as it appears in the source UI (e.g. "EE_CS_148B_HW4.pdf"). */
  filename: string;
  /** Best-effort MIME type. */
  mimeType?: string;
  /** Size in bytes when known. */
  size?: number;
  /** Base64-encoded binary content. Absent when the binary couldn't be fetched. */
  dataBase64?: string;
  /** Human-readable reason the binary fetch failed, when applicable. */
  fetchError?: string;
}

export interface NormalizedMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  messageIndex: number;
  metadata?: Record<string, unknown>;
  attachments?: NormalizedAttachment[];
}

export type ConversationSource =
  | "chatgpt_export_zip"
  | "claude_export_zip"
  | "gemini_takeout"
  | "manual_paste"
  | "browser_extension"
  | "sample";

export type Provider = "chatgpt" | "claude" | "gemini";

export function sourceLabel(source: ConversationSource): string {
  switch (source) {
    case "chatgpt_export_zip":
      return "ChatGPT export";
    case "claude_export_zip":
      return "Claude export";
    case "gemini_takeout":
      return "Gemini (Takeout)";
    case "manual_paste":
      return "Manual paste";
    case "browser_extension":
      return "Browser extension";
    case "sample":
      return "Sample conversation";
  }
}

export interface NormalizedConversation {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  source: ConversationSource;
  messages: NormalizedMessage[];
  metadata?: Record<string, unknown>;
}

export interface ExportOptions {
  includeMetadataPage: boolean;
  includeTimestamps: boolean;
  includeMessageNumbers: boolean;
  includeSourceMetadata: boolean;
  redactEmails: boolean;
  redactPhoneNumbers: boolean;
  redactApiKeys: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeMetadataPage: true,
  includeTimestamps: true,
  includeMessageNumbers: true,
  includeSourceMetadata: true,
  redactEmails: false,
  redactPhoneNumbers: false,
  redactApiKeys: false,
};
