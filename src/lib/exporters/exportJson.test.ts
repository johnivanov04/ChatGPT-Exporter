import { describe, it, expect } from "vitest";
import { exportJson, EXPORTER_NAME, EXPORTER_VERSION } from "./exportJson";
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  type NormalizedConversation,
} from "../../types/conversation";

const FIXED_NOW = new Date("2026-05-28T12:00:00.000Z");

function opts(partial: Partial<ExportOptions> = {}): ExportOptions {
  return { ...DEFAULT_EXPORT_OPTIONS, ...partial };
}

function makeConvo(): NormalizedConversation {
  return {
    id: "c1",
    title: "Hello World",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    source: "chatgpt_export_zip",
    metadata: { model: "gpt-4o" },
    messages: [
      {
        id: "m1",
        role: "user",
        content: "hi",
        createdAt: "2026-05-01T00:00:00.000Z",
        messageIndex: 0,
        metadata: { contentType: "text" },
      },
      {
        id: "m2",
        role: "assistant",
        content: "yo",
        createdAt: "2026-05-01T00:00:01.000Z",
        messageIndex: 1,
        metadata: { contentType: "text" },
      },
    ],
  };
}

function parse(s: string) {
  return JSON.parse(s) as Record<string, unknown>;
}

describe("exportJson", () => {
  it("returns pretty-printed JSON with a trailing newline", () => {
    const out = exportJson(makeConvo(), opts(), FIXED_NOW);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.includes("\n  ")).toBe(true); // 2-space indent present
  });

  it("wraps in an envelope when includeMetadataPage is true", () => {
    const out = parse(exportJson(makeConvo(), opts(), FIXED_NOW));
    expect(out.exporter).toEqual({
      name: EXPORTER_NAME,
      version: EXPORTER_VERSION,
    });
    expect(out.exportedAt).toBe("2026-05-28T12:00:00.000Z");
    expect(out.conversation).toBeDefined();
  });

  it("emits the bare conversation when includeMetadataPage is false", () => {
    const out = parse(
      exportJson(makeConvo(), opts({ includeMetadataPage: false }), FIXED_NOW),
    );
    expect(out.exporter).toBeUndefined();
    expect(out.title).toBe("Hello World");
    expect(Array.isArray(out.messages)).toBe(true);
  });

  it("includes message timestamps only when includeTimestamps is true", () => {
    const withTs = parse(exportJson(makeConvo(), opts(), FIXED_NOW));
    const convo = withTs.conversation as Record<string, unknown>;
    const msgs = convo.messages as Array<Record<string, unknown>>;
    expect(msgs[0].createdAt).toBe("2026-05-01T00:00:00.000Z");

    const noTs = parse(
      exportJson(makeConvo(), opts({ includeTimestamps: false }), FIXED_NOW),
    );
    const convo2 = noTs.conversation as Record<string, unknown>;
    const msgs2 = convo2.messages as Array<Record<string, unknown>>;
    expect(msgs2[0].createdAt).toBeUndefined();
    expect(convo2.createdAt).toBeUndefined();
  });

  it("includes per-message metadata only when includeSourceMetadata is true", () => {
    const withMeta = parse(exportJson(makeConvo(), opts(), FIXED_NOW));
    const c = withMeta.conversation as Record<string, unknown>;
    const msgs = c.messages as Array<Record<string, unknown>>;
    expect(msgs[0].metadata).toEqual({ contentType: "text" });
    expect(c.metadata).toEqual({ model: "gpt-4o" });

    const noMeta = parse(
      exportJson(
        makeConvo(),
        opts({ includeSourceMetadata: false }),
        FIXED_NOW,
      ),
    );
    const c2 = noMeta.conversation as Record<string, unknown>;
    const msgs2 = c2.messages as Array<Record<string, unknown>>;
    expect(msgs2[0].metadata).toBeUndefined();
    expect(c2.metadata).toBeUndefined();
  });

  it("always includes id, role, content, messageIndex on each message", () => {
    const out = parse(
      exportJson(
        makeConvo(),
        opts({ includeTimestamps: false, includeSourceMetadata: false }),
        FIXED_NOW,
      ),
    );
    const c = out.conversation as Record<string, unknown>;
    const msgs = c.messages as Array<Record<string, unknown>>;
    expect(msgs[0]).toMatchObject({
      id: "m1",
      role: "user",
      content: "hi",
      messageIndex: 0,
    });
  });

  it("applies redaction before serializing", () => {
    const convo = makeConvo();
    convo.messages[0].content = "email a@b.com";
    const out = exportJson(convo, opts({ redactEmails: true }), FIXED_NOW);
    expect(out).toContain("[REDACTED_EMAIL]");
    expect(out).not.toContain("a@b.com");
  });

  it("produces valid JSON for a conversation with zero messages", () => {
    const empty: NormalizedConversation = {
      ...makeConvo(),
      messages: [],
    };
    const parsed = parse(exportJson(empty, opts(), FIXED_NOW));
    const c = parsed.conversation as Record<string, unknown>;
    expect(c.messages).toEqual([]);
  });
});
