import { Paperclip, Download, AlertCircle } from "lucide-react";
import type { NormalizedAttachment } from "../types/conversation";
import { downloadFile } from "../lib/utils/downloadFile";

interface AttachmentChipProps {
  attachment: NormalizedAttachment;
}

export function AttachmentChip({ attachment }: AttachmentChipProps) {
  const downloadable = !!attachment.dataBase64;
  const sizeLabel = formatSize(attachment.size);

  const handleClick = () => {
    if (!attachment.dataBase64) return;
    const bytes = base64ToBytes(attachment.dataBase64);
    // Pass the underlying ArrayBuffer to Blob to avoid SharedArrayBuffer
    // mismatch under strict TS lib checks.
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: attachment.mimeType || "application/octet-stream",
    });
    downloadFile(
      attachment.filename || "attachment",
      blob,
      attachment.mimeType || "application/octet-stream",
    );
  };

  const title = downloadable
    ? `Click to download · ${attachment.filename}${
        sizeLabel ? ` · ${sizeLabel}` : ""
      }`
    : attachment.fetchError
      ? `Couldn't fetch this attachment: ${attachment.fetchError}`
      : "Filename only — binary not captured";

  const Tag = downloadable ? "button" : "span";

  return (
    <Tag
      type={downloadable ? "button" : undefined}
      onClick={downloadable ? handleClick : undefined}
      title={title}
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border transition max-w-[260px] ${
        downloadable
          ? "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 hover:border-violet-300 cursor-pointer focus-ring"
          : "border-slate-200 bg-slate-50 text-slate-600 cursor-default"
      }`}
    >
      <Paperclip className="h-3 w-3 shrink-0" />
      <span className="truncate">{attachment.filename || "attachment"}</span>
      {sizeLabel && (
        <span className={`shrink-0 ${downloadable ? "text-violet-600" : "text-slate-400"}`}>
          {sizeLabel}
        </span>
      )}
      {attachment.fetchError && (
        <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />
      )}
      {downloadable && <Download className="h-3 w-3 shrink-0" />}
    </Tag>
  );
}

function formatSize(size?: number): string {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return "";
  }
  const units = ["B", "KB", "MB", "GB"];
  let s = size;
  let i = 0;
  while (s >= 1024 && i < units.length - 1) {
    s /= 1024;
    i++;
  }
  return `${s < 10 ? s.toFixed(1) : Math.round(s)} ${units[i]}`;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
