import { describe, it, expect } from "vitest";
import { parseManualPaste } from "./parseManualPaste";

describe("parseManualPaste", () => {
  describe("basics", () => {
    it("returns a manual_paste source", () => {
      const c = parseManualPaste("hello");
      expect(c.source).toBe("manual_paste");
    });

    it("uses a default title when none provided", () => {
      expect(parseManualPaste("hello").title).toBe("Pasted conversation");
    });

    it("uses the provided title, trimmed", () => {
      expect(
        parseManualPaste("hello", { title: "  My Chat  " }).title,
      ).toBe("My Chat");
    });

    it("falls back to default title for a blank title string", () => {
      expect(parseManualPaste("hello", { title: "   " }).title).toBe(
        "Pasted conversation",
      );
    });

    it("returns zero messages for an empty input", () => {
      expect(parseManualPaste("").messages).toEqual([]);
    });

    it("returns zero messages for a whitespace-only input", () => {
      expect(parseManualPaste("   \n\t   ").messages).toEqual([]);
    });
  });

  describe("no markers", () => {
    it("emits a single unknown-role message containing the full text", () => {
      const c = parseManualPaste("just some thoughts\nwith two lines");
      expect(c.messages).toHaveLength(1);
      expect(c.messages[0].role).toBe("unknown");
      expect(c.messages[0].content).toBe("just some thoughts\nwith two lines");
    });

    it("trims leading/trailing whitespace from the singleton message", () => {
      const c = parseManualPaste("\n\n  hi  \n\n");
      expect(c.messages[0].content).toBe("hi");
    });
  });

  describe("marker forms", () => {
    it("recognizes 'User:' and 'Assistant:'", () => {
      const c = parseManualPaste("User: hi\nAssistant: hello");
      expect(c.messages.map((m) => [m.role, m.content])).toEqual([
        ["user", "hi"],
        ["assistant", "hello"],
      ]);
    });

    it("recognizes '[User]' and '[Assistant]'", () => {
      const c = parseManualPaste("[User] hi\n[Assistant] hello");
      expect(c.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    });

    it("recognizes 'ChatGPT:' as assistant", () => {
      const c = parseManualPaste("User: q\nChatGPT: a");
      expect(c.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    });

    it("recognizes ChatGPT page-copy labels 'You said:' and 'ChatGPT said:'", () => {
      const c = parseManualPaste(
        "You said:\nhow do I sort a list?\nChatGPT said:\nUse sorted().",
      );
      expect(c.messages.map((m) => [m.role, m.content])).toEqual([
        ["user", "how do I sort a list?"],
        ["assistant", "Use sorted()."],
      ]);
    });

    it("handles 'You said:' with content on the same line", () => {
      const c = parseManualPaste("You said: hi\nChatGPT said: hello");
      expect(c.messages.map((m) => [m.role, m.content])).toEqual([
        ["user", "hi"],
        ["assistant", "hello"],
      ]);
    });

    it("recognizes 'Copilot said:', 'Claude said:', 'Gemini said:' as assistant", () => {
      const c = parseManualPaste(
        "You said: q1\nCopilot said: a1\nYou said: q2\nClaude said: a2\nYou said: q3\nGemini said: a3",
      );
      expect(c.messages.map((m) => m.role)).toEqual([
        "user",
        "assistant",
        "user",
        "assistant",
        "user",
        "assistant",
      ]);
    });

    it("preserves multi-paragraph assistant replies from a page paste", () => {
      const pasted = `You said:
Explain monads briefly.
ChatGPT said:
A monad is a type with two operations.

First, unit: wraps a value.
Second, bind: chains computations.`;
      const c = parseManualPaste(pasted);
      expect(c.messages).toHaveLength(2);
      expect(c.messages[1].content).toContain("type with two operations");
      expect(c.messages[1].content).toContain("First, unit");
      expect(c.messages[1].content).toContain("Second, bind");
    });

    it("recognizes 'System:' and '[System]'", () => {
      const c = parseManualPaste("System: be helpful\n[System] more rules");
      expect(c.messages.every((m) => m.role === "system")).toBe(true);
    });

    it("matches markers case-insensitively", () => {
      const c = parseManualPaste("user: lower\nASSISTANT: upper");
      expect(c.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    });

    it("tolerates leading whitespace on the marker line", () => {
      const c = parseManualPaste("   User: hello\n   Assistant: world");
      expect(c.messages.map((m) => m.content)).toEqual(["hello", "world"]);
    });

    it("treats markers only at the start of a line, not mid-line", () => {
      const c = parseManualPaste(
        "User: tell me about user: groups in unix\nAssistant: sure",
      );
      expect(c.messages).toHaveLength(2);
      expect(c.messages[0].content).toBe(
        "tell me about user: groups in unix",
      );
    });

    it("treats a marker line followed by content on subsequent lines correctly", () => {
      const c = parseManualPaste(
        "User:\nfirst line\nsecond line\nAssistant:\nresponse",
      );
      expect(c.messages.map((m) => [m.role, m.content])).toEqual([
        ["user", "first line\nsecond line"],
        ["assistant", "response"],
      ]);
    });

    it("handles bracket markers without trailing colon and with trailing colon equivalently", () => {
      const a = parseManualPaste("[User] hi");
      const b = parseManualPaste("[User]: hi");
      expect(a.messages[0]).toMatchObject({ role: "user", content: "hi" });
      expect(b.messages[0]).toMatchObject({ role: "user", content: "hi" });
    });
  });

  describe("structure", () => {
    it("collects multi-line message bodies between markers", () => {
      const c = parseManualPaste(
        "User: q\nfollow-up line\nAssistant: paragraph 1\n\nparagraph 2",
      );
      expect(c.messages[0].content).toBe("q\nfollow-up line");
      expect(c.messages[1].content).toBe("paragraph 1\n\nparagraph 2");
    });

    it("drops pre-marker text when any markers are present", () => {
      const c = parseManualPaste(
        "intro chatter\n--- separator ---\nUser: hi\nAssistant: hello",
      );
      expect(c.messages).toHaveLength(2);
      expect(c.messages[0].content).toBe("hi");
    });

    it("skips empty messages between consecutive markers", () => {
      const c = parseManualPaste("User:\nAssistant: hello");
      expect(c.messages).toHaveLength(1);
      expect(c.messages[0]).toMatchObject({
        role: "assistant",
        content: "hello",
      });
    });

    it("normalizes CRLF line endings", () => {
      const c = parseManualPaste("User: hi\r\nAssistant: hello\r\n");
      expect(c.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    });

    it("assigns sequential messageIndex starting at 0", () => {
      const c = parseManualPaste("User: a\nAssistant: b\nUser: c");
      expect(c.messages.map((m) => m.messageIndex)).toEqual([0, 1, 2]);
    });

    it("preserves code fences inside a message body", () => {
      const c = parseManualPaste(
        "User: show me\nAssistant: ```python\nprint('hi')\n```",
      );
      expect(c.messages[1].content).toContain("```python");
      expect(c.messages[1].content).toContain("print('hi')");
    });

    it("supports turns scattered with blank lines between them", () => {
      const c = parseManualPaste(
        "User: first\n\n\nAssistant: second\n\nUser: third",
      );
      expect(c.messages.map((m) => m.content)).toEqual([
        "first",
        "second",
        "third",
      ]);
    });

    it("never falls back to safe-stringify or dumps JSON for object-like content", () => {
      // Parser is text-only; this just verifies role+content come through clean
      // and content is never wrapped or transformed beyond trimming.
      const c = parseManualPaste("User: { not really json }");
      expect(c.messages[0].content).toBe("{ not really json }");
    });
  });

  describe("ChatGPT page-copy heuristic (no explicit role labels)", () => {
    it("splits a typical page-copy paste using attachment + Thought markers", () => {
      const pasted = `ChatGPT




EE_CS_148B_HW4.pdf
PDF
for the attached homework assignment can you help me complete parts 2 through 5

I'll write the parts that can be completed from the prompt itself.

I found the assignment's written-question map.

Thought for 1m 21s
Here's a paste-ready draft for Parts 2–5 written questions.

Long detailed content goes here.

Screenshot 2026-05-24 at 2.51.57 PM.png
why am i getting this error

Thought for 7s
You got: zsh: permission denied

Run this:
chmod +x foo

Screenshot 2026-05-24 at 2.52.38 PM.png

Thought for 11s
Your screenshot shows two things:

Run this fix instead.`;

      const c = parseManualPaste(pasted);
      const roles = c.messages.map((m) => m.role);
      // Expect alternating user/assistant turns starting with user
      expect(roles).toEqual([
        "user",
        "assistant",
        "user",
        "assistant",
        "user",
        "assistant",
      ]);
    });

    it("includes the attachment filename in the user message as [attached: …]", () => {
      const c = parseManualPaste(
        `EE_CS_148B_HW4.pdf\nPDF\nhelp me with the homework\n\nSure thing.\n\nThought for 5s\nDetailed answer.`,
      );
      expect(c.messages[0].role).toBe("user");
      expect(c.messages[0].content).toContain("[attached: EE_CS_148B_HW4.pdf]");
      expect(c.messages[0].content).toContain("help me with the homework");
      // The "PDF" label after the filename is skipped
      expect(c.messages[0].content).not.toMatch(/^PDF$/m);
    });

    it("handles attachment-only user turns (filename with no following text)", () => {
      const c = parseManualPaste(
        `Screenshot 2026-05-24 at 2.52.38 PM.png\n\nThought for 11s\nHere is what the screenshot shows.`,
      );
      expect(c.messages[0].role).toBe("user");
      expect(c.messages[0].content).toBe(
        "[attached: Screenshot 2026-05-24 at 2.52.38 PM.png]",
      );
      expect(c.messages[1].role).toBe("assistant");
    });

    it("drops standalone 'Thought for X' marker paragraphs", () => {
      const c = parseManualPaste(
        `foo.pdf\nq\n\nThought for 32s\n\nthe answer`,
      );
      const joined = c.messages.map((m) => m.content).join("\n\n");
      expect(joined).not.toMatch(/Thought for/);
    });

    it("strips the leading 'ChatGPT' header line", () => {
      const c = parseManualPaste(
        `ChatGPT\n\nfoo.pdf\nq\n\nThought for 1s\nanswer`,
      );
      const joined = c.messages.map((m) => m.content).join("\n\n");
      expect(joined).not.toMatch(/^ChatGPT$/m);
    });

    it("recognizes a wide range of attachment file extensions", () => {
      const cases = [
        "report.pdf",
        "photo.JPG",
        "data.csv",
        "code.py",
        "notes.md",
        "deck.pptx",
        "audio.mp3",
      ];
      for (const filename of cases) {
        const c = parseManualPaste(
          `${filename}\nuser text\n\nThought for 1s\nresponse`,
        );
        expect(c.messages[0].role, `for ${filename}`).toBe("user");
        expect(c.messages[0].content).toContain(`[attached: ${filename}]`);
      }
    });

    it("does NOT mis-fire on a paste with no attachments and no Thought markers", () => {
      // Should fall through to the single-unknown fallback.
      const c = parseManualPaste("just some random text\nwith two lines");
      expect(c.messages).toHaveLength(1);
      expect(c.messages[0].role).toBe("unknown");
    });

    it("does NOT mis-fire on a URL containing a .pdf extension", () => {
      // URLs aren't filename-only lines, so they shouldn't trigger.
      const c = parseManualPaste(
        "see https://example.com/file.pdf for details",
      );
      expect(c.messages).toHaveLength(1);
      expect(c.messages[0].role).toBe("unknown");
    });

    it("classic markers still take precedence over the heuristic when both present", () => {
      const c = parseManualPaste(
        `report.pdf\n\nUser: question one\nAssistant: answer one\nUser: question two`,
      );
      // Classic-marker strategy fires; the .pdf line is dropped because it
      // appears before any marker (pre-marker preamble).
      expect(c.messages.map((m) => m.role)).toEqual([
        "user",
        "assistant",
        "user",
      ]);
      expect(c.messages[0].content).toBe("question one");
    });

    it("coalesces consecutive assistant paragraphs into a single message", () => {
      const c = parseManualPaste(
        `foo.pdf\nq\n\npreamble paragraph\n\nThought for 5s\n\nfirst body paragraph\n\nsecond body paragraph`,
      );
      expect(c.messages).toHaveLength(2);
      expect(c.messages[1].role).toBe("assistant");
      // All three assistant chunks coalesced (preamble + two body paragraphs)
      expect(c.messages[1].content).toContain("preamble paragraph");
      expect(c.messages[1].content).toContain("first body paragraph");
      expect(c.messages[1].content).toContain("second body paragraph");
    });
  });
});
