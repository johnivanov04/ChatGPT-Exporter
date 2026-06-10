import {
  FileArchive,
  ClipboardPaste,
  Puzzle,
  Lock,
  Zap,
  FileText,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import { HowToExport } from "./HowToExport";

interface LandingProps {
  onChooseZip: () => void;
  onChoosePaste: () => void;
  onChooseSample: () => void;
}

export function Landing({
  onChooseZip,
  onChoosePaste,
  onChooseSample,
}: LandingProps) {
  return (
    <div>
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <Zap className="h-3 w-3" /> Local-first &middot; nothing leaves your
          browser
        </span>
        <h1 className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-100 leading-[1.1]">
          Turn AI conversations into{" "}
          <span className="brand-gradient">clean exports</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
          Drop in your <strong>ChatGPT</strong>, <strong>Claude</strong>, or{" "}
          <strong>Gemini</strong> export, pick a chat, preview it, and download
          PDF, Markdown, or JSON. Everything runs in this tab &mdash; no
          backend, no accounts.
        </p>
        <button
          type="button"
          onClick={onChooseSample}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-amber-300 hover:text-amber-200 transition focus-ring rounded-md px-1"
        >
          <PlayCircle className="h-4 w-4" />
          or see a sample conversation
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          icon={FileArchive}
          title="Upload Export ZIP"
          subtitle="Recommended"
          description="ChatGPT (conversations.json), Claude (chat_messages), or Gemini (Google Takeout). We auto-detect which provider it's from."
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

      <div className="mt-8 max-w-3xl mx-auto">
        <HowToExport />
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
      <div className="relative rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-6 flex flex-col h-full text-left opacity-70">
        <CardInner Icon={Icon} subtitle={subtitle} title={title} description={description} variant={variant} />
      </div>
    );
  }

  const primaryClasses =
    "before:absolute before:inset-0 before:rounded-xl before:p-[1.5px] before:bg-gradient-to-br before:from-amber-400/70 before:via-amber-500/50 before:to-amber-700/40 before:[mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] before:[mask-composite:exclude] before:pointer-events-none";
  const variantClasses =
    variant === "primary"
      ? `bg-slate-900 shadow-sm hover:shadow-xl hover:-translate-y-0.5 ${primaryClasses}`
      : "bg-slate-900 border border-slate-700 hover:border-slate-400 hover:shadow-md hover:-translate-y-0.5";

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
      ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30"
      : variant === "secondary"
        ? "bg-slate-900 text-white"
        : "bg-slate-700 text-slate-400";
  const badge =
    variant === "primary"
      ? "text-amber-300 bg-amber-500/15"
      : variant === "secondary"
        ? "text-slate-200 bg-slate-800"
        : "text-slate-400 bg-slate-700";
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
      <h3 className="text-base font-semibold text-slate-100 leading-snug">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-slate-300 leading-relaxed flex-1">
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
    <div className="rounded-lg bg-slate-900/40 border border-slate-700/60 px-4 py-3">
      <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-slate-200">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="mt-2 text-sm font-medium text-slate-100">{title}</p>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>
  );
}
