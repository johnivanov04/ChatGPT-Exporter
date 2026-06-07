import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  buildAttachmentsOnlyZip,
  buildJsonZip,
  buildMarkdownZip,
  hasDownloadableAttachments,
  summarizeAttachments,
} from "./buildExportZip";
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  type NormalizedConversation,
} from "../../types/conversation";

const FIXED_NOW = new Date("2026-06-01T00:00:00.000Z");

function opts(partial: Partial<ExportOptions> = {}): ExportOptions {
  return { ...DEFAULT_EXPORT_OPTIONS, ...partial };
}

// Tiny base64 payload: the bytes "hi" → "aGk=" (base64). Used to keep tests
// fast and deterministic.
const HI_BASE64 = "aGk=";

function makeConvo(): NormalizedConversation {
  return {
    id: "c1",
    title: "Sample",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    source: "browser_extension",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "look at this",
        messageIndex: 0,
        attachments: [
          {
            filename: "paper.pdf",
            mimeType: "application/pdf",
            size: 2,
            dataBase64: HI_BASE64,
          },
        ],
      },
      {
        id: "m2",
        role: "assistant",
        content: "got it",
        messageIndex: 1,
      },
    ],
  };
}

describe("hasDownloadableAttachments", () => {
  it("returns true when at least one attachment has dataBase64", () => {
    expect(hasDownloadableAttachments(makeConvo())).toBe(true);
  });

  it("returns false when attachments only have fetchError", () => {
    const c = makeConvo();
    c.messages[0].attachments = [
      { filename: "x.pdf", fetchError: "HTTP 403" },
    ];
    expect(hasDownloadableAttachments(c)).toBe(false);
  });

  it("returns false when no messages have attachments at all", () => {
    const c = makeConvo();
    delete c.messages[0].attachments;
    expect(hasDownloadableAttachments(c)).toBe(false);
  });
});

describe("summarizeAttachments", () => {
  it("counts total, downloadable, and errored attachments", () => {
    const c = makeConvo();
    c.messages.push({
      id: "m3",
      role: "user",
      content: "and this",
      messageIndex: 2,
      attachments: [
        { filename: "ok.png", dataBase64: HI_BASE64 },
        { filename: "broken.pdf", fetchError: "HTTP 403" },
      ],
    });
    expect(summarizeAttachments(c)).toEqual({
      total: 3,
      downloadable: 2,
      withErrors: 1,
    });
  });

  it("returns zeros when no attachments anywhere", () => {
    const c = makeConvo();
    delete c.messages[0].attachments;
    expect(summarizeAttachments(c)).toEqual({
      total: 0,
      downloadable: 0,
      withErrors: 0,
    });
  });
});

describe("buildMarkdownZip", () => {
  it("produces a ZIP containing the markdown plus an attachments folder", async () => {
    const blob = await buildMarkdownZip(makeConvo(), opts(), "out", FIXED_NOW);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files).sort();
    expect(names).toContain("out.md");
    expect(names).toContain("attachments/paper.pdf");
  });

  it("includes the redacted markdown content", async () => {
    const c = makeConvo();
    c.messages[0].content = "email me at a@b.com";
    const blob = await buildMarkdownZip(
      c,
      opts({ redactEmails: true }),
      "out",
      FIXED_NOW,
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const md = await zip.file("out.md")!.async("string");
    expect(md).toContain("[REDACTED_EMAIL]");
    expect(md).not.toContain("a@b.com");
  });

  it("deduplicates filenames when the same name appears twice", async () => {
    const c = makeConvo();
    c.messages.push({
      id: "m3",
      role: "user",
      content: "again",
      messageIndex: 2,
      attachments: [
        { filename: "paper.pdf", dataBase64: HI_BASE64 },
      ],
    });
    const blob = await buildMarkdownZip(c, opts(), "out", FIXED_NOW);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files);
    expect(names).toContain("attachments/paper.pdf");
    expect(names).toContain("attachments/paper-1.pdf");
  });

  it("sanitizes filenames to prevent directory traversal", async () => {
    const c = makeConvo();
    c.messages[0].attachments = [
      { filename: "../../etc/passwd", dataBase64: HI_BASE64 },
    ];
    const blob = await buildMarkdownZip(c, opts(), "out", FIXED_NOW);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const attachmentEntries = Object.values(zip.files).filter(
      (f) => !f.dir && f.name.startsWith("attachments/"),
    );
    // Slashes are stripped so the path can't escape attachments/.
    for (const entry of attachmentEntries) {
      const relative = entry.name.replace(/^attachments\//, "");
      expect(relative.includes("/")).toBe(false);
    }
    expect(attachmentEntries.length).toBe(1);
  });

  it("skips attachments that don't have dataBase64", async () => {
    const c = makeConvo();
    c.messages[0].attachments = [
      { filename: "ok.pdf", dataBase64: HI_BASE64 },
      { filename: "broken.pdf", fetchError: "HTTP 403" },
    ];
    const blob = await buildMarkdownZip(c, opts(), "out", FIXED_NOW);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files);
    expect(names).toContain("attachments/ok.pdf");
    expect(names).not.toContain("attachments/broken.pdf");
  });
});

describe("buildJsonZip", () => {
  it("produces a ZIP containing the JSON plus attachments", async () => {
    const blob = await buildJsonZip(makeConvo(), opts(), "out", FIXED_NOW);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)).toContain("out.json");
    expect(Object.keys(zip.files)).toContain("attachments/paper.pdf");
  });

  it("contains valid JSON inside the archive", async () => {
    const blob = await buildJsonZip(makeConvo(), opts(), "out", FIXED_NOW);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const json = await zip.file("out.json")!.async("string");
    const parsed = JSON.parse(json);
    expect(parsed.exporter?.name).toBe("chatvault");
  });
});

describe("buildAttachmentsOnlyZip", () => {
  it("contains only the attachments folder, no transcript", async () => {
    const blob = await buildAttachmentsOnlyZip(makeConvo(), opts());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files);
    expect(names).toContain("attachments/paper.pdf");
    expect(names.every((n) => !n.endsWith(".md") && !n.endsWith(".json"))).toBe(
      true,
    );
  });
});
