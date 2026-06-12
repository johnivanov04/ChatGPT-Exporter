import JSZip from "jszip";
import type {
  ExportOptions,
  NormalizedConversation,
} from "../../types/conversation";
import { exportMarkdown } from "./exportMarkdown";
import { exportJson } from "./exportJson";
import { generatePdf } from "./generatePdf";
import { redactConversation } from "../redaction/redactText";

/**
 * Whether the conversation has at least one attachment with a fetched binary
 * payload. Determines whether the Markdown/JSON exports should ship as a ZIP
 * with a sidecar `attachments/` folder, or as the plain single file.
 */
export function hasDownloadableAttachments(
  conversation: NormalizedConversation,
): boolean {
  return conversation.messages.some(
    (m) => m.attachments?.some((a) => !!a.dataBase64) ?? false,
  );
}

export interface AttachmentSummary {
  total: number;
  downloadable: number;
  withErrors: number;
}

export function summarizeAttachments(
  conversation: NormalizedConversation,
): AttachmentSummary {
  let total = 0;
  let downloadable = 0;
  let withErrors = 0;
  for (const m of conversation.messages) {
    if (!m.attachments) continue;
    for (const a of m.attachments) {
      total++;
      if (a.dataBase64) downloadable++;
      if (a.fetchError) withErrors++;
    }
  }
  return { total, downloadable, withErrors };
}

/**
 * Build a `.zip` Blob containing `<baseName>.md` plus an `attachments/` folder
 * with every attachment whose binary we managed to fetch.
 */
export async function buildMarkdownZip(
  conversation: NormalizedConversation,
  options: ExportOptions,
  baseName: string,
  now?: Date,
): Promise<Blob> {
  const md = exportMarkdown(conversation, options, now);
  return buildSidecarZip(conversation, options, baseName, "md", md);
}

export async function buildJsonZip(
  conversation: NormalizedConversation,
  options: ExportOptions,
  baseName: string,
  now?: Date,
): Promise<Blob> {
  const json = exportJson(conversation, options, now);
  return buildSidecarZip(conversation, options, baseName, "json", json);
}

/**
 * Build a `.zip` Blob containing `<baseName>.pdf` plus an `attachments/`
 * folder with every attachment whose binary we managed to fetch.
 */
export async function buildPdfZip(
  conversation: NormalizedConversation,
  options: ExportOptions,
  baseName: string,
  now?: Date,
): Promise<Blob> {
  const pdf = await generatePdf(conversation, options, now);
  const redacted = redactConversation(conversation, options);
  const zip = new JSZip();
  zip.file(`${baseName}.pdf`, pdf);
  const folder = zip.folder("attachments");
  if (folder) addAttachmentsToFolder(redacted, folder);
  return zip.generateAsync({ type: "blob" });
}

/**
 * Build a ZIP containing only the attachments (used by PDF flow, which can't
 * embed binary attachments inline).
 */
export async function buildAttachmentsOnlyZip(
  conversation: NormalizedConversation,
  options: ExportOptions,
): Promise<Blob> {
  const redacted = redactConversation(conversation, options);
  const zip = new JSZip();
  const folder = zip.folder("attachments");
  if (folder) addAttachmentsToFolder(redacted, folder);
  return zip.generateAsync({ type: "blob" });
}

async function buildSidecarZip(
  conversation: NormalizedConversation,
  options: ExportOptions,
  baseName: string,
  ext: "md" | "json",
  fileContent: string,
): Promise<Blob> {
  // Re-redact so the attachment filenames in the manifest match what the
  // exporters produced. Redaction touches message text only, so reusing the
  // conversation directly for attachments is fine.
  const redacted = redactConversation(conversation, options);
  const zip = new JSZip();
  zip.file(`${baseName}.${ext}`, fileContent);
  const folder = zip.folder("attachments");
  if (folder) addAttachmentsToFolder(redacted, folder);
  return zip.generateAsync({ type: "blob" });
}

function addAttachmentsToFolder(
  conversation: NormalizedConversation,
  folder: JSZip,
): void {
  const seen = new Map<string, number>();
  for (const m of conversation.messages) {
    if (!m.attachments) continue;
    for (const a of m.attachments) {
      if (!a.dataBase64) continue;
      const safeName = ensureUniqueName(safeFilename(a.filename), seen);
      folder.file(safeName, a.dataBase64, { base64: true });
    }
  }
}

function safeFilename(name: string): string {
  // Drop directory separators and other characters that could escape the
  // attachments/ folder when extracted. Keep filenames recognisable.
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return cleaned || "attachment";
}

function ensureUniqueName(name: string, seen: Map<string, number>): string {
  if (!seen.has(name)) {
    seen.set(name, 1);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let counter = seen.get(name)!;
  let candidate: string;
  do {
    candidate = `${base}-${counter}${extension}`;
    counter++;
  } while (seen.has(candidate));
  seen.set(name, counter);
  seen.set(candidate, 1);
  return candidate;
}
