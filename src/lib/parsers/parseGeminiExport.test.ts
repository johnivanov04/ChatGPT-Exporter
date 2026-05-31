import { describe, it, expect } from "vitest";
import { parseGeminiActivityJson } from "./parseGeminiExport";

// Takeout emits activities newest-first; the parser reverses to chronological.
const NEWEST_FIRST_SAMPLE = JSON.stringify([
  {
    header: "Gemini Apps",
    title: "Gemini said: A basis is a maximal linearly independent set.",
    time: "2026-05-01T00:00:30.000Z",
    products: ["Gemini Apps"],
  },
  {
    header: "Gemini Apps",
    title: "Asked: What is a basis?",
    time: "2026-05-01T00:00:00.000Z",
    products: ["Gemini Apps"],
  },
]);

describe("parseGeminiActivityJson", () => {
  it("throws on invalid JSON", () => {
    expect(() => parseGeminiActivityJson("not json {")).toThrow(
      /could not parse/i,
    );
  });

  it("throws when the root is not an array", () => {
    expect(() => parseGeminiActivityJson('{"foo":1}')).toThrow(
      /array/i,
    );
  });

  it("returns [] for an empty activity log", () => {
    expect(parseGeminiActivityJson("[]")).toEqual([]);
  });

  it("sets source to gemini_takeout", () => {
    const c = parseGeminiActivityJson(NEWEST_FIRST_SAMPLE);
    expect(c[0].source).toBe("gemini_takeout");
  });

  it("reverses Takeout's newest-first order to chronological", () => {
    const c = parseGeminiActivityJson(NEWEST_FIRST_SAMPLE);
    expect(c[0].messages.map((m) => m.content)).toEqual([
      "What is a basis?",
      "A basis is a maximal linearly independent set.",
    ]);
  });

  it("classifies 'Asked:' as user and 'Gemini said:' as assistant", () => {
    const c = parseGeminiActivityJson(NEWEST_FIRST_SAMPLE);
    expect(c[0].messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("classifies 'Bard said:' as assistant (older export)", () => {
    const json = JSON.stringify([
      {
        title: "Bard said: legacy answer",
        time: "2026-01-01T00:00:00.000Z",
        products: ["Bard"],
      },
    ]);
    const c = parseGeminiActivityJson(json);
    expect(c[0].messages[0].role).toBe("assistant");
  });

  it("skips navigation markers like 'Visited Gemini Apps'", () => {
    const json = JSON.stringify([
      {
        title: "Visited Gemini Apps",
        time: "2026-05-01T00:00:01.000Z",
        products: ["Gemini Apps"],
      },
      {
        title: "Asked: real prompt",
        time: "2026-05-01T00:00:00.000Z",
        products: ["Gemini Apps"],
      },
    ]);
    const c = parseGeminiActivityJson(json);
    expect(c[0].messages).toHaveLength(1);
    expect(c[0].messages[0].content).toBe("real prompt");
  });

  it("groups events within the session-gap window into one conversation", () => {
    const json = JSON.stringify([
      {
        title: "Gemini said: second response",
        time: "2026-05-01T00:05:00.000Z",
      },
      {
        title: "Asked: follow up",
        time: "2026-05-01T00:04:30.000Z",
      },
      {
        title: "Gemini said: first response",
        time: "2026-05-01T00:00:30.000Z",
      },
      {
        title: "Asked: initial",
        time: "2026-05-01T00:00:00.000Z",
      },
    ]);
    const c = parseGeminiActivityJson(json);
    expect(c).toHaveLength(1);
    expect(c[0].messages).toHaveLength(4);
  });

  it("splits events more than session-gap apart into separate conversations", () => {
    const json = JSON.stringify([
      {
        title: "Asked: much later",
        time: "2026-05-01T02:00:00.000Z",
      },
      {
        title: "Gemini said: response",
        time: "2026-05-01T00:00:30.000Z",
      },
      {
        title: "Asked: original",
        time: "2026-05-01T00:00:00.000Z",
      },
    ]);
    const c = parseGeminiActivityJson(json);
    expect(c).toHaveLength(2);
    expect(c[0].messages).toHaveLength(2);
    expect(c[1].messages).toHaveLength(1);
  });

  it("respects a custom sessionGapMs option", () => {
    const json = JSON.stringify([
      {
        title: "Asked: B",
        time: "2026-05-01T00:02:00.000Z",
      },
      {
        title: "Asked: A",
        time: "2026-05-01T00:00:00.000Z",
      },
    ]);
    // 60-second gap → should split
    const split = parseGeminiActivityJson(json, { sessionGapMs: 60_000 });
    expect(split).toHaveLength(2);
    // 10-minute gap → should group
    const grouped = parseGeminiActivityJson(json, { sessionGapMs: 600_000 });
    expect(grouped).toHaveLength(1);
  });

  it("alternates inferred roles for unlabeled titles, starting with user", () => {
    const json = JSON.stringify([
      { title: "third unlabeled", time: "2026-05-01T00:00:30.000Z" },
      { title: "second unlabeled", time: "2026-05-01T00:00:20.000Z" },
      { title: "first unlabeled", time: "2026-05-01T00:00:10.000Z" },
    ]);
    const c = parseGeminiActivityJson(json);
    expect(c[0].messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
  });

  it("uses the first user message as the session title (truncated)", () => {
    const longPrompt = "a".repeat(120);
    const json = JSON.stringify([
      {
        title: `Asked: ${longPrompt}`,
        time: "2026-05-01T00:00:00.000Z",
      },
    ]);
    const c = parseGeminiActivityJson(json);
    expect(c[0].title.endsWith("…")).toBe(true);
    expect(c[0].title.length).toBeLessThanOrEqual(61);
  });
});
