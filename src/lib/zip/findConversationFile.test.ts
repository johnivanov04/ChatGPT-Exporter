import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  findConversationJsonFile,
  locateConversationFile,
} from "./findConversationFile";
import { loadZip } from "./readZip";

async function zipFrom(contents: Record<string, string>) {
  const zip = new JSZip();
  for (const [path, data] of Object.entries(contents)) zip.file(path, data);
  const blob = await zip.generateAsync({ type: "blob" });
  const file = new File([blob], "x.zip", { type: "application/zip" });
  return loadZip(file);
}

const SAMPLE_EXPORT = JSON.stringify([
  {
    title: "Hello",
    create_time: 1700000000,
    update_time: 1700000100,
    mapping: {
      root: {
        id: "root",
        message: null,
        parent: null,
        children: ["m1"],
      },
      m1: {
        id: "m1",
        message: {
          author: { role: "user" },
          content: { content_type: "text", parts: ["hi"] },
          create_time: 1700000050,
        },
        parent: "root",
        children: [],
      },
    },
  },
]);

describe("findConversationJsonFile", () => {
  it("returns null when there are no JSON files", async () => {
    const zip = await zipFrom({ "readme.txt": "no chats here" });
    expect(await findConversationJsonFile(zip)).toBeNull();
  });

  it("returns null when JSON files exist but none look like conversations", async () => {
    const zip = await zipFrom({
      "config.json": JSON.stringify({ version: 1 }),
      "metadata.json": JSON.stringify([{ random: "object" }]),
    });
    expect(await findConversationJsonFile(zip)).toBeNull();
  });

  it("finds conversations.json at the root", async () => {
    const zip = await zipFrom({ "conversations.json": SAMPLE_EXPORT });
    expect(await findConversationJsonFile(zip)).toBe("conversations.json");
  });

  it("finds conversations.json nested inside a folder", async () => {
    const zip = await zipFrom({
      "export-2026/conversations.json": SAMPLE_EXPORT,
    });
    expect(await findConversationJsonFile(zip)).toBe(
      "export-2026/conversations.json",
    );
  });

  it("matches the conversations.json name case-insensitively", async () => {
    const zip = await zipFrom({ "Conversations.JSON": SAMPLE_EXPORT });
    expect(await findConversationJsonFile(zip)).toBe("Conversations.JSON");
  });

  it("falls back to chat.json when conversations.json is absent", async () => {
    const zip = await zipFrom({ "chat.json": SAMPLE_EXPORT });
    expect(await findConversationJsonFile(zip)).toBe("chat.json");
  });

  it("prefers conversations.json over chat.json when both are present", async () => {
    const zip = await zipFrom({
      "chat.json": SAMPLE_EXPORT,
      "conversations.json": SAMPLE_EXPORT,
    });
    expect(await findConversationJsonFile(zip)).toBe("conversations.json");
  });

  it("falls back to scanning generic JSON files that look conversation-shaped (has 'mapping')", async () => {
    const zip = await zipFrom({
      "weird-name.json": JSON.stringify([
        {
          title: "x",
          mapping: { root: { id: "root", children: [] } },
        },
      ]),
    });
    expect(await findConversationJsonFile(zip)).toBe("weird-name.json");
  });

  it("recognises a single-object (non-array) export with a mapping", async () => {
    const zip = await zipFrom({
      "single.json": JSON.stringify({
        title: "x",
        mapping: { root: { id: "root", children: [] } },
      }),
    });
    expect(await findConversationJsonFile(zip)).toBe("single.json");
  });

  it("recognises an array where items have a 'messages' field", async () => {
    const zip = await zipFrom({
      "out.json": JSON.stringify([
        { title: "x", messages: [{ role: "user", content: "hi" }] },
      ]),
    });
    expect(await findConversationJsonFile(zip)).toBe("out.json");
  });

  it("skips files that aren't valid JSON during the fallback scan", async () => {
    const zip = await zipFrom({
      "broken.json": "not valid json {",
      "conversations.json": SAMPLE_EXPORT,
    });
    expect(await findConversationJsonFile(zip)).toBe("conversations.json");
  });

  it("returns null when fallback candidates are all invalid JSON", async () => {
    const zip = await zipFrom({
      "broken-a.json": "not valid",
      "broken-b.json": "{ also not valid",
    });
    expect(await findConversationJsonFile(zip)).toBeNull();
  });

  it("does not match a JSON file whose root isn't an object/array", async () => {
    const zip = await zipFrom({ "scalar.json": JSON.stringify("a string") });
    expect(await findConversationJsonFile(zip)).toBeNull();
  });

  it("ignores empty JSON files", async () => {
    const zip = await zipFrom({ "empty.json": "" });
    expect(await findConversationJsonFile(zip)).toBeNull();
  });

  it("does not match an array of plain primitives", async () => {
    const zip = await zipFrom({ "nums.json": "[1,2,3]" });
    expect(await findConversationJsonFile(zip)).toBeNull();
  });
});

describe("locateConversationFile", () => {
  it("returns null when no conversation file is present", async () => {
    const zip = await zipFrom({ "readme.txt": "x" });
    expect(await locateConversationFile(zip)).toBeNull();
  });

  it("returns filename, rawJson, and topLevelCount for an array export", async () => {
    const zip = await zipFrom({ "conversations.json": SAMPLE_EXPORT });
    const located = await locateConversationFile(zip);
    expect(located).not.toBeNull();
    expect(located!.filename).toBe("conversations.json");
    expect(located!.rawJson).toBe(SAMPLE_EXPORT);
    expect(located!.topLevelCount).toBe(1);
  });

  it("counts multiple top-level conversations", async () => {
    const multi = JSON.stringify([
      { title: "a", mapping: {} },
      { title: "b", mapping: {} },
      { title: "c", mapping: {} },
    ]);
    const zip = await zipFrom({ "conversations.json": multi });
    const located = await locateConversationFile(zip);
    expect(located!.topLevelCount).toBe(3);
  });

  it("reports topLevelCount = 1 for a non-array object export", async () => {
    const obj = JSON.stringify({
      title: "x",
      mapping: { root: { id: "root", children: [] } },
    });
    const zip = await zipFrom({ "conversations.json": obj });
    const located = await locateConversationFile(zip);
    expect(located!.topLevelCount).toBe(1);
  });

  it("returns null when a preferred-name file isn't valid JSON (skipped, not thrown)", async () => {
    // Multi-provider scan treats invalid JSON candidates as "not a conversation
    // file" and moves on rather than aborting the whole upload.
    const zip = await zipFrom({ "chats.json": "definitely not json" });
    await expect(locateConversationFile(zip)).resolves.toBeNull();
  });
});

describe("locateConversationFile - multi-provider detection", () => {
  it("tags a ChatGPT export with provider 'chatgpt'", async () => {
    const zip = await zipFrom({ "conversations.json": SAMPLE_EXPORT });
    const located = await locateConversationFile(zip);
    expect(located?.provider).toBe("chatgpt");
  });

  it("detects a Claude export by chat_messages shape", async () => {
    const claudeJson = JSON.stringify([
      {
        uuid: "c1",
        name: "Claude chat",
        chat_messages: [
          { uuid: "m1", sender: "human", text: "hi" },
          { uuid: "m2", sender: "assistant", text: "hello" },
        ],
      },
    ]);
    const zip = await zipFrom({ "conversations.json": claudeJson });
    const located = await locateConversationFile(zip);
    expect(located?.provider).toBe("claude");
  });

  it("finds Claude data even in a file with a non-standard name", async () => {
    const claudeJson = JSON.stringify([
      {
        uuid: "c1",
        name: "Claude chat",
        chat_messages: [{ uuid: "m1", sender: "human", text: "hi" }],
      },
    ]);
    const zip = await zipFrom({ "data-export.json": claudeJson });
    const located = await locateConversationFile(zip);
    expect(located?.provider).toBe("claude");
    expect(located?.filename).toBe("data-export.json");
  });

  it("detects a Gemini Takeout export at the conventional path", async () => {
    const geminiJson = JSON.stringify([
      {
        header: "Gemini Apps",
        title: "Asked: hi",
        time: "2026-05-01T00:00:00Z",
        products: ["Gemini Apps"],
      },
    ]);
    const zip = await zipFrom({
      "Takeout/My Activity/Gemini Apps/MyActivity.json": geminiJson,
    });
    const located = await locateConversationFile(zip);
    expect(located?.provider).toBe("gemini");
  });

  it("detects a Gemini export by header field in any JSON file", async () => {
    const geminiJson = JSON.stringify([
      {
        header: "Bard",
        title: "Asked: legacy",
        time: "2024-01-01T00:00:00Z",
      },
    ]);
    const zip = await zipFrom({ "weird-name.json": geminiJson });
    const located = await locateConversationFile(zip);
    expect(located?.provider).toBe("gemini");
  });

  it("prefers ChatGPT preferred names over later JSON files", async () => {
    const claudeJson = JSON.stringify([
      {
        uuid: "c1",
        name: "Claude",
        chat_messages: [{ uuid: "m1", sender: "human", text: "x" }],
      },
    ]);
    // Both present; ChatGPT preferred-name should win.
    const zip = await zipFrom({
      "alt.json": claudeJson,
      "conversations.json": SAMPLE_EXPORT,
    });
    const located = await locateConversationFile(zip);
    expect(located?.provider).toBe("chatgpt");
  });
});
