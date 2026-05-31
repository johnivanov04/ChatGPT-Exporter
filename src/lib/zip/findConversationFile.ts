import type JSZip from "jszip";
import type { Provider } from "../../types/conversation";
import { listFiles, readTextFile } from "./readZip";

const CHATGPT_PREFERRED = ["conversations.json", "chat.json", "chats.json"];

/**
 * Detect which provider a JSON file came from by inspecting its shape.
 * Returns null when the file isn't recognisable as a conversation export.
 */
function detectProvider(rawJson: string): Provider | null {
  const trimmed = rawJson.trimStart();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }
  const sample = Array.isArray(parsed)
    ? parsed[0]
    : (parsed as Record<string, unknown> | null);
  if (!sample || typeof sample !== "object") return null;
  const obj = sample as Record<string, unknown>;

  // ChatGPT: mapping tree, or messages array with title+create_time
  if ("mapping" in obj) return "chatgpt";

  // Claude: chat_messages array with sender field
  if (
    Array.isArray(obj.chat_messages) ||
    ("uuid" in obj && "chat_messages" in obj)
  ) {
    return "claude";
  }

  // Gemini Takeout: activity entry with products array including "Gemini Apps"
  if (
    Array.isArray(obj.products) &&
    (obj.products as unknown[]).some(
      (p) =>
        typeof p === "string" &&
        (p === "Gemini Apps" || p === "Bard" || p === "Assistant"),
    )
  ) {
    return "gemini";
  }
  // Gemini also identifiable by header field equal to "Gemini Apps" / "Bard"
  if (
    typeof obj.header === "string" &&
    /^(gemini apps|bard|assistant)$/i.test(obj.header)
  ) {
    return "gemini";
  }

  // Fallback ChatGPT detection (older shape)
  if (
    "messages" in obj ||
    ("title" in obj && ("create_time" in obj || "update_time" in obj))
  ) {
    return "chatgpt";
  }

  return null;
}

export interface LocatedConversationFile {
  filename: string;
  rawJson: string;
  topLevelCount: number;
  provider: Provider;
}

export async function findConversationJsonFile(
  zip: JSZip,
): Promise<string | null> {
  // Backwards-compat thin wrapper used by tests.
  const located = await locateConversationFile(zip);
  return located?.filename ?? null;
}

export async function locateConversationFile(
  zip: JSZip,
): Promise<LocatedConversationFile | null> {
  const files = listFiles(zip);

  // 1) Try ChatGPT's preferred filenames first (cheap, highest signal).
  for (const name of CHATGPT_PREFERRED) {
    const direct = files.find(
      (f) => f.toLowerCase().endsWith(`/${name}`) || f.toLowerCase() === name,
    );
    if (direct) {
      const located = await tryLocate(zip, direct);
      if (located) return located;
    }
  }

  // 2) Gemini Takeout: look for MyActivity.json under My Activity/{Gemini Apps,Bard,…}.
  const geminiCandidates = files.filter((f) =>
    /my[\s_]activity\/(gemini[\s_]apps|bard|assistant)\/myactivity\.json$/i.test(
      f,
    ),
  );
  for (const candidate of geminiCandidates) {
    const located = await tryLocate(zip, candidate);
    if (located) return located;
  }

  // 3) Generic scan: any JSON file whose content matches one of the providers.
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));
  for (const candidate of jsonFiles) {
    const located = await tryLocate(zip, candidate);
    if (located) return located;
  }

  return null;
}

async function tryLocate(
  zip: JSZip,
  filename: string,
): Promise<LocatedConversationFile | null> {
  let rawJson: string;
  try {
    rawJson = await readTextFile(zip, filename);
  } catch {
    return null;
  }
  const provider = detectProvider(rawJson);
  if (!provider) return null;
  let topLevelCount = 0;
  try {
    const parsed: unknown = JSON.parse(rawJson);
    topLevelCount = Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    throw new Error(
      `Found ${filename} but it isn't valid JSON. The export format may have changed.`,
    );
  }
  return { filename, rawJson, topLevelCount, provider };
}
