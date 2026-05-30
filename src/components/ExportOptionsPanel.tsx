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
  const set = (patch: Partial<ExportOptions>) => onChange({ ...options, ...patch });

  return (
    <aside className="no-print rounded-lg border border-slate-200 bg-white p-5 text-sm sticky top-6 self-start">
      <h3 className="font-semibold text-slate-900">Export options</h3>

      <Section title="View">
        <p className="text-xs text-slate-500 mb-2">
          {visibleCount} message{visibleCount === 1 ? "" : "s"} shown
          {internalCount > 0 && ` · ${internalCount} internal hidden`}
        </p>
        <Check
          label="Show internal messages"
          hint="system prompts, tool calls, model reasoning"
          checked={showInternal}
          onChange={onToggleShowInternal}
          disabled={internalCount === 0}
        />
      </Section>

      <Section title="Include in export">
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

      <Section title="Redaction (best-effort)">
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
        <p className="text-xs text-slate-500 mt-2">
          Review the exported file before sharing. Redaction is not perfect.
        </p>
      </Section>

      <Section title="Download">
        <p className="text-xs text-slate-500 mb-2">
          Exports the {visibleCount} currently-visible message
          {visibleCount === 1 ? "" : "s"}.
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onExportMarkdown}
            disabled={exportDisabled}
            className="w-full rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            Download Markdown
          </button>
          <button
            type="button"
            onClick={onExportJson}
            disabled={exportDisabled}
            className="w-full rounded-md bg-slate-800 text-white px-3 py-2 text-sm font-medium hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={exportDisabled}
            className="w-full rounded-md bg-rose-600 text-white px-3 py-2 text-sm font-medium hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            Save as PDF
          </button>
          <p className="text-xs text-slate-500">
            Opens your browser print dialog &mdash; choose
            <em> Save as PDF</em> as the destination.
          </p>
        </div>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
        {title}
      </p>
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
      className={`flex items-start gap-2 py-1 ${disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 accent-indigo-600"
      />
      <span>
        <span className="text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}
