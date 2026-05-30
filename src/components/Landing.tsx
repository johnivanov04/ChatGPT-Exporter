interface LandingProps {
  onChooseZip: () => void;
  onChoosePaste: () => void;
}

export function Landing({ onChooseZip, onChoosePaste }: LandingProps) {
  return (
    <div>
      <div className="text-center mb-10">
        <h2 className="text-3xl font-semibold text-slate-900">
          Export a ChatGPT conversation
        </h2>
        <p className="mt-2 text-slate-600 max-w-2xl mx-auto">
          Convert chats into clean PDF, Markdown, or JSON. The default input is
          your ChatGPT data export ZIP. Everything is processed locally in your
          browser.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          title="Upload ChatGPT Export ZIP"
          subtitle="Recommended"
          description="Drop the ZIP from ChatGPT > Settings > Data Controls > Export. We'll let you pick one conversation."
          status="primary"
          onClick={onChooseZip}
        />
        <Card
          title="Paste Chat Manually"
          subtitle="Fallback"
          description="Paste a copied transcript. We'll try to detect user/assistant turns."
          status="secondary"
          onClick={onChoosePaste}
        />
        <Card
          title="Browser Extension"
          subtitle="Coming soon"
          description="One-click export from any ChatGPT page. Not in MVP yet."
          status="disabled"
        />
      </div>

      <p className="mt-8 text-xs text-slate-500 text-center">
        Privacy: no backend, no accounts, no remote uploads.
      </p>
    </div>
  );
}

interface CardProps {
  title: string;
  subtitle: string;
  description: string;
  status: "primary" | "secondary" | "disabled";
  onClick?: () => void;
  disabled?: boolean;
  disabledNote?: string;
}

function Card({
  title,
  subtitle,
  description,
  status,
  onClick,
  disabled,
  disabledNote,
}: CardProps) {
  const isDisabled = status === "disabled" || disabled;
  const base =
    "rounded-lg border p-6 transition flex flex-col h-full text-left w-full";
  const styles: Record<CardProps["status"], string> = {
    primary:
      "border-indigo-300 bg-indigo-50 hover:border-indigo-500 hover:shadow-sm",
    secondary:
      "border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm",
    disabled: "border-dashed border-slate-300 bg-slate-50 opacity-70",
  };
  const badge: Record<CardProps["status"], string> = {
    primary: "text-indigo-700 bg-indigo-100",
    secondary: "text-slate-700 bg-slate-100",
    disabled: "text-slate-500 bg-slate-200",
  };
  const content = (
    <>
      <span
        className={`self-start text-xs font-medium px-2 py-0.5 rounded ${badge[status]}`}
      >
        {subtitle}
      </span>
      <h3 className="mt-3 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 flex-1">{description}</p>
      {isDisabled && disabledNote && (
        <p className="mt-4 text-xs text-slate-500">{disabledNote}</p>
      )}
    </>
  );

  if (isDisabled || !onClick) {
    return <div className={`${base} ${styles[status]}`}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${styles[status]} cursor-pointer`}
    >
      {content}
    </button>
  );
}
