import { describe, it, expect } from "vitest";
import { redactText, redactConversation } from "./redactText";
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  type NormalizedConversation,
} from "../../types/conversation";

function opts(partial: Partial<ExportOptions> = {}): ExportOptions {
  return { ...DEFAULT_EXPORT_OPTIONS, ...partial };
}

describe("redactText - emails", () => {
  it("does not redact when redactEmails is false", () => {
    expect(redactText("contact me at a@b.com", opts())).toBe(
      "contact me at a@b.com",
    );
  });

  it("redacts a simple email", () => {
    expect(redactText("a@b.com", opts({ redactEmails: true }))).toBe(
      "[REDACTED_EMAIL]",
    );
  });

  it("redacts an email embedded in surrounding text", () => {
    expect(
      redactText(
        "please email john.doe@example.com for details",
        opts({ redactEmails: true }),
      ),
    ).toBe("please email [REDACTED_EMAIL] for details");
  });

  it("redacts multiple emails in one string", () => {
    const out = redactText(
      "a@b.com and c@d.org and e+tag@sub.example.io",
      opts({ redactEmails: true }),
    );
    expect(out).toBe(
      "[REDACTED_EMAIL] and [REDACTED_EMAIL] and [REDACTED_EMAIL]",
    );
  });

  it("matches emails case-insensitively", () => {
    expect(
      redactText("JOHN@EXAMPLE.COM", opts({ redactEmails: true })),
    ).toBe("[REDACTED_EMAIL]");
  });

  it("does not match a bare domain without an @ symbol", () => {
    expect(
      redactText("example.com is a website", opts({ redactEmails: true })),
    ).toBe("example.com is a website");
  });

  it("preserves the empty string unchanged", () => {
    expect(redactText("", opts({ redactEmails: true }))).toBe("");
  });
});

describe("redactText - API keys", () => {
  it("does not redact when redactApiKeys is false", () => {
    const k = "sk-abcdefghijklmnopqrstuvwxyz0123456789";
    expect(redactText(k, opts())).toBe(k);
  });

  it("redacts an OpenAI-style sk- key", () => {
    expect(
      redactText(
        "sk-abcdefghijklmnopqrstuvwxyz0123456789",
        opts({ redactApiKeys: true }),
      ),
    ).toBe("[REDACTED_API_KEY]");
  });

  it("redacts an OpenAI sk-proj- key", () => {
    expect(
      redactText(
        "key=sk-proj-aBcDeF12345678901234567890",
        opts({ redactApiKeys: true }),
      ),
    ).toBe("key=[REDACTED_API_KEY]");
  });

  it("redacts a Slack xoxb- token", () => {
    expect(
      redactText(
        "xoxb-1234567890-abcdef",
        opts({ redactApiKeys: true }),
      ),
    ).toBe("[REDACTED_API_KEY]");
  });

  it("redacts a GitHub ghp_ token", () => {
    expect(
      redactText(
        "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234",
        opts({ redactApiKeys: true }),
      ),
    ).toBe("[REDACTED_API_KEY]");
  });

  it("redacts a Google AIza key", () => {
    expect(
      redactText(
        "AIzaSyA1B2C3D4E5F6G7H8I9J0KLMNOPQRS",
        opts({ redactApiKeys: true }),
      ),
    ).toBe("[REDACTED_API_KEY]");
  });

  it("does not redact a short string that merely starts with 'sk-'", () => {
    expect(redactText("sk-abc", opts({ redactApiKeys: true }))).toBe("sk-abc");
  });
});

describe("redactText - phone numbers", () => {
  it("does not redact when redactPhoneNumbers is false", () => {
    expect(redactText("call 555-123-4567", opts())).toBe("call 555-123-4567");
  });

  it("redacts a hyphen-separated US-style number", () => {
    expect(
      redactText("555-123-4567", opts({ redactPhoneNumbers: true })),
    ).toBe("[REDACTED_PHONE]");
  });

  it("redacts a dot-separated number", () => {
    expect(
      redactText("555.123.4567", opts({ redactPhoneNumbers: true })),
    ).toBe("[REDACTED_PHONE]");
  });

  // The current regex+heuristic keeps matches with >= 4 non-digit chars;
  // these formats fall in that bucket, so they survive. Documented behavior.
  it("KNOWN LIMITATION: parenthesized format is not redacted", () => {
    const out = redactText(
      "(555) 123-4567",
      opts({ redactPhoneNumbers: true }),
    );
    expect(out).toContain("555");
  });

  it("KNOWN LIMITATION: +country-prefixed hyphen format is not redacted", () => {
    const out = redactText(
      "+1-555-123-4567",
      opts({ redactPhoneNumbers: true }),
    );
    expect(out).toContain("555");
  });
});

describe("redactText - combined", () => {
  it("applies all redactions together when all enabled", () => {
    const all = opts({
      redactEmails: true,
      redactApiKeys: true,
      redactPhoneNumbers: true,
    });
    const out = redactText(
      "ping a@b.com or 555-123-4567 or sk-abcdefghijklmnopqrstuvwxyz0123456789",
      all,
    );
    expect(out).toBe(
      "ping [REDACTED_EMAIL] or [REDACTED_PHONE] or [REDACTED_API_KEY]",
    );
  });

  it("does not touch text when no redaction flags are set", () => {
    const text =
      "a@b.com / 555-123-4567 / sk-abcdefghijklmnopqrstuvwxyz0123456789";
    expect(redactText(text, opts())).toBe(text);
  });
});

describe("redactConversation", () => {
  function makeConvo(): NormalizedConversation {
    return {
      id: "c1",
      title: "Test",
      source: "chatgpt_export_zip",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "email me at a@b.com",
          messageIndex: 0,
          metadata: { originalKey: "keep-me" },
        },
        {
          id: "m2",
          role: "assistant",
          content: "no PII here",
          messageIndex: 1,
        },
      ],
      metadata: { exported: "yes" },
    };
  }

  it("returns the same reference when no redaction flags are set", () => {
    const c = makeConvo();
    expect(redactConversation(c, opts())).toBe(c);
  });

  it("returns a new object when any flag is enabled", () => {
    const c = makeConvo();
    expect(redactConversation(c, opts({ redactEmails: true }))).not.toBe(c);
  });

  it("redacts message content in the new object", () => {
    const c = makeConvo();
    const out = redactConversation(c, opts({ redactEmails: true }));
    expect(out.messages[0].content).toBe("email me at [REDACTED_EMAIL]");
    expect(out.messages[1].content).toBe("no PII here");
  });

  it("preserves message metadata, ids, roles, and indices", () => {
    const c = makeConvo();
    const out = redactConversation(c, opts({ redactEmails: true }));
    expect(out.messages[0].id).toBe("m1");
    expect(out.messages[0].role).toBe("user");
    expect(out.messages[0].messageIndex).toBe(0);
    expect(out.messages[0].metadata).toEqual({ originalKey: "keep-me" });
  });

  it("preserves top-level conversation fields", () => {
    const c = makeConvo();
    const out = redactConversation(c, opts({ redactEmails: true }));
    expect(out.id).toBe("c1");
    expect(out.title).toBe("Test");
    expect(out.source).toBe("chatgpt_export_zip");
    expect(out.metadata).toEqual({ exported: "yes" });
  });

  it("does not mutate the original conversation", () => {
    const c = makeConvo();
    redactConversation(c, opts({ redactEmails: true }));
    expect(c.messages[0].content).toBe("email me at a@b.com");
  });

  it("handles conversations with no messages", () => {
    const empty: NormalizedConversation = {
      id: "e",
      title: "Empty",
      source: "chatgpt_export_zip",
      messages: [],
    };
    const out = redactConversation(empty, opts({ redactEmails: true }));
    expect(out.messages).toEqual([]);
  });
});
