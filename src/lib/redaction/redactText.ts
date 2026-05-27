import type {
  ExportOptions,
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g;
const API_KEY_RE =
  /\b(?:sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,})\b/g;

export function redactText(input: string, options: ExportOptions): string {
  let text = input;
  if (options.redactEmails) text = text.replace(EMAIL_RE, "[REDACTED_EMAIL]");
  if (options.redactApiKeys)
    text = text.replace(API_KEY_RE, "[REDACTED_API_KEY]");
  if (options.redactPhoneNumbers)
    text = text.replace(PHONE_RE, (match) =>
      match.replace(/\d/g, "").length >= 4 ? match : "[REDACTED_PHONE]",
    );
  return text;
}

export function redactConversation(
  conversation: NormalizedConversation,
  options: ExportOptions,
): NormalizedConversation {
  const anyRedaction =
    options.redactEmails ||
    options.redactPhoneNumbers ||
    options.redactApiKeys;
  if (!anyRedaction) return conversation;
  const messages: NormalizedMessage[] = conversation.messages.map((m) => ({
    ...m,
    content: redactText(m.content, options),
  }));
  return { ...conversation, messages };
}
