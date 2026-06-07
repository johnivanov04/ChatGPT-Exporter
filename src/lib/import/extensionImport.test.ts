import { describe, it, expect } from "vitest";
import {
  tryParseImportHash,
  tryParseImportMessage,
  validateImportPayload,
} from "./extensionImport";

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

  it("decodes a valid payload into a NormalizedConversation", () => {
    const out = tryParseImportHash(`#import=${encode(VALID)}`);
    expect(out).not.toBeNull();
    expect(out!.title).toBe("Hello");
    expect(out!.messages).toHaveLength(2);
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
});

describe("tryParseImportMessage", () => {
  it("returns null for non-object data", () => {
    expect(tryParseImportMessage(null)).toBeNull();
    expect(tryParseImportMessage("string")).toBeNull();
    expect(tryParseImportMessage(42)).toBeNull();
  });

  it("returns null when the message type isn't ours", () => {
    expect(
      tryParseImportMessage({ type: "something-else", payload: VALID }),
    ).toBeNull();
  });

  it("returns null when payload is missing", () => {
    expect(tryParseImportMessage({ type: "chatvault:import" })).toBeNull();
  });

  it("accepts a structured payload from the chrome.storage bridge", () => {
    const out = tryParseImportMessage({
      type: "chatvault:import",
      payload: VALID,
    });
    expect(out).not.toBeNull();
    expect(out!.title).toBe("Hello");
    expect(out!.messages).toHaveLength(2);
  });

  it("normalizes the source to browser_extension regardless of payload", () => {
    const out = tryParseImportMessage({
      type: "chatvault:import",
      payload: { ...VALID, source: "chatgpt_export_zip" },
    });
    expect(out!.source).toBe("browser_extension");
  });
});

describe("validateImportPayload — attachments", () => {
  it("passes through valid attachments unchanged", () => {
    const out = validateImportPayload({
      ...VALID,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "see attached",
          messageIndex: 0,
          attachments: [
            {
              filename: "paper.pdf",
              mimeType: "application/pdf",
              size: 12345,
              dataBase64: "JVBERi0xLjQK",
            },
          ],
        },
      ],
    });
    expect(out!.messages[0].attachments).toHaveLength(1);
    const a = out!.messages[0].attachments![0];
    expect(a.filename).toBe("paper.pdf");
    expect(a.mimeType).toBe("application/pdf");
    expect(a.size).toBe(12345);
    expect(a.dataBase64).toBe("JVBERi0xLjQK");
  });

  it("preserves fetchError when binary couldn't be fetched", () => {
    const out = validateImportPayload({
      ...VALID,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "tried to attach",
          messageIndex: 0,
          attachments: [{ filename: "x.pdf", fetchError: "HTTP 403" }],
        },
      ],
    });
    expect(out!.messages[0].attachments![0].fetchError).toBe("HTTP 403");
    expect(out!.messages[0].attachments![0].dataBase64).toBeUndefined();
  });

  it("drops attachments with no filename", () => {
    const out = validateImportPayload({
      ...VALID,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "x",
          messageIndex: 0,
          attachments: [
            { filename: "ok.pdf", dataBase64: "AAA" },
            { filename: "", dataBase64: "BBB" }, // dropped
            { mimeType: "application/pdf" }, // dropped (no filename)
            "garbage", // dropped (not an object)
          ],
        },
      ],
    });
    expect(out!.messages[0].attachments).toHaveLength(1);
    expect(out!.messages[0].attachments![0].filename).toBe("ok.pdf");
  });

  it("keeps a message that has only attachments and empty content", () => {
    const out = validateImportPayload({
      ...VALID,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "",
          messageIndex: 0,
          attachments: [{ filename: "only-this.pdf", dataBase64: "AAA" }],
        },
      ],
    });
    expect(out!.messages).toHaveLength(1);
    expect(out!.messages[0].attachments).toHaveLength(1);
  });

  it("strips invalid size/mimeType fields", () => {
    const out = validateImportPayload({
      ...VALID,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "x",
          messageIndex: 0,
          attachments: [
            {
              filename: "x.pdf",
              size: "not a number",
              mimeType: 42,
            },
          ],
        },
      ],
    });
    expect(out!.messages[0].attachments![0].size).toBeUndefined();
    expect(out!.messages[0].attachments![0].mimeType).toBeUndefined();
  });

  it("returns undefined attachments when none provided", () => {
    const out = validateImportPayload(VALID);
    expect(out!.messages[0].attachments).toBeUndefined();
  });
});
