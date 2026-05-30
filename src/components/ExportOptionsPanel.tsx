import {
  Eye,
  Settings2,
  ShieldAlert,
  Download,
  FileText,
  FileJson,
  Printer,
} from "lucide-react";
import type { ExportOptions } from "../types/conversation";

interface ExportOptionsPanelProps {
  options: ExportOptions;
  onChange: (next: ExportOptions) => void;
  showInternal: boolean;
  onToggleShowInternal: (v: boolean) => void;
  internalCount: number;
  visibleCount: number;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onExportPdf: () => void;
  exportDisabled?: boolean;
}

export function ExportOptionsPanel({
  options,
  onChange,
  showInternal,
  onToggleShowInternal,
  internalCount,
  visibleCount,
  onExportMarkdown,
  onExportJson,
  onExportPdf,
  exportDisabled,
}: ExportOptionsPanelProps) {
  const set = (patch: Partial<ExportOptions>) =>
    onChange({ ...options, ...patch });

  return (
    <aside className="no-print rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm shadow-sm p-5 text-sm sticky top-20 self-start">
      <Section icon={Eye} title="View">
        <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
          <span className="font-semibold text-slate-700">
            {visibleCount}
          </span>{" "}
          message{visibleCount === 1 ? "" : "s"} shown
          {internalCount > 0 && (
            <>
              {" "}
              &middot;{" "}
              <span className="text-slate-500">
                {internalCount} internal hidden
              </span>
            </>
          )}
        </p>
        <Check
          label="Show internal messages"
          hint="system prompts, tool calls, model reasoning"
          checked={showInternal}
          onChange={onToggleShowInternal}
          disabled={internalCount === 0}
        />
      </Section>

      <Section icon={Settings2} title="Include in export">
        <Check
          label="Front-page metadata"
          checked={options.includeMetadataPage}
          onChange={(v) => set({ includeMetadataPage: v })}
        />
        <Check
          label="Timestamps"
          checked={options.includeTimestamps}
          onChange={(v) => set({ includeTimestamps: v })}
        />
        <Check
          label="Message numbers"
          checked={options.includeMessageNumbers}
          onChange={(v) => set({ includeMessageNumbers: v })}
        />
        <Check
          label="Source metadata"
          checked={options.includeSourceMetadata}
          onChange={(v) => set({ includeSourceMetadata: v })}
        />
      </Section>

      <Section icon={ShieldAlert} title="Redaction (best-effort)">
        <Check
          label="Emails"
          checked={options.redactEmails}
          onChange={(v) => set({ redactEmails: v })}
        />
        <Check
          label="Phone numbers"
          checked={options.redactPhoneNumbers}
          onChange={(v) => set({ redactPhoneNumbers: v })}
        />
        <Check
          label="API-key-like strings"
          checked={options.redactApiKeys}
          onChange={(v) => set({ redactApiKeys: v })}
        />
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          Preview updates live. Review the file before sharing &mdash; redaction
          is not perfect.
        </p>
      </Section>

      <Section icon={Download} title="Download">
        <p className="text-[11px] text-slate-500 mb-2.5 leading-relaxed">
          Exports the{" "}
          <span className="font-semibold text-slate-700">{visibleCount}</span>{" "}
          currently-visible message{visibleCount === 1 ? "" : "s"}.
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onExportMarkdown}
            disabled={exportDisabled}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-3 py-2 text-sm font-medium shadow-sm shadow-violet-500/30 hover:shadow-md hover:shadow-violet-500/40 hover:-translate-y-px transition-all disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 focus-ring"
          >
            <FileText className="h-3.5 w-3.5" /> Markdown
          </button>
          <button
            type="button"
            onClick={onExportJson}
            disabled={exportDisabled}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-medium hover:bg-slate-800 hover:-translate-y-px transition-all disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:translate-y-0 focus-ring"
          >
            <FileJson className="h-3.5 w-3.5" /> JSON
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={exportDisabled}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm font-medium hover:border-slate-400 hover:bg-slate-50 hover:-translate-y-px transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:translate-y-0 disabled:border-slate-200 focus-ring"
          >
            <Printer className="h-3.5 w-3.5" /> Save as PDF
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          PDF opens your browser print dialog &mdash; pick <em>Save as PDF</em>.
        </p>
      </Section>
    </aside>
  );
}

/* ------------------------------ helpers --------------------------------- */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Eye;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-2 py-1.5 ${
        disabled ? "opacity-50" : "cursor-pointer group"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-3.5 w-3.5 rounded accent-violet-600"
      />
      <span className="flex-1">
        <span
          className={`text-slate-800 ${disabled ? "" : "group-hover:text-slate-900"} text-[13px]`}
        >
          {label}
        </span>
        {hint && (
          <span className="block text-[11px] text-slate-500 leading-snug">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
