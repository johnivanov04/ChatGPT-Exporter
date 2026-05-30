import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printConversation } from "./printPdf";

interface FakeWindow {
  document: { title: string };
  print: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  setTimeout: typeof setTimeout;
}

function makeFakeWindow(): FakeWindow {
  return {
    document: { title: "original-title" },
    print: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setTimeout: globalThis.setTimeout,
  };
}

describe("printConversation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets document.title to the base filename before printing", () => {
    const win = makeFakeWindow();
    printConversation("My Chat", win as unknown as Window);
    expect(win.document.title).toBe("My Chat");
    expect(win.print).toHaveBeenCalledTimes(1);
  });

  it("registers an afterprint listener and a timeout fallback", () => {
    const win = makeFakeWindow();
    printConversation("My Chat", win as unknown as Window);
    expect(win.addEventListener).toHaveBeenCalledWith(
      "afterprint",
      expect.any(Function),
    );
  });

  it("restores the title when the afterprint listener fires", () => {
    const win = makeFakeWindow();
    printConversation("My Chat", win as unknown as Window);
    const [, listener] = win.addEventListener.mock.calls[0] as [
      string,
      () => void,
    ];
    listener();
    expect(win.document.title).toBe("original-title");
    expect(win.removeEventListener).toHaveBeenCalledWith(
      "afterprint",
      listener,
    );
  });

  it("restores the title via the fallback timer even if afterprint never fires", () => {
    const win = makeFakeWindow();
    printConversation("My Chat", win as unknown as Window);
    expect(win.document.title).toBe("My Chat");
    vi.advanceTimersByTime(60_000);
    expect(win.document.title).toBe("original-title");
  });
});
