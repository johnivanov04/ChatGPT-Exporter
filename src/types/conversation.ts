export type ChatRole = "user" | "assistant" | "system" | "tool" | "unknown";

export interface NormalizedMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  messageIndex: number;
  metadata?: Record<string, unknown>;
}

export type ConversationSource =
  | "chatgpt_export_zip"
  | "manual_paste"
  | "browser_extension";

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
