import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PrintView } from "./PrintView";
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  type NormalizedConversation,
} from "../types/conversation";

const FIXED_NOW = new Date("2026-05-28T12:00:00.000Z");

function opts(p: Partial<ExportOptions> = {}): ExportOptions {
  return { ...DEFAULT_EXPORT_OPTIONS, ...p };
}

function convo(): NormalizedConversation {
  return {
    id: "c1",
    title: "Print Me",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    source: "chatgpt_export_zip",
    metadata: { model: "gpt-4o" },
    messages: [
      {
        id: "m1",
        role: "user",
        content: "**hello**",
        createdAt: "2026-05-01T00:00:00.000Z",
        messageIndex: 0,
        metadata: { contentType: "text" },
      },
      {
        id: "m2",
        role: "assistant",
        content: "print('hi')",
        createdAt: "2026-05-01T00:00:01.000Z",
        messageIndex: 1,
        metadata: { contentType: "code" },
      },
    ],
  };
}

describe("PrintView", () => {
  it("renders inside a .print-only container", () => {
    const html = renderToStaticMarkup(
      <PrintView conversation={convo()} options={opts()} now={FIXED_NOW} />,
    );
    expect(html).toContain('class="print-only print-root"');
  });

  it("renders the cover page when includeMetadataPage is true", () => {
    const html = renderToStaticMarkup(
      <PrintView conversation={convo()} options={opts()} now={FIXED_NOW} />,
    );
    expect(html).toContain("print-cover");
    expect(html).toContain("Print Me");
    expect(html).toContain("Created");
    expect(html).toContain("Updated");
    expect(html).toContain("Exported");
  });

  it("omits the cover page when includeMetadataPage is false but still shows the title", () => {
    const html = renderToStaticMarkup(
      <PrintView
        conversation={convo()}
        options={opts({ includeMetadataPage: false })}
        now={FIXED_NOW}
      />,
    );
    expect(html).not.toContain("print-cover");
    expect(html).toContain("print-transcript-title");
    expect(html).toContain("Print Me");
  });

  it("omits source/model on the cover when includeSourceMetadata is false", () => {
    const html = renderToStaticMarkup(
      <PrintView
        conversation={convo()}
        options={opts({ includeSourceMetadata: false })}
        now={FIXED_NOW}
      />,
    );
    expect(html).not.toContain("chatgpt_export_zip");
    expect(html).not.toContain("gpt-4o");
  });

  it("renders user message markdown (** -> <strong>)", () => {
    const html = renderToStaticMarkup(
      <PrintView conversation={convo()} options={opts()} now={FIXED_NOW} />,
    );
    expect(html).toContain("<strong>hello</strong>");
  });

  it("renders code-type messages inside <pre><code>", () => {
    const html = renderToStaticMarkup(
      <PrintView conversation={convo()} options={opts()} now={FIXED_NOW} />,
    );
    expect(html).toContain("<pre><code>print(&#x27;hi&#x27;)</code></pre>");
  });

  it("applies role-distinct classes to messages", () => {
    const html = renderToStaticMarkup(
      <PrintView conversation={convo()} options={opts()} now={FIXED_NOW} />,
    );
    expect(html).toContain("print-message-user");
    expect(html).toContain("print-message-assistant");
  });

  it("includes #N prefix when includeMessageNumbers is true", () => {
    const html = renderToStaticMarkup(
      <PrintView conversation={convo()} options={opts()} now={FIXED_NOW} />,
    );
    expect(html).toContain("#1 · user");
    expect(html).toContain("#2 · assistant");
  });

  it("omits #N prefix when includeMessageNumbers is false", () => {
    const html = renderToStaticMarkup(
      <PrintView
        conversation={convo()}
        options={opts({ includeMessageNumbers: false })}
        now={FIXED_NOW}
      />,
    );
    expect(html).not.toContain("#1 · user");
  });
});
