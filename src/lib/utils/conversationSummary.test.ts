import { describe, it, expect } from "vitest";
import {
  firstUserMessagePreview,
  conversationTimestamp,
  sortConversationsNewestFirst,
  buildSearchText,
  filterConversations,
  findMessageSnippet,
  highlightSegments,
  isInternalMessage,
} from "./conversationSummary";
import type {
  NormalizedConversation,
  NormalizedMessage,
} from "../../types/conversation";

function msg(
  role: NormalizedMessage["role"],
  content: string,
  i = 0,
): NormalizedMessage {
  return { id: `m${i}`, role, content, messageIndex: i };
}

function convo(
  partial: Partial<NormalizedConversation> & { id: string },
): NormalizedConversation {
  return {
    title: "Untitled conversation",
    source: "chatgpt_export_zip",
    messages: [],
    ...partial,
  };
}

describe("firstUserMessagePreview", () => {
  it("returns empty string for a conversation with no messages", () => {
    expect(firstUserMessagePreview(convo({ id: "a" }))).toBe("");
  });

  it("returns the first user message", () => {
    const c = convo({
      id: "a",
      messages: [
        msg("system", "you are a bot", 0),
        msg("user", "hello there", 1),
        msg("assistant", "hi", 2),
      ],
    });
    expect(firstUserMessagePreview(c)).toBe("hello there");
  });

  it("falls back to the first message when there is no user message", () => {
    const c = convo({
      id: "a",
      messages: [msg("assistant", "I speak first", 0)],
    });
    expect(firstUserMessagePreview(c)).toBe("I speak first");
  });

  it("collapses internal whitespace and newlines to single spaces", () => {
    const c = convo({
      id: "a",
      messages: [msg("user", "line1\n\n  line2\t\tline3", 0)],
    });
    expect(firstUserMessagePreview(c)).toBe("line1 line2 line3");
  });

  it("truncates long previews and appends an ellipsis", () => {
    const c = convo({ id: "a", messages: [msg("user", "x".repeat(200), 0)] });
    const out = firstUserMessagePreview(c, 50);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(51);
  });

  it("does not truncate when within the limit", () => {
    const c = convo({ id: "a", messages: [msg("user", "short", 0)] });
    expect(firstUserMessagePreview(c, 50)).toBe("short");
  });
});

describe("conversationTimestamp", () => {
  it("prefers updatedAt over createdAt", () => {
    const c = convo({
      id: "a",
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2021-01-01T00:00:00.000Z",
    });
    expect(conversationTimestamp(c)).toBe(Date.parse("2021-01-01T00:00:00.000Z"));
  });

  it("falls back to createdAt when updatedAt is missing", () => {
    const c = convo({ id: "a", createdAt: "2020-01-01T00:00:00.000Z" });
    expect(conversationTimestamp(c)).toBe(Date.parse("2020-01-01T00:00:00.000Z"));
  });

  it("returns -Infinity when there is no date", () => {
    expect(conversationTimestamp(convo({ id: "a" }))).toBe(
      Number.NEGATIVE_INFINITY,
    );
  });

  it("returns -Infinity for an unparseable date", () => {
    expect(conversationTimestamp(convo({ id: "a", updatedAt: "nope" }))).toBe(
      Number.NEGATIVE_INFINITY,
    );
  });
});

describe("sortConversationsNewestFirst", () => {
  it("sorts by timestamp descending", () => {
    const list = [
      convo({ id: "old", updatedAt: "2020-01-01T00:00:00.000Z" }),
      convo({ id: "new", updatedAt: "2023-01-01T00:00:00.000Z" }),
      convo({ id: "mid", updatedAt: "2021-06-01T00:00:00.000Z" }),
    ];
    expect(sortConversationsNewestFirst(list).map((c) => c.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("places undated conversations last", () => {
    const list = [
      convo({ id: "undated" }),
      convo({ id: "dated", updatedAt: "2022-01-01T00:00:00.000Z" }),
    ];
    expect(sortConversationsNewestFirst(list).map((c) => c.id)).toEqual([
      "dated",
      "undated",
    ]);
  });

  it("keeps original order among equally-undated conversations (stable)", () => {
    const list = [
      convo({ id: "a" }),
      convo({ id: "b" }),
      convo({ id: "c" }),
    ];
    expect(sortConversationsNewestFirst(list).map((c) => c.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("does not mutate the input array", () => {
    const list = [
      convo({ id: "a", updatedAt: "2020-01-01T00:00:00.000Z" }),
      convo({ id: "b", updatedAt: "2023-01-01T00:00:00.000Z" }),
    ];
    const before = list.map((c) => c.id);
    sortConversationsNewestFirst(list);
    expect(list.map((c) => c.id)).toEqual(before);
  });
});

describe("buildSearchText", () => {
  it("includes the title and all message content, lowercased", () => {
    const c = convo({
      id: "a",
      title: "Linear Algebra",
      messages: [msg("user", "What is a BASIS?", 0), msg("assistant", "A set", 1)],
    });
    const blob = buildSearchText(c);
    expect(blob).toContain("linear algebra");
    expect(blob).toContain("what is a basis?");
    expect(blob).toContain("a set");
    expect(blob).toBe(blob.toLowerCase());
  });
});

describe("isInternalMessage", () => {
  const make = (
    role: NormalizedMessage["role"],
    contentType?: string,
  ): NormalizedMessage => ({
    id: "x",
    role,
    content: "x",
    messageIndex: 0,
    metadata: contentType ? { contentType } : undefined,
  });

  it("flags system messages as internal", () => {
    expect(isInternalMessage(make("system", "text"))).toBe(true);
  });

  it("flags tool messages as internal regardless of content type", () => {
    expect(isInternalMessage(make("tool", "thoughts"))).toBe(true);
    expect(isInternalMessage(make("tool", "execution_output"))).toBe(true);
    expect(isInternalMessage(make("tool", "tether_browsing_display"))).toBe(true);
  });

  it("flags assistant/code (tool-call) as internal", () => {
    expect(isInternalMessage(make("assistant", "code"))).toBe(true);
  });

  it("does NOT flag assistant/text as internal", () => {
    expect(isInternalMessage(make("assistant", "text"))).toBe(false);
  });

  it("does NOT flag assistant/multimodal_text as internal", () => {
    expect(isInternalMessage(make("assistant", "multimodal_text"))).toBe(false);
  });

  it("does NOT flag user messages as internal", () => {
    expect(isInternalMessage(make("user", "text"))).toBe(false);
  });

  it("treats unknown role with no metadata as non-internal", () => {
    expect(isInternalMessage(make("unknown"))).toBe(false);
  });
});

describe("filterConversations", () => {
  const list = [
    convo({
      id: "1",
      title: "Linear Algebra",
      messages: [msg("user", "what is a basis", 0)],
    }),
    convo({
      id: "2",
      title: "Cooking pasta",
      messages: [msg("user", "how long to boil", 0)],
    }),
    convo({
      id: "3",
      title: "React hooks",
      messages: [msg("user", "useEffect cleanup", 0)],
    }),
  ];
  const index = new Map(list.map((c) => [c.id, buildSearchText(c)]));

  it("returns all conversations for an empty query", () => {
    expect(filterConversations(list, "", index)).toHaveLength(3);
  });

  it("returns all conversations for a whitespace-only query", () => {
    expect(filterConversations(list, "   ", index)).toHaveLength(3);
  });

  it("matches on title, case-insensitively", () => {
    expect(filterConversations(list, "REACT", index).map((c) => c.id)).toEqual([
      "3",
    ]);
  });

  it("matches on message content", () => {
    expect(filterConversations(list, "boil", index).map((c) => c.id)).toEqual([
      "2",
    ]);
  });

  it("requires all space-separated terms to be present (AND)", () => {
    expect(
      filterConversations(list, "linear basis", index).map((c) => c.id),
    ).toEqual(["1"]);
    expect(filterConversations(list, "linear pasta", index)).toHaveLength(0);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterConversations(list, "zzzzz", index)).toHaveLength(0);
  });

  it("falls back to computing search text when the index lacks an entry", () => {
    expect(
      filterConversations(list, "react", new Map()).map((c) => c.id),
    ).toEqual(["3"]);
  });
});

describe("findMessageSnippet", () => {
  const c = convo({
    id: "1",
    title: "Refactor notes",
    messages: [
      msg("user", "Quick question about hashing functions", 0),
      msg(
        "assistant",
        "Sure. To deduplicate lines you can use a set as a membership filter. The deduplicate step is O(n).",
        1,
      ),
    ],
  });

  it("returns null when the query is empty", () => {
    expect(findMessageSnippet(c, "")).toBeNull();
    expect(findMessageSnippet(c, "   ")).toBeNull();
  });

  it("returns null when no message body contains the query", () => {
    expect(findMessageSnippet(c, "zzz")).toBeNull();
  });

  it("returns null when the match is in the title only (caller falls back to preview)", () => {
    // 'refactor' only appears in title, not in any message body
    expect(findMessageSnippet(c, "refactor")).toBeNull();
  });

  it("returns a snippet around the first matching message", () => {
    const snippet = findMessageSnippet(c, "deduplicate");
    expect(snippet).toContain("deduplicate");
    // snippet should be a windowed substring, not the whole message
    expect(snippet?.length).toBeLessThan(220);
  });

  it("collapses whitespace inside the snippet", () => {
    const noisy = convo({
      id: "noisy",
      title: "x",
      messages: [
        msg(
          "assistant",
          "some text\n\n\nwith   linebreaks\tand     tabs around match here",
          0,
        ),
      ],
    });
    const snippet = findMessageSnippet(noisy, "match");
    expect(snippet).not.toMatch(/\s{2,}/);
    expect(snippet).not.toContain("\t");
    expect(snippet).not.toContain("\n");
  });

  it("prefixes/suffixes with ellipsis when the match is mid-message", () => {
    const long = convo({
      id: "long",
      title: "x",
      messages: [
        msg(
          "assistant",
          "a".repeat(400) + " needle " + "z".repeat(400),
          0,
        ),
      ],
    });
    const snippet = findMessageSnippet(long, "needle");
    expect(snippet?.startsWith("…")).toBe(true);
    expect(snippet?.endsWith("…")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(findMessageSnippet(c, "DEDUPLICATE")).toContain("deduplicate");
  });

  it("matches on whichever query term appears earliest in the message", () => {
    const m = convo({
      id: "m",
      title: "x",
      messages: [msg("assistant", "alpha then beta then gamma", 0)],
    });
    // 'beta' appears before 'gamma' in the message text
    const snippet = findMessageSnippet(m, "gamma beta");
    expect(snippet).toContain("beta");
  });
});

describe("highlightSegments", () => {
  it("returns a single non-match segment when query is empty", () => {
    const segs = highlightSegments("hello world", "");
    expect(segs).toEqual([{ text: "hello world", match: false }]);
  });

  it("returns a single non-match segment when text is empty", () => {
    expect(highlightSegments("", "hello")).toEqual([{ text: "", match: false }]);
  });

  it("wraps single matches", () => {
    expect(highlightSegments("hello world", "world")).toEqual([
      { text: "hello ", match: false },
      { text: "world", match: true },
    ]);
  });

  it("is case-insensitive and preserves original casing in output", () => {
    const segs = highlightSegments("Hello World", "WORLD");
    expect(segs).toEqual([
      { text: "Hello ", match: false },
      { text: "World", match: true },
    ]);
  });

  it("wraps multiple non-overlapping matches", () => {
    expect(highlightSegments("foo bar foo bar", "foo")).toEqual([
      { text: "foo", match: true },
      { text: " bar ", match: false },
      { text: "foo", match: true },
      { text: " bar", match: false },
    ]);
  });

  it("merges overlapping match ranges from multiple terms", () => {
    // 'hello' and 'lloworld' overlap inside 'helloworld'
    const segs = highlightSegments("helloworld", "hello llowor");
    expect(segs.filter((s) => s.match).length).toBe(1);
    expect(segs.find((s) => s.match)?.text).toBe("hellowor");
  });

  it("handles multiple space-separated terms", () => {
    const segs = highlightSegments("alpha beta gamma", "alpha gamma");
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual([
      "alpha",
      "gamma",
    ]);
  });

  it("returns the whole string as non-match when no term hits", () => {
    expect(highlightSegments("hello world", "xxx")).toEqual([
      { text: "hello world", match: false },
    ]);
  });
});
