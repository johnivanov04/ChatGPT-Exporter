import { describe, it, expect } from "vitest";
import { tryParseImportHash } from "./extensionImport";

function encode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const VALID = {
  id: "chatgpt-ext-1",
  title: "Hello",
  source: "browser_extension",
  createdAt: "2026-06-01T00:00:00.000Z",
  messages: [
    {
      id: "m1",
      role: "user",
      content: "hi",
      messageIndex: 0,
      metadata: { contentType: "text" },
    },
    {
      id: "m2",
      role: "assistant",
      content: "hello back",
      messageIndex: 1,
      metadata: { contentType: "text" },
    },
  ],
};

describe("tryParseImportHash", () => {
  it("returns null for an empty hash", () => {
    expect(tryParseImportHash("")).toBeNull();
  });

  it("returns null for a hash that isn't ours", () => {
    expect(tryParseImportHash("#section-1")).toBeNull();
  });

  it("returns null for malformed base64", () => {
    expect(tryParseImportHash("#import=not!valid!b64")).toBeNull();
  });

  it("returns null when the decoded payload isn't JSON", () => {
    const encoded = btoa("definitely not json")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(tryParseImportHash(`#import=${encoded}`)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const bad = encode({ id: "x", messages: [] }); // no title
    expect(tryParseImportHash(`#import=${bad}`)).toBeNull();
  });

  it("returns null when the conversation has no usable messages", () => {
    const bad = encode({
      id: "x",
      title: "t",
      messages: [{ id: "m1", role: "user", content: "   " }],
    });
    expect(tryParseImportHash(`#import=${bad}`)).toBeNull();
  });

  it("decodes a valid payload into a NormalizedConversation", () => {
    const out = tryParseImportHash(`#import=${encode(VALID)}`);
    expect(out).not.toBeNull();
    expect(out!.id).toBe("chatgpt-ext-1");
    expect(out!.title).toBe("Hello");
    expect(out!.source).toBe("browser_extension");
    expect(out!.messages).toHaveLength(2);
    expect(out!.messages[0].role).toBe("user");
    expect(out!.messages[1].role).toBe("assistant");
  });

  it("normalizes unknown roles to 'unknown'", () => {
    const payload = {
      ...VALID,
      messages: [
        { id: "m1", role: "weirdo", content: "x", messageIndex: 0 },
      ],
    };
    const out = tryParseImportHash(`#import=${encode(payload)}`);
    expect(out!.messages[0].role).toBe("unknown");
  });

  it("preserves unicode content correctly", () => {
    const payload = {
      ...VALID,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "héllo 🌍 中文",
          messageIndex: 0,
        },
      ],
    };
    const out = tryParseImportHash(`#import=${encode(payload)}`);
    expect(out!.messages[0].content).toBe("héllo 🌍 中文");
  });

  it("always sets source to 'browser_extension' even if payload claims otherwise", () => {
    const out = tryParseImportHash(
      `#import=${encode({ ...VALID, source: "chatgpt_export_zip" })}`,
    );
    expect(out!.source).toBe("browser_extension");
  });

  it("skips messages with empty content but keeps the rest", () => {
    const payload = {
      ...VALID,
      messages: [
        { id: "m1", role: "user", content: "real", messageIndex: 0 },
        { id: "m2", role: "assistant", content: "", messageIndex: 1 },
        { id: "m3", role: "user", content: "also real", messageIndex: 2 },
      ],
    };
    const out = tryParseImportHash(`#import=${encode(payload)}`);
    expect(out!.messages).toHaveLength(2);
    expect(out!.messages.map((m) => m.content)).toEqual([
      "real",
      "also real",
    ]);
  });
});
