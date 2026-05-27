import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { downloadFile, safeFilename } from "./downloadFile";

describe("safeFilename", () => {
  it("returns 'conversation' for empty input", () => {
    expect(safeFilename("")).toBe("conversation");
  });

  it("returns 'conversation' when input is all special characters", () => {
    expect(safeFilename("///***???")).toBe("conversation");
  });

  it("replaces forbidden filesystem characters with underscores", () => {
    expect(safeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe(
      "a_b_c_d_e_f_g_h_i_j",
    );
  });

  it("collapses whitespace runs into a single underscore", () => {
    expect(safeFilename("hello   world")).toBe("hello_world");
  });

  it("collapses repeated underscores", () => {
    expect(safeFilename("a___b")).toBe("a_b");
  });

  it("strips leading and trailing underscores", () => {
    expect(safeFilename("___hello___")).toBe("hello");
  });

  it("truncates to the default max length (80)", () => {
    const long = "a".repeat(200);
    expect(safeFilename(long)).toHaveLength(80);
  });

  it("respects a custom max length", () => {
    expect(safeFilename("abcdefghij", 5)).toBe("abcde");
  });

  it("preserves unicode letters", () => {
    expect(safeFilename("résumé über naïve")).toBe("résumé_über_naïve");
  });

  it("preserves dots and dashes", () => {
    expect(safeFilename("v1.2.3-release")).toBe("v1.2.3-release");
  });

  it("preserves leading/trailing meaningful characters after sanitization", () => {
    expect(safeFilename(" hello ")).toBe("hello");
  });
});

describe("downloadFile", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let originalCreateObjectURL: typeof URL.createObjectURL | undefined;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    clickSpy.mockRestore();
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL,
      });
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectURL,
      });
    }
  });

  it("creates a blob with the given mime type for string content", () => {
    downloadFile("test.txt", "hello", "text/plain");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const arg = createObjectURL.mock.calls[0][0] as Blob;
    expect(arg).toBeInstanceOf(Blob);
    expect(arg.type).toBe("text/plain");
    expect(arg.size).toBe(5);
  });

  it("defaults to text/plain when mime is omitted", () => {
    downloadFile("plain.txt", "x");
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/plain");
  });

  it("passes a Blob through directly without re-wrapping", () => {
    const original = new Blob(["pdf-data"], { type: "application/pdf" });
    downloadFile("doc.pdf", original);
    expect(createObjectURL).toHaveBeenCalledWith(original);
  });

  it("clicks an anchor element with the correct download attribute", () => {
    downloadFile("my file.md", "content", "text/markdown");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    // The anchor was removed after click, so we inspect via the click target.
    const callContext = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(callContext.download).toBe("my file.md");
    expect(callContext.href).toContain("blob:mock-url");
  });

  it("revokes the object URL on a timer after the click", () => {
    downloadFile("x.txt", "x");
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("removes the anchor from the DOM after clicking", () => {
    downloadFile("x.txt", "x");
    const anchors = document.querySelectorAll("a[download]");
    expect(anchors.length).toBe(0);
  });
});
