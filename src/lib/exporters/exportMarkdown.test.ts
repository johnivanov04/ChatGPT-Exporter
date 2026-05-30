import { describe, it, expect } from "vitest";
import { exportMarkdown } from "./exportMarkdown";
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  type NormalizedConversation,
} from "../../types/conversation";

const FIXED_NOW = new Date("2026-05-28T12:00:00.000Z");

function opts(partial: Partial<ExportOptions> = {}): ExportOptions {
  return { ...DEFAULT_EXPORT_OPTIONS, ...partial };
}

function makeConvo(
  partial: Partial<NormalizedConversation> = {},
): NormalizedConversation {
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
        content: "hi there",
        createdAt: "2026-05-01T00:00:00.000Z",
        messageIndex: 0,
      },
      {
        id: "m2",
        role: "assistant",
        content: "hello back\n\nhow can I help?",
        createdAt: "2026-05-01T00:00:01.000Z",
        messageIndex: 1,
      },
    ],
    ...partial,
  };
}

describe("exportMarkdown", () => {
  it("includes the title as a level-1 heading", () => {
    const md = exportMarkdown(makeConvo(), opts(), FIXED_NOW);
    expect(md).toMatch(/^# Hello World/);
  });

  it("includes a metadata block when includeMetadataPage is true", () => {
    const md = exportMarkdown(makeConvo(), opts(), FIXED_NOW);
    expect(md).toContain("**Created:**");
    expect(md).toContain("**Updated:**");
    expect(md).toContain("**Exported:**");
    expect(md).toContain("**Messages:** 2");
    expect(md).toContain("**Source:** chatgpt_export_zip");
    expect(md).toContain("**Model:** gpt-4o");
    expect(md).toContain("\n---\n");
  });

  it("omits the metadata block when includeMetadataPage is false", () => {
    const md = exportMarkdown(
      makeConvo(),
      opts({ includeMetadataPage: false }),
      FIXED_NOW,
    );
    expect(md).not.toContain("**Created:**");
    expect(md).not.toContain("\n---\n");
  });

  it("omits source/model when includeSourceMetadata is false", () => {
    const md = exportMarkdown(
      makeConvo(),
      opts({ includeSourceMetadata: false }),
      FIXED_NOW,
    );
    expect(md).not.toContain("**Source:**");
    expect(md).not.toContain("**Model:**");
  });

  it("renders message headings with role only by default", () => {
    const md = exportMarkdown(
      makeConvo(),
      opts({ includeMessageNumbers: false, includeTimestamps: false }),
      FIXED_NOW,
    );
    expect(md).toContain("## user\n");
    expect(md).toContain("## assistant\n");
    expect(md).not.toContain("#1");
  });

  it("includes #N when includeMessageNumbers is true", () => {
    const md = exportMarkdown(
      makeConvo(),
      opts({ includeTimestamps: false }),
      FIXED_NOW,
    );
    expect(md).toMatch(/## #1 · user/);
    expect(md).toMatch(/## #2 · assistant/);
  });

  it("includes timestamps when includeTimestamps is true", () => {
    const md = exportMarkdown(
      makeConvo(),
      opts({ includeMessageNumbers: false }),
      FIXED_NOW,
    );
    expect(md).toMatch(/## user · \d/);
  });

  it("includes both message numbers and timestamps when both enabled", () => {
    const md = exportMarkdown(makeConvo(), opts(), FIXED_NOW);
    expect(md).toMatch(/## #1 · user · /);
  });

  it("preserves message body contents", () => {
    const md = exportMarkdown(makeConvo(), opts(), FIXED_NOW);
    expect(md).toContain("hi there");
    expect(md).toContain("hello back");
    expect(md).toContain("how can I help?");
  });

  it("collapses 3+ consecutive blank lines to 2", () => {
    const md = exportMarkdown(
      makeConvo({
        messages: [
          {
            id: "x",
            role: "user",
            content: "a\n\n\n\nb",
            messageIndex: 0,
          },
        ],
      }),
      opts(),
      FIXED_NOW,
    );
    expect(md).not.toMatch(/\n{3,}/);
  });

  it("applies redaction to message content", () => {
    const md = exportMarkdown(
      makeConvo({
        messages: [
          {
            id: "x",
            role: "user",
            content: "email me at a@b.com",
            messageIndex: 0,
          },
        ],
      }),
      opts({ redactEmails: true }),
      FIXED_NOW,
    );
    expect(md).toContain("[REDACTED_EMAIL]");
    expect(md).not.toContain("a@b.com");
  });

  it("handles a conversation with zero messages without crashing", () => {
    const md = exportMarkdown(
      makeConvo({ messages: [] }),
      opts(),
      FIXED_NOW,
    );
    expect(md).toContain("# Hello World");
    expect(md).toContain("**Messages:** 0");
  });

  it("ends with a single trailing newline", () => {
    const md = exportMarkdown(makeConvo(), opts(), FIXED_NOW);
    expect(md.endsWith("\n")).toBe(true);
    expect(md.endsWith("\n\n")).toBe(false);
  });

  it("does not show 'Updated' line when updated equals created", () => {
    const md = exportMarkdown(
      makeConvo({ updatedAt: "2026-05-01T00:00:00.000Z" }),
      opts(),
      FIXED_NOW,
    );
    expect(md).not.toContain("**Updated:**");
  });
});
