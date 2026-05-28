import { describe, it, expect } from "vitest";
import {
  extractMessageContent,
  extractMessagesFromMapping,
  normalizeChatGptConversation,
  parseChatGptExportJson,
} from "./parseChatGptExport";

/* ----------------------- extractMessageContent ------------------------ */

describe("extractMessageContent", () => {
  it("returns empty string for null message", () => {
    expect(extractMessageContent(null)).toBe("");
  });

  it("returns empty string when content is null", () => {
    expect(extractMessageContent({ content: null })).toBe("");
  });

  it("uses a plain string content directly", () => {
    expect(extractMessageContent({ content: "  hi  " })).toBe("hi");
  });

  it("joins text parts with newlines", () => {
    expect(
      extractMessageContent({
        content: { content_type: "text", parts: ["line1", "line2"] },
      }),
    ).toBe("line1\nline2");
  });

  it("treats a single empty-string part as empty", () => {
    expect(
      extractMessageContent({ content: { content_type: "text", parts: [""] } }),
    ).toBe("");
  });

  it("treats an empty parts array as empty", () => {
    expect(
      extractMessageContent({ content: { content_type: "text", parts: [] } }),
    ).toBe("");
  });

  it("renders image asset pointers in multimodal_text as [image]", () => {
    expect(
      extractMessageContent({
        content: {
          content_type: "multimodal_text",
          parts: [
            "look at this:",
            {
              content_type: "image_asset_pointer",
              asset_pointer: "sediment://abc",
            },
          ],
        },
      }),
    ).toBe("look at this:\n[image]");
  });

  it("omits unknown structured parts rather than dumping JSON", () => {
    expect(
      extractMessageContent({
        content: {
          content_type: "multimodal_text",
          parts: ["keep", { content_type: "some_future_thing", foo: 1 }],
        },
      }),
    ).toBe("keep");
  });

  it("extracts code content via content.text", () => {
    expect(
      extractMessageContent({
        content: { content_type: "code", text: "print('hi')" },
      }),
    ).toBe("print('hi')");
  });

  it("extracts execution_output via content.text", () => {
    expect(
      extractMessageContent({
        content: { content_type: "execution_output", text: "42\n" },
      }),
    ).toBe("42");
  });

  it("extracts reasoning_recap via content.content", () => {
    expect(
      extractMessageContent({
        content: { content_type: "reasoning_recap", content: "Thought for 10s" },
      }),
    ).toBe("Thought for 10s");
  });

  it("extracts thoughts by joining summaries and chunks", () => {
    expect(
      extractMessageContent({
        content: {
          content_type: "thoughts",
          thoughts: [
            { summary: "Considering X", chunks: ["chunk a", "chunk b"] },
            { chunks: ["chunk c"] },
          ],
        },
      }),
    ).toBe("Considering X\nchunk a\nchunk b\n\nchunk c");
  });

  it("extracts tether_browsing_display via result", () => {
    expect(
      extractMessageContent({
        content: {
          content_type: "tether_browsing_display",
          result: "search results here",
          summary: "",
        },
      }),
    ).toBe("search results here");
  });

  it("falls back to summary when result is empty for tether display", () => {
    expect(
      extractMessageContent({
        content: {
          content_type: "tether_browsing_display",
          result: "",
          summary: "fallback summary",
        },
      }),
    ).toBe("fallback summary");
  });

  it("skips (returns empty) unrecognized object content instead of dumping JSON", () => {
    const out = extractMessageContent({
      content: { content_type: "mystery", weird: { nested: true } } as never,
    });
    expect(out).toBe("");
  });

  it("returns empty for an empty tether_browsing_display (no result/summary)", () => {
    expect(
      extractMessageContent({
        content: {
          content_type: "tether_browsing_display",
          result: "",
          summary: "",
        },
      }),
    ).toBe("");
  });
});

/* --------------------- extractMessagesFromMapping --------------------- */

describe("extractMessagesFromMapping", () => {
  const linearMapping = {
    root: { id: "root", message: null, parent: null, children: ["a"] },
    a: {
      id: "a",
      parent: "root",
      children: ["b"],
      message: {
        id: "a",
        author: { role: "user" },
        content: { content_type: "text", parts: ["hello"] },
        create_time: 1700000000,
      },
    },
    b: {
      id: "b",
      parent: "a",
      children: [],
      message: {
        id: "b",
        author: { role: "assistant" },
        content: { content_type: "text", parts: ["hi there"] },
        create_time: 1700000001,
      },
    },
  };

  it("walks current_node parent chain into chronological order", () => {
    const msgs = extractMessagesFromMapping(linearMapping, "b");
    expect(msgs.map((m) => m.content)).toEqual(["hello", "hi there"]);
  });

  it("assigns sequential messageIndex values", () => {
    const msgs = extractMessagesFromMapping(linearMapping, "b");
    expect(msgs.map((m) => m.messageIndex)).toEqual([0, 1]);
  });

  it("normalizes roles", () => {
    const msgs = extractMessagesFromMapping(linearMapping, "b");
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("skips nodes without a message (e.g. the root)", () => {
    const msgs = extractMessagesFromMapping(linearMapping, "b");
    expect(msgs).toHaveLength(2);
  });

  it("skips messages whose extracted content is empty", () => {
    const mapping = {
      root: { id: "root", message: null, parent: null, children: ["a"] },
      a: {
        id: "a",
        parent: "root",
        children: ["b"],
        message: {
          id: "a",
          author: { role: "system" },
          content: { content_type: "text", parts: [""] },
        },
      },
      b: {
        id: "b",
        parent: "a",
        children: [],
        message: {
          id: "b",
          author: { role: "user" },
          content: { content_type: "text", parts: ["real"] },
        },
      },
    };
    const msgs = extractMessagesFromMapping(mapping, "b");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("real");
  });

  it("records contentType in metadata", () => {
    const msgs = extractMessagesFromMapping(linearMapping, "b");
    expect(msgs[0].metadata?.contentType).toBe("text");
  });

  it("falls back to root DFS when current_node is missing", () => {
    const msgs = extractMessagesFromMapping(linearMapping);
    expect(msgs.map((m) => m.content)).toEqual(["hello", "hi there"]);
  });

  it("falls back to DFS when current_node points to a missing node", () => {
    const msgs = extractMessagesFromMapping(linearMapping, "does-not-exist");
    expect(msgs.map((m) => m.content)).toEqual(["hello", "hi there"]);
  });

  it("only follows the current_node thread, ignoring sibling branches", () => {
    const branched = {
      root: { id: "root", message: null, parent: null, children: ["a"] },
      a: {
        id: "a",
        parent: "root",
        children: ["b1", "b2"],
        message: {
          id: "a",
          author: { role: "user" },
          content: { parts: ["q"] },
        },
      },
      b1: {
        id: "b1",
        parent: "a",
        children: [],
        message: {
          id: "b1",
          author: { role: "assistant" },
          content: { parts: ["first answer"] },
        },
      },
      b2: {
        id: "b2",
        parent: "a",
        children: [],
        message: {
          id: "b2",
          author: { role: "assistant" },
          content: { parts: ["regenerated answer"] },
        },
      },
    };
    const msgs = extractMessagesFromMapping(branched, "b2");
    expect(msgs.map((m) => m.content)).toEqual(["q", "regenerated answer"]);
  });

  it("returns [] for an empty mapping", () => {
    expect(extractMessagesFromMapping({})).toEqual([]);
  });

  it("sorts by timestamp when every message is timestamped", () => {
    const mapping = {
      root: { id: "root", message: null, parent: null, children: ["a"] },
      a: {
        id: "a",
        parent: "root",
        children: ["b"],
        message: {
          id: "a",
          author: { role: "user" },
          content: { parts: ["second"] },
          create_time: 200,
        },
      },
      b: {
        id: "b",
        parent: "a",
        children: [],
        message: {
          id: "b",
          author: { role: "assistant" },
          content: { parts: ["first"] },
          create_time: 100,
        },
      },
    };
    // Traversal order is [a, b]; both timestamped so it re-sorts by time.
    const msgs = extractMessagesFromMapping(mapping, "b");
    expect(msgs.map((m) => m.content)).toEqual(["first", "second"]);
  });

  it("preserves traversal order when timestamps are incomplete", () => {
    const mapping = {
      root: { id: "root", message: null, parent: null, children: ["a"] },
      a: {
        id: "a",
        parent: "root",
        children: ["b"],
        message: {
          id: "a",
          author: { role: "user" },
          content: { parts: ["first"] },
          create_time: 999,
        },
      },
      b: {
        id: "b",
        parent: "a",
        children: [],
        message: {
          id: "b",
          author: { role: "assistant" },
          content: { parts: ["second"] },
          // no create_time
        },
      },
    };
    const msgs = extractMessagesFromMapping(mapping, "b");
    expect(msgs.map((m) => m.content)).toEqual(["first", "second"]);
  });
});

/* ------------------- normalizeChatGptConversation --------------------- */

describe("normalizeChatGptConversation", () => {
  it("uses the title when present", () => {
    const c = normalizeChatGptConversation({ title: "My Chat", mapping: {} });
    expect(c.title).toBe("My Chat");
  });

  it("falls back to 'Untitled conversation' for missing/blank title", () => {
    expect(normalizeChatGptConversation({ mapping: {} }).title).toBe(
      "Untitled conversation",
    );
    expect(
      normalizeChatGptConversation({ title: "   ", mapping: {} }).title,
    ).toBe("Untitled conversation");
  });

  it("sets source to chatgpt_export_zip", () => {
    expect(normalizeChatGptConversation({ mapping: {} }).source).toBe(
      "chatgpt_export_zip",
    );
  });

  it("converts unix-second timestamps to ISO", () => {
    const c = normalizeChatGptConversation({
      mapping: {},
      create_time: 1700000000,
      update_time: 1700000100,
    });
    expect(c.createdAt).toBe("2023-11-14T22:13:20.000Z");
    expect(c.updatedAt).toBe("2023-11-14T22:15:00.000Z");
  });

  it("uses id, then conversation_id, then a generated id", () => {
    expect(normalizeChatGptConversation({ id: "x", mapping: {} }).id).toBe("x");
    expect(
      normalizeChatGptConversation({ conversation_id: "y", mapping: {} }).id,
    ).toBe("y");
    expect(
      normalizeChatGptConversation({ mapping: {} }).id.startsWith("conv-"),
    ).toBe(true);
  });

  it("captures model and flags in metadata", () => {
    const c = normalizeChatGptConversation({
      mapping: {},
      default_model_slug: "gpt-4o",
      is_archived: true,
      is_starred: false,
    });
    expect(c.metadata?.model).toBe("gpt-4o");
    expect(c.metadata?.isArchived).toBe(true);
    expect(c.metadata?.isStarred).toBe(false);
  });

  it("produces an empty messages array for a mapping with no real messages", () => {
    const c = normalizeChatGptConversation({
      mapping: {
        root: { id: "root", message: null, parent: null, children: [] },
      },
    });
    expect(c.messages).toEqual([]);
  });

  it("supports a flat messages[] array shape as a fallback", () => {
    const c = normalizeChatGptConversation({
      title: "Flat",
      messages: [
        { author: { role: "user" }, content: "hi" },
        { author: { role: "assistant" }, content: "" },
        { author: { role: "assistant" }, content: "yo" },
      ],
    });
    expect(c.messages.map((m) => m.content)).toEqual(["hi", "yo"]);
    expect(c.messages.map((m) => m.messageIndex)).toEqual([0, 1]);
  });
});

/* ----------------------- parseChatGptExportJson ----------------------- */

describe("parseChatGptExportJson", () => {
  const oneConvo = JSON.stringify([
    {
      id: "c1",
      title: "Hello",
      create_time: 1700000000,
      current_node: "b",
      mapping: {
        root: { id: "root", message: null, parent: null, children: ["a"] },
        a: {
          id: "a",
          parent: "root",
          children: ["b"],
          message: {
            id: "a",
            author: { role: "user" },
            content: { parts: ["hi"] },
          },
        },
        b: {
          id: "b",
          parent: "a",
          children: [],
          message: {
            id: "b",
            author: { role: "assistant" },
            content: { parts: ["hello back"] },
          },
        },
      },
    },
  ]);

  it("throws a friendly error on invalid JSON", () => {
    expect(() => parseChatGptExportJson("not json {")).toThrow(
      /could not parse/i,
    );
  });

  it("parses an array of conversations", () => {
    const convos = parseChatGptExportJson(oneConvo);
    expect(convos).toHaveLength(1);
    expect(convos[0].title).toBe("Hello");
    expect(convos[0].messages).toHaveLength(2);
  });

  it("accepts a top-level { conversations: [...] } wrapper", () => {
    const wrapped = JSON.stringify({ conversations: JSON.parse(oneConvo) });
    expect(parseChatGptExportJson(wrapped)).toHaveLength(1);
  });

  it("accepts a single conversation object (not in an array)", () => {
    const single = JSON.stringify(JSON.parse(oneConvo)[0]);
    const convos = parseChatGptExportJson(single);
    expect(convos).toHaveLength(1);
    expect(convos[0].title).toBe("Hello");
  });

  it("skips malformed entries but keeps valid ones", () => {
    const mixed = JSON.stringify([
      null,
      "garbage",
      JSON.parse(oneConvo)[0],
      42,
    ]);
    const convos = parseChatGptExportJson(mixed);
    expect(convos).toHaveLength(1);
    expect(convos[0].title).toBe("Hello");
  });

  it("returns [] for an empty array", () => {
    expect(parseChatGptExportJson("[]")).toEqual([]);
  });

  it("throws when the JSON is a bare scalar", () => {
    expect(() => parseChatGptExportJson('"just a string"')).toThrow(
      /recognizable shape/i,
    );
  });

  it("keeps conversations even when they have zero messages", () => {
    const emptyConvo = JSON.stringify([
      {
        title: "Empty one",
        mapping: {
          root: { id: "root", message: null, parent: null, children: [] },
        },
      },
    ]);
    const convos = parseChatGptExportJson(emptyConvo);
    expect(convos).toHaveLength(1);
    expect(convos[0].messages).toHaveLength(0);
  });
});
