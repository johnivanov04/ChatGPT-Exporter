import type JSZip from "jszip";
import { listFiles, readTextFile } from "./readZip";

const PREFERRED_NAMES = [
  "conversations.json",
  "chat.json",
  "chats.json",
];

export async function findConversationJsonFile(
  zip: JSZip,
): Promise<string | null> {
  const files = listFiles(zip);

  for (const name of PREFERRED_NAMES) {
    const direct = files.find(
      (f) => f.toLowerCase().endsWith(`/${name}`) || f.toLowerCase() === name,
    );
    if (direct) return direct;
  }

  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));

  for (const candidate of jsonFiles) {
    try {
      const text = await readTextFile(zip, candidate);
      if (looksLikeConversationJson(text)) return candidate;
    } catch {
      // ignore unreadable entries
    }
  }

  return null;
}

function looksLikeConversationJson(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return false;
  try {
    const parsed: unknown = JSON.parse(text);
    const sample = Array.isArray(parsed)
      ? parsed[0]
      : (parsed as Record<string, unknown>);
    if (!sample || typeof sample !== "object") return false;
    const obj = sample as Record<string, unknown>;
    return (
      "mapping" in obj ||
      "messages" in obj ||
      ("title" in obj && ("create_time" in obj || "update_time" in obj))
    );
  } catch {
    return false;
  }
}

export interface LocatedConversationFile {
  filename: string;
  rawJson: string;
  topLevelCount: number;
}

export async function locateConversationFile(
  zip: JSZip,
): Promise<LocatedConversationFile | null> {
  const filename = await findConversationJsonFile(zip);
  if (!filename) return null;
  const rawJson = await readTextFile(zip, filename);
  let topLevelCount = 0;
  try {
    const parsed: unknown = JSON.parse(rawJson);
    topLevelCount = Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    throw new Error(
      `Found ${filename} but it isn't valid JSON. The export format may have changed.`,
    );
  }
  return { filename, rawJson, topLevelCount };
}
