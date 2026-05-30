import {
  FileArchive,
  ClipboardPaste,
  Puzzle,
  Lock,
  Zap,
  FileText,
  type LucideIcon,
} from "lucide-react";

interface LandingProps {
  onChooseZip: () => void;
  onChoosePaste: () => void;
}

export function Landing({ onChooseZip, onChoosePaste }: LandingProps) {
  return (
    <div>
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50/80 px-3 py-1 text-xs font-medium text-violet-700">
          <Zap className="h-3 w-3" /> Local-first &middot; nothing leaves your
          browser
        </span>
        <h1 className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.1]">
          Turn ChatGPT conversations into{" "}
          <span className="brand-gradient">clean exports</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
          Drop in your ChatGPT export ZIP, pick a chat, preview it, and download
          PDF, Markdown, or JSON. Everything runs in this tab &mdash; no backend,
          no accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          icon={FileArchive}
          title="Upload Export ZIP"
          subtitle="Recommended"
          description="Drop the ZIP from ChatGPT &rarr; Settings &rarr; Data Controls &rarr; Export. We'll let you pick one conversation."
          variant="primary"
          onClick={onChooseZip}
        />
        <Card
          icon={ClipboardPaste}
          title="Paste Chat Manually"
          subtitle="Fallback"
          description="Paste a copied transcript. We detect role markers, attachments, and 'Thought for X' to split turns."
          variant="secondary"
          onClick={onChoosePaste}
        />
        <Card
          icon={Puzzle}
          title="Browser Extension"
          subtitle="Coming soon"
          description="One-click export from any ChatGPT page. Not in MVP yet."
          variant="disabled"
        />
      </div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <Feature
          icon={Lock}
          title="Private by design"
          description="No backend. Files never leave your browser."
        />
        <Feature
          icon={FileText}
          title="Three formats"
          description="PDF, Markdown, and JSON from one preview."
        />
        <Feature
          icon={Zap}
          title="Handles real exports"
          description="Multimodal, code, reasoning, browsing &mdash; all normalized."
        />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */

interface CardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  variant: "primary" | "secondary" | "disabled";
  onClick?: () => void;
}

function Card({
  icon: Icon,
  title,
  subtitle,
  description,
  variant,
  onClick,
}: CardProps) {
  const disabled = variant === "disabled";

  if (disabled) {
    return (
      <div className="relative rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 flex flex-col h-full text-left opacity-70">
        <CardInner Icon={Icon} subtitle={subtitle} title={title} description={description} variant={variant} />
      </div>
    );
  }

  const primaryClasses =
    "before:absolute before:inset-0 before:rounded-xl before:p-[1.5px] before:bg-gradient-to-br before:from-violet-500/70 before:via-fuchsia-500/40 before:to-rose-400/40 before:[mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] before:[mask-composite:exclude] before:pointer-events-none";
  const variantClasses =
    variant === "primary"
      ? `bg-white shadow-sm hover:shadow-xl hover:-translate-y-0.5 ${primaryClasses}`
      : "bg-white border border-slate-200 hover:border-slate-400 hover:shadow-md hover:-translate-y-0.5";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl p-6 flex flex-col h-full text-left transition-all duration-200 focus-ring ${variantClasses}`}
    >
      <CardInner Icon={Icon} subtitle={subtitle} title={title} description={description} variant={variant} />
    </button>
  );
}

function CardInner({
  Icon,
  subtitle,
  title,
  description,
  variant,
}: {
  Icon: LucideIcon;
  subtitle: string;
  title: string;
  description: string;
  variant: CardProps["variant"];
}) {
  const iconWrap =
    variant === "primary"
      ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm shadow-violet-500/30"
      : variant === "secondary"
        ? "bg-slate-900 text-white"
        : "bg-slate-200 text-slate-500";
  const badge =
    variant === "primary"
      ? "text-violet-700 bg-violet-100"
      : variant === "secondary"
        ? "text-slate-700 bg-slate-100"
        : "text-slate-500 bg-slate-200";
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${iconWrap}`}>
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge}`}>
          {subtitle}
        </span>
      </div>
      <h3 className="text-base font-semibold text-slate-900 leading-snug">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-slate-600 leading-relaxed flex-1">
        {description}
      </p>
    </>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg bg-white/40 border border-slate-200/60 px-4 py-3">
      <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="mt-2 text-sm font-medium text-slate-800">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
  );
}
