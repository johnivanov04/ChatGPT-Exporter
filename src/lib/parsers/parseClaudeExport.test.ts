import { describe, it, expect } from "vitest";
import {
  extractClaudeMessageContent,
  normalizeClaudeConversation,
  parseClaudeExportJson,
} from "./parseClaudeExport";

const SAMPLE = JSON.stringify([
  {
    uuid: "c1",
    name: "Linear algebra basics",
    summary: "A short Q&A about vector bases",
    created_at: "2026-05-01T00:00:00.000000Z",
    updated_at: "2026-05-01T00:30:00.000000Z",
    chat_messages: [
      {
        uuid: "m1",
        sender: "human",
        index: 0,
        text: "What is a basis?",
        content: [{ type: "text", text: "What is a basis?" }],
        created_at: "2026-05-01T00:00:00.000000Z",
        attachments: [],
        files: [],
      },
      {
        uuid: "m2",
        sender: "assistant",
        index: 1,
        text: "A basis is a maximal linearly independent set.",
        content: [
          { type: "text", text: "A basis is a maximal linearly independent set." },
        ],
        created_at: "2026-05-01T00:00:30.000000Z",
      },
    ],
  },
]);

describe("extractClaudeMessageContent", () => {
  it("joins content blocks of type 'text'", () => {
    expect(
      extractClaudeMessageContent({
        content: [
          { type: "text", text: "hello " },
          { type: "text", text: "world" },
        ],
      }),
    ).toBe("hello \nworld");
  });

  it("renders image blocks as [image] with media type when present", () => {
    expect(
      extractClaudeMessageContent({
        content: [
          { type: "text", text: "look:" },
          { type: "image", source: { type: "base64", media_type: "image/png" } },
        ],
      }),
    ).toBe("look:\n[image (image/png)]");
  });

  it("renders tool_use blocks as [tool call: name]", () => {
    expect(
      extractClaudeMessageContent({
        content: [{ type: "tool_use", name: "web_search", input: { q: "x" } }],
      }),
    ).toBe("[tool call: web_search]");
  });

  it("renders tool_result blocks by extracting their inner content", () => {
    expect(
      extractClaudeMessageContent({
        content: [
          {
            type: "tool_result",
            content: [{ type: "text", text: "result body" }],
          },
        ],
      }),
    ).toBe("result body");
  });

  it("falls back to message.text when content array is absent", () => {
    expect(
      extractClaudeMessageContent({ text: "hi from text" }),
    ).toBe("hi from text");
  });

  it("uses string content directly when content is a string", () => {
    expect(
      extractClaudeMessageContent({ content: "plain string" }),
    ).toBe("plain string");
  });

  it("returns empty string for null content with no text fallback", () => {
    expect(extractClaudeMessageContent({ content: null })).toBe("");
  });

  it("skips empty text blocks when joining", () => {
    expect(
      extractClaudeMessageContent({
        content: [
          { type: "text", text: "" },
          { type: "text", text: "real" },
          { type: "text", text: "" },
        ],
      }),
    ).toBe("real");
  });
});

describe("normalizeClaudeConversation", () => {
  it("sets source to claude_export_zip", () => {
    const c = normalizeClaudeConversation({ chat_messages: [] });
    expect(c.source).toBe("claude_export_zip");
  });

  it("uses name as title and falls back when blank", () => {
    expect(
      normalizeClaudeConversation({ name: "My Chat", chat_messages: [] }).title,
    ).toBe("My Chat");
    expect(
      normalizeClaudeConversation({ name: "   ", chat_messages: [] }).title,
    ).toBe("Untitled conversation");
  });

  it("normalizes Claude's 'human' sender to 'user' role", () => {
    const c = normalizeClaudeConversation({
      chat_messages: [
        {
          uuid: "m1",
          sender: "human",
          text: "hello",
          created_at: "2026-05-01T00:00:00Z",
        },
      ],
    });
    expect(c.messages[0].role).toBe("user");
  });

  it("normalizes 'assistant' sender unchanged", () => {
    const c = normalizeClaudeConversation({
      chat_messages: [
        { uuid: "m1", sender: "assistant", text: "hi" },
      ],
    });
    expect(c.messages[0].role).toBe("assistant");
  });

  it("preserves attachment filenames as [attached: name] above message content", () => {
    const c = normalizeClaudeConversation({
      chat_messages: [
        {
          uuid: "m1",
          sender: "human",
          text: "see attached",
          attachments: [{ file_name: "notes.pdf" }],
          files: [{ file_name: "image.png" }],
        },
      ],
    });
    expect(c.messages[0].content).toContain("[attached: notes.pdf]");
    expect(c.messages[0].content).toContain("[attached: image.png]");
    expect(c.messages[0].content).toContain("see attached");
  });

  it("skips messages with empty content", () => {
    const c = normalizeClaudeConversation({
      chat_messages: [
        { uuid: "m1", sender: "human", text: "" },
        { uuid: "m2", sender: "assistant", text: "real" },
      ],
    });
    expect(c.messages).toHaveLength(1);
    expect(c.messages[0].content).toBe("real");
  });

  it("converts ISO timestamps directly", () => {
    const c = normalizeClaudeConversation({
      created_at: "2026-05-01T00:00:00.000000Z",
      chat_messages: [],
    });
    expect(c.createdAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("uses uuid as id and falls back to generated id", () => {
    expect(
      normalizeClaudeConversation({ uuid: "u-1", chat_messages: [] }).id,
    ).toBe("u-1");
    expect(
      normalizeClaudeConversation({ chat_messages: [] }).id.startsWith("conv-"),
    ).toBe(true);
  });
});

describe("parseClaudeExportJson", () => {
  it("throws a friendly error on invalid JSON", () => {
    expect(() => parseClaudeExportJson("not json {")).toThrow(/could not parse/i);
  });

  it("parses an array of Claude conversations", () => {
    const convos = parseClaudeExportJson(SAMPLE);
    expect(convos).toHaveLength(1);
    expect(convos[0].title).toBe("Linear algebra basics");
    expect(convos[0].messages).toHaveLength(2);
    expect(convos[0].messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("accepts a single conversation object (not in an array)", () => {
    const single = JSON.stringify(JSON.parse(SAMPLE)[0]);
    const convos = parseClaudeExportJson(single);
    expect(convos).toHaveLength(1);
    expect(convos[0].title).toBe("Linear algebra basics");
  });

  it("accepts a { conversations: [...] } wrapper", () => {
    const wrapped = JSON.stringify({ conversations: JSON.parse(SAMPLE) });
    expect(parseClaudeExportJson(wrapped)).toHaveLength(1);
  });

  it("returns [] for an empty array", () => {
    expect(parseClaudeExportJson("[]")).toEqual([]);
  });

  it("skips malformed conversation entries but keeps valid ones", () => {
    const mixed = JSON.stringify([null, "garbage", JSON.parse(SAMPLE)[0], 42]);
    const convos = parseClaudeExportJson(mixed);
    expect(convos).toHaveLength(1);
    expect(convos[0].title).toBe("Linear algebra basics");
  });
});
