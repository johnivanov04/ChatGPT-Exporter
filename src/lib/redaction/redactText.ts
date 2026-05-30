import type {
  ExportOptions,
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/**
 * Phone-number patterns, format-by-format. Each alternative is purposefully
 * narrow so we redact real-looking phone numbers without sweeping up dates
 * ("2026-05-28"), IP addresses ("192.168.0.1"), version strings ("v1.2.3"),
 * or credit-card-shaped sequences.
 */
const PHONE_RE = new RegExp(
  [
    // International with leading + and country code, optionally parenthesised
    // area code. Examples: "+1 555 123 4567", "+1-555-123-4567",
    // "+44 20 7946 0958", "+44-7777-123456".
    String.raw`\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}(?:[\s.-]?\d{1,4})?`,
    // North-American with parens. "(555) 123-4567", "(800)555-1234".
    String.raw`\(\d{3}\)\s?\d{3}[\s.-]?\d{4}`,
    // 1-prefixed toll-free / long-distance. "1-800-555-1234".
    String.raw`\b1[\s.-]\d{3}[\s.-]\d{3}[\s.-]\d{4}\b`,
    // Plain 3-3-4 with explicit separator. "555-123-4567", "555.123.4567".
    String.raw`\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b`,
  ].join("|"),
  "g",
);

/**
 * Provider-specific API key patterns. Each anchors on a recognisable prefix
 * so we don't redact random long alphanumeric strings (commit SHAs, hashes).
 */
const API_KEY_RE = new RegExp(
  [
    // OpenAI: sk-..., sk-proj-..., sk-live-..., sk-test-...
    String.raw`\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}\b`,
    // Anthropic
    String.raw`\bsk-ant-[A-Za-z0-9_-]{20,}\b`,
    // Slack
    String.raw`\bxox[abprs]-[A-Za-z0-9-]{10,}\b`,
    // GitHub PAT (classic) and fine-grained
    String.raw`\bghp_[A-Za-z0-9]{20,}\b`,
    String.raw`\bgithub_pat_[A-Za-z0-9_]{20,}\b`,
    // Google Cloud
    String.raw`\bAIza[0-9A-Za-z_-]{20,}\b`,
    // AWS access key id
    String.raw`\bAKIA[0-9A-Z]{16}\b`,
    // Stripe live/test keys
    String.raw`\b(?:sk|pk|rk)_(?:live|test)_[0-9A-Za-z]{20,}\b`,
  ].join("|"),
  "g",
);

export function redactText(input: string, options: ExportOptions): string {
  let text = input;
  if (options.redactEmails) text = text.replace(EMAIL_RE, "[REDACTED_EMAIL]");
  if (options.redactApiKeys)
    text = text.replace(API_KEY_RE, "[REDACTED_API_KEY]");
  if (options.redactPhoneNumbers)
    text = text.replace(PHONE_RE, "[REDACTED_PHONE]");
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
