import { useState } from "react";
import { BookOpen, ExternalLink, Mail, Clock } from "lucide-react";
import type { Provider } from "../types/conversation";

interface Step {
  text: React.ReactNode;
}

interface Guide {
  id: Provider;
  name: string;
  eta: string;
  intro: string;
  steps: Step[];
  tips?: string[];
}

const GUIDES: Guide[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    eta: "Usually 5–30 min · email link",
    intro:
      "ChatGPT's official data export includes every conversation, sent as a downloadable ZIP via email.",
    steps: [
      {
        text: (
          <>
            Open{" "}
            <ExtLink href="https://chatgpt.com/">chatgpt.com</ExtLink> and log
            in.
          </>
        ),
      },
      {
        text: (
          <>
            Click your profile in the lower-left, then{" "}
            <strong>Settings</strong>.
          </>
        ),
      },
      {
        text: (
          <>
            Pick <strong>Data Controls</strong> in the sidebar.
          </>
        ),
      },
      {
        text: (
          <>
            Click <strong>Export</strong> next to "Export data", then{" "}
            <strong>Confirm export</strong>.
          </>
        ),
      },
      {
        text: (
          <>
            Check your email for a message titled{" "}
            <em>ChatGPT — Your data export is ready</em> and click the{" "}
            <strong>Download data export</strong> button. The link is valid for
            24 hours.
          </>
        ),
      },
      { text: "Drag the downloaded ZIP onto the upload box above." },
    ],
    tips: [
      "The email can take a few minutes to an hour. Watch your spam folder.",
      "The ZIP contains every chat. You'll pick which one to export next.",
    ],
  },
  {
    id: "claude",
    name: "Claude",
    eta: "Usually < 24h · email link",
    intro:
      "Anthropic delivers a ZIP containing conversations.json with every chat thread you've had with Claude.",
    steps: [
      {
        text: (
          <>
            Open{" "}
            <ExtLink href="https://claude.ai/settings/data-privacy-controls">
              claude.ai/settings/data-privacy-controls
            </ExtLink>
            .
          </>
        ),
      },
      {
        text: (
          <>
            Scroll to <strong>Export data</strong> and click{" "}
            <strong>Export data</strong>.
          </>
        ),
      },
      { text: "Confirm the export when prompted." },
      {
        text: (
          <>
            You'll get an email from Anthropic with a download link &mdash;
            usually within an hour, occasionally up to 24 hours.
          </>
        ),
      },
      {
        text: (
          <>
            Download the ZIP and drop it onto the upload box above. We look for{" "}
            <code className="text-[11px] bg-slate-100 rounded px-1 py-0.5">
              conversations.json
            </code>{" "}
            inside it.
          </>
        ),
      },
    ],
    tips: [
      "Both individual and Team-account exports work the same way.",
      "The link in the email is single-use and time-limited — download it promptly.",
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    eta: "Usually minutes – a few hours · email link",
    intro:
      "Google Gemini data comes through Google Takeout. You can export just the Gemini Apps activity to keep the archive small.",
    steps: [
      {
        text: (
          <>
            Open{" "}
            <ExtLink href="https://takeout.google.com/">
              takeout.google.com
            </ExtLink>{" "}
            (sign in if needed).
          </>
        ),
      },
      {
        text: (
          <>
            Click <strong>Deselect all</strong> at the top of the products
            list.
          </>
        ),
      },
      {
        text: (
          <>
            Scroll down and tick <strong>My Activity</strong>.
          </>
        ),
      },
      {
        text: (
          <>
            Click <strong>All activity data included</strong> on that row,
            uncheck everything, and tick only <strong>Gemini Apps</strong> (and{" "}
            <strong>Bard</strong> if shown). Click <strong>OK</strong>.
          </>
        ),
      },
      {
        text: (
          <>
            Optional but recommended: click <strong>Multiple formats</strong>{" "}
            and set Activity records to <strong>JSON</strong> (so this app can
            read it directly).
          </>
        ),
      },
      {
        text: (
          <>
            Scroll down, click <strong>Next step</strong>. Pick{" "}
            <em>Send download link via email</em>, format <em>.zip</em>, then{" "}
            <strong>Create export</strong>.
          </>
        ),
      },
      {
        text: (
          <>
            When the email arrives, download the Takeout ZIP and drop it onto
            the upload box. We'll find{" "}
            <code className="text-[11px] bg-slate-100 rounded px-1 py-0.5">
              My Activity/Gemini Apps/MyActivity.json
            </code>{" "}
            inside.
          </>
        ),
      },
    ],
    tips: [
      "Gemini's Takeout format is an activity log rather than a true conversation log — accuracy is best-effort.",
      "The HTML format is human-friendly but won't import here; pick JSON in the Multiple formats step.",
    ],
  },
];

export function HowToExport({
  defaultProvider = "chatgpt",
}: {
  defaultProvider?: Provider;
}) {
  const [active, setActive] = useState<Provider>(defaultProvider);
  const [open, setOpen] = useState(false);
  const guide = GUIDES.find((g) => g.id === active) ?? GUIDES[0];

  return (
    <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50/80 transition focus-ring"
      >
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
            <BookOpen className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium text-slate-900">
            How do I get my export ZIP?
          </span>
        </span>
        <span className="text-xs text-slate-500">
          {open ? "Hide" : "Show steps"}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 animate-fade-up">
          <div className="flex gap-1 px-5 pt-4">
            {GUIDES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActive(g.id)}
                className={`text-sm px-3 py-1.5 rounded-md font-medium transition ${
                  active === g.id
                    ? "bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div className="px-5 pb-5 pt-3">
            <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-3">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {guide.eta}
              </span>
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Delivered by email
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              {guide.intro}
            </p>
            <ol className="space-y-2.5">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-700">
                  <span className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step.text}</span>
                </li>
              ))}
            </ol>
            {guide.tips && guide.tips.length > 0 && (
              <div className="mt-4 rounded-lg bg-amber-50/60 border border-amber-100 px-3.5 py-2.5">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-700 mb-1">
                  Tips
                </p>
                <ul className="space-y-1">
                  {guide.tips.map((tip, i) => (
                    <li key={i} className="text-[13px] text-slate-700 leading-relaxed">
                      &middot; {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 text-amber-700 hover:text-amber-900 underline underline-offset-2"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
