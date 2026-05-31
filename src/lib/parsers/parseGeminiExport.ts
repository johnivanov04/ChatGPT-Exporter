import type {
  ChatRole,
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";
import { toIsoString } from "../utils/date";
import { generateId } from "./normalizeConversation";

/**
 * Google Takeout's Gemini / Bard Apps export emits an activity-log JSON
 * (`My Activity/Gemini Apps/MyActivity.json` or `…/Bard/MyActivity.json`).
 * Each activity entry is one *event* — usually a single prompt or a single
 * response — with a `time` timestamp and a `title` that holds the text.
 *
 * Because there's no native concept of a multi-turn "conversation" in the
 * export, this parser groups consecutive activities into a single
 * conversation when they happen within a session window (default 30 min).
 * Within a group, role is inferred from prefixes Google uses:
 *
 *   - "Asked: <prompt>"     → user
 *   - "Searched for <q>"    → user
 *   - "Gemini said: …"      → assistant
 *   - "Visited Gemini Apps" → skip (navigation marker)
 *
 * If neither prefix is present, we alternate roles starting with user.
 * Best-effort: this format is genuinely ambiguous and accuracy is lower
 * than ChatGPT/Claude.
 */

interface RawSubtitle {
  name?: unknown;
}

interface RawDetail {
  name?: unknown;
}

interface RawGeminiActivity {
  header?: unknown;
  title?: unknown;
  titleUrl?: unknown;
  subtitles?: RawSubtitle[];
  details?: RawDetail[];
  time?: unknown;
  products?: unknown[];
}

const USER_PREFIXES = [
  /^asked:\s+/i,
  /^searched for\s+/i,
  /^told\s+/i,
];

const ASSISTANT_PREFIXES = [
  /^gemini said:?\s+/i,
  /^bard said:?\s+/i,
  /^answered:\s+/i,
];

const SKIP_TITLES = [
  /^visited\s/i,
  /^used\s/i,
];

const DEFAULT_SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

function classify(
  title: string,
): { role: ChatRole; text: string; skip: boolean } {
  if (SKIP_TITLES.some((re) => re.test(title))) {
    return { role: "unknown", text: title, skip: true };
  }
  for (const re of USER_PREFIXES) {
    if (re.test(title)) {
      return { role: "user", text: title.replace(re, "").trim(), skip: false };
    }
  }
  for (const re of ASSISTANT_PREFIXES) {
    if (re.test(title)) {
      return {
        role: "assistant",
        text: title.replace(re, "").trim(),
        skip: false,
      };
    }
  }
  return { role: "unknown", text: title, skip: false };
}

interface PreparedEvent {
  role: ChatRole;
  text: string;
  time: number; // ms epoch
  iso?: string;
  raw: RawGeminiActivity;
}

function prepareEvents(activities: RawGeminiActivity[]): PreparedEvent[] {
  const events: PreparedEvent[] = [];
  for (const a of activities) {
    const title = typeof a.title === "string" ? a.title.trim() : "";
    if (!title) continue;
    const { role, text, skip } = classify(title);
    if (skip || !text) continue;
    const iso = toIsoString(a.time);
    const time = iso ? Date.parse(iso) : Number.NaN;
    events.push({ role, text, time, iso, raw: a });
  }
  // Activities arrive newest-first in Takeout; reverse so the conversation
  // reads chronologically.
  return events.reverse();
}

function inferAlternatingRoles(events: PreparedEvent[]): PreparedEvent[] {
  // Within an unknown-role conversation, alternate starting with user.
  let nextRole: ChatRole = "user";
  return events.map((e) => {
    if (e.role !== "unknown") {
      nextRole = e.role === "user" ? "assistant" : "user";
      return e;
    }
    const out = { ...e, role: nextRole };
    nextRole = nextRole === "user" ? "assistant" : "user";
    return out;
  });
}

function groupIntoConversations(
  events: PreparedEvent[],
  sessionGapMs: number,
): PreparedEvent[][] {
  if (events.length === 0) return [];
  const groups: PreparedEvent[][] = [[]];
  let lastTime = events[0].time;
  for (const e of events) {
    const current = groups[groups.length - 1];
    if (
      current.length > 0 &&
      Number.isFinite(e.time) &&
      Number.isFinite(lastTime) &&
      Math.abs(e.time - lastTime) > sessionGapMs
    ) {
      groups.push([e]);
    } else {
      current.push(e);
    }
    if (Number.isFinite(e.time)) lastTime = e.time;
  }
  return groups.filter((g) => g.length > 0);
}

function buildConversation(
  events: PreparedEvent[],
  index: number,
): NormalizedConversation {
  const firstUser = events.find((e) => e.role === "user");
  const titleSource = firstUser?.text ?? events[0]?.text ?? "Gemini session";
  const title =
    titleSource.length > 60 ? `${titleSource.slice(0, 60)}…` : titleSource;
  const messages: NormalizedMessage[] = events.map((e, i) => ({
    id: generateId("msg"),
    role: e.role,
    content: e.text,
    createdAt: e.iso,
    messageIndex: i,
    metadata: { contentType: "text" },
  }));
  return {
    id: generateId("conv"),
    title: `${title}`,
    createdAt: events[0]?.iso,
    updatedAt: events[events.length - 1]?.iso,
    source: "gemini_takeout",
    messages,
    metadata: { sessionIndex: index },
  };
}

interface ParseGeminiOptions {
  sessionGapMs?: number;
}

export function parseGeminiActivityJson(
  rawJson: string,
  options: ParseGeminiOptions = {},
): NormalizedConversation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(
      "Could not parse the Gemini activity JSON. The Takeout export format may have changed.",
      { cause: err as Error },
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Expected the Gemini Takeout activity log to be a JSON array.",
    );
  }

  const events = inferAlternatingRoles(
    prepareEvents(parsed as RawGeminiActivity[]),
  );
  if (events.length === 0) return [];

  const sessionGap = options.sessionGapMs ?? DEFAULT_SESSION_GAP_MS;
  const groups = groupIntoConversations(events, sessionGap);
  return groups.map((group, i) => buildConversation(group, i));
}
