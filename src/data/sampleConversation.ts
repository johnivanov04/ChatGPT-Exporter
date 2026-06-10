import type { NormalizedConversation } from "../types/conversation";

/**
 * Demo conversation shown when a visitor clicks "Try a sample" on the
 * landing page. Designed to exercise the full Preview/Export pipeline:
 * multi-turn dialogue, markdown formatting, fenced code blocks, an inline
 * table, and a few realistic touches. No real PII.
 */
export const sampleConversation: NormalizedConversation = {
  id: "sample-deduplicate-lines",
  title: "Deduplicate lines while preserving order",
  source: "sample",
  createdAt: "2026-06-08T15:42:18.000Z",
  updatedAt: "2026-06-08T15:46:04.000Z",
  metadata: { provider: "sample" },
  messages: [
    {
      id: "msg-0",
      role: "user",
      content:
        "I have a 200k-line log file with a lot of duplicate lines. I want to dedupe it but keep the original order. What's a clean way to do this in Python?",
      messageIndex: 0,
      createdAt: "2026-06-08T15:42:18.000Z",
    },
    {
      id: "msg-1",
      role: "assistant",
      content: `The trick is to iterate once and remember which lines you've already seen. A \`set\` gives you O(1) membership checks, so the whole thing is O(n):

\`\`\`python
def dedupe_preserve_order(lines):
    seen = set()
    for line in lines:
        if line not in seen:
            seen.add(line)
            yield line

with open("input.log") as src, open("output.log", "w") as dst:
    dst.writelines(dedupe_preserve_order(src))
\`\`\`

A few notes:

- **Streaming**: \`dedupe_preserve_order\` is a generator, so the file is processed line-by-line instead of being loaded into memory. Important at 200k lines.
- **Memory**: the \`seen\` set still holds one copy of every unique line. If your file has many distinct lines, peak memory is roughly \`unique_count × average_line_length\`.
- **Equality**: lines are compared byte-for-byte, including trailing whitespace. \`"hello\\n"\` and \`"hello \\n"\` are different.

If memory is tight and you have a lot of unique lines, switching to hashes (\`hash(line)\`) trades a tiny false-positive risk for ~8x less memory. For a 200k-line log on modern hardware though, you almost certainly don't need to.`,
      messageIndex: 1,
      createdAt: "2026-06-08T15:42:54.000Z",
    },
    {
      id: "msg-2",
      role: "user",
      content:
        "Got it. One follow-up — I want this to be case-insensitive but I still want the original casing preserved in the output. So `Error` and `error` count as duplicates, but whichever one appears first is what gets written.",
      messageIndex: 2,
      createdAt: "2026-06-08T15:44:32.000Z",
    },
    {
      id: "msg-3",
      role: "assistant",
      content: `Easy — normalize when you check, but yield the original:

\`\`\`python
def dedupe_preserve_order(lines):
    seen = set()
    for line in lines:
        key = line.lower()
        if key not in seen:
            seen.add(key)
            yield line
\`\`\`

The \`seen\` set now stores the **normalized** form, while \`yield line\` emits the **original**. So given:

| Input order | Lowercased | Emitted? |
|---|---|---|
| \`Error: timeout\` | \`error: timeout\` | ✓ |
| \`error: timeout\` | \`error: timeout\` | ✗ (already seen) |
| \`ERROR: TIMEOUT\` | \`error: timeout\` | ✗ |

The first-seen casing wins, which sounds like what you want.

If you also want to normalize trailing whitespace or collapse internal runs, build the key with \`" ".join(line.split())\` instead of just \`line.lower()\`.`,
      messageIndex: 3,
      createdAt: "2026-06-08T15:46:04.000Z",
    },
  ],
};
