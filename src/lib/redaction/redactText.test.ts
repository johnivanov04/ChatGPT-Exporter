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

  it("redacts an Anthropic sk-ant- key", () => {
    expect(
      redactText(
        "sk-ant-aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890",
        opts({ redactApiKeys: true }),
      ),
    ).toBe("[REDACTED_API_KEY]");
  });

  it("redacts an AWS access key id", () => {
    expect(
      redactText("AKIAIOSFODNN7EXAMPLE", opts({ redactApiKeys: true })),
    ).toBe("[REDACTED_API_KEY]");
  });

  it("redacts a GitHub fine-grained PAT (github_pat_)", () => {
    expect(
      redactText(
        "github_pat_11AAAAAAA0aBcDeFgHiJkLmNoPq",
        opts({ redactApiKeys: true }),
      ),
    ).toBe("[REDACTED_API_KEY]");
  });

  it("redacts Stripe live/test secret and publishable keys", () => {
    const optsOn = opts({ redactApiKeys: true });
    // Fixtures built at runtime via join so no contiguous
    // `<prefix>_<env>_<body>` literal appears in source — GitHub's secret
    // scanner pattern-matches on the full literal, so splitting avoids
    // false positives without weakening the test.
    const fakeSecret = ["sk", "live", "FIXTUREaaaaaaaaaaaaaaaaaaaaaa"].join("_");
    const fakePublishable = ["pk", "test", "FIXTUREaaaaaaaaaaaaaaaaaaaaaa"].join("_");
    expect(redactText(fakeSecret, optsOn)).toBe("[REDACTED_API_KEY]");
    expect(redactText(fakePublishable, optsOn)).toBe("[REDACTED_API_KEY]");
  });

  it("does NOT redact a commit SHA or generic hex string", () => {
    expect(
      redactText(
        "abc123def456abc123def456abc123def456abcd",
        opts({ redactApiKeys: true }),
      ),
    ).toBe("abc123def456abc123def456abc123def456abcd");
  });
});

describe("redactText - phone numbers", () => {
  const phoneOn = opts({ redactPhoneNumbers: true });

  it("does not redact when redactPhoneNumbers is false", () => {
    expect(redactText("call 555-123-4567", opts())).toBe("call 555-123-4567");
  });

  it("redacts a hyphen-separated US-style number", () => {
    expect(redactText("555-123-4567", phoneOn)).toBe("[REDACTED_PHONE]");
  });

  it("redacts a dot-separated US-style number", () => {
    expect(redactText("555.123.4567", phoneOn)).toBe("[REDACTED_PHONE]");
  });

  it("redacts a space-separated US-style number", () => {
    expect(redactText("555 123 4567", phoneOn)).toBe("[REDACTED_PHONE]");
  });

  it("redacts the parenthesised US format", () => {
    expect(redactText("(555) 123-4567", phoneOn)).toBe("[REDACTED_PHONE]");
    expect(redactText("(555)123-4567", phoneOn)).toBe("[REDACTED_PHONE]");
  });

  it("redacts +country-code formats", () => {
    expect(redactText("+1-555-123-4567", phoneOn)).toBe("[REDACTED_PHONE]");
    expect(redactText("+1 555 123 4567", phoneOn)).toBe("[REDACTED_PHONE]");
    expect(redactText("+44 20 7946 0958", phoneOn)).toBe("[REDACTED_PHONE]");
  });

  it("redacts 1-prefixed toll-free numbers", () => {
    expect(redactText("1-800-555-1234", phoneOn)).toBe("[REDACTED_PHONE]");
  });

  it("redacts a phone embedded in surrounding text", () => {
    expect(redactText("call me at 555-123-4567 today", phoneOn)).toBe(
      "call me at [REDACTED_PHONE] today",
    );
  });

  it("does NOT redact ISO dates (false-positive guard)", () => {
    expect(redactText("2026-05-28", phoneOn)).toBe("2026-05-28");
    expect(redactText("on 2025-12-31 we ship", phoneOn)).toBe(
      "on 2025-12-31 we ship",
    );
  });

  it("does NOT redact IP addresses (false-positive guard)", () => {
    expect(redactText("server at 192.168.0.1", phoneOn)).toBe(
      "server at 192.168.0.1",
    );
  });

  it("does NOT redact semver version strings (false-positive guard)", () => {
    expect(redactText("v1.2.3-release", phoneOn)).toBe("v1.2.3-release");
    expect(redactText("upgrade to 1.2.3", phoneOn)).toBe("upgrade to 1.2.3");
  });

  it("does NOT redact a sequence of 4-digit groups (credit-card shape)", () => {
    // Out of scope for the phone redactor; only emails/phones/api keys are
    // promised by the spec.
    expect(redactText("1234 5678 9012 3456", phoneOn)).toBe(
      "1234 5678 9012 3456",
    );
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
