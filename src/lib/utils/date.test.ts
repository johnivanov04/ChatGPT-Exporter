import { describe, it, expect } from "vitest";
import { toIsoString, formatDateTime, formatDateShort } from "./date";

describe("toIsoString", () => {
  it("returns undefined for null", () => {
    expect(toIsoString(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(toIsoString(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(toIsoString("")).toBeUndefined();
  });

  it("returns undefined for non-string non-number input", () => {
    expect(toIsoString(true)).toBeUndefined();
    expect(toIsoString({})).toBeUndefined();
    expect(toIsoString([])).toBeUndefined();
  });

  it("returns undefined for an unparseable string", () => {
    expect(toIsoString("not-a-date")).toBeUndefined();
  });

  it("returns undefined for NaN", () => {
    expect(toIsoString(Number.NaN)).toBeUndefined();
  });

  it("parses an ISO string and re-emits an ISO string", () => {
    expect(toIsoString("2026-05-26T00:00:00.000Z")).toBe(
      "2026-05-26T00:00:00.000Z",
    );
  });

  it("treats unix seconds (<= 1e12) as seconds and multiplies by 1000", () => {
    // 1700000000 seconds = 2023-11-14T22:13:20.000Z
    expect(toIsoString(1700000000)).toBe("2023-11-14T22:13:20.000Z");
  });

  it("treats large numbers (> 1e12) as milliseconds", () => {
    // 1700000000000 ms = 2023-11-14T22:13:20.000Z
    expect(toIsoString(1700000000000)).toBe("2023-11-14T22:13:20.000Z");
  });

  it("handles zero as epoch in seconds", () => {
    expect(toIsoString(0)).toBe("1970-01-01T00:00:00.000Z");
  });

  it("handles fractional seconds (ChatGPT export style)", () => {
    // 1700000000.5 seconds = 2023-11-14T22:13:20.500Z
    expect(toIsoString(1700000000.5)).toBe("2023-11-14T22:13:20.500Z");
  });
});

describe("formatDateTime", () => {
  it("returns empty string when iso is undefined", () => {
    expect(formatDateTime(undefined)).toBe("");
  });

  it("returns a non-empty locale string for a valid ISO", () => {
    const out = formatDateTime("2026-05-26T12:00:00.000Z");
    expect(out).not.toBe("");
    expect(typeof out).toBe("string");
  });

  it("falls back to the input string when input is unparseable", () => {
    // Date constructor returns Invalid Date which throws on toLocaleString;
    // implementation catches and returns the original string.
    const out = formatDateTime("not-a-date");
    expect(out).toBe("not-a-date");
  });
});

describe("formatDateShort", () => {
  it("returns empty string when iso is undefined", () => {
    expect(formatDateShort(undefined)).toBe("");
  });

  it("returns a non-empty string for a valid ISO", () => {
    const out = formatDateShort("2026-05-26T12:00:00.000Z");
    expect(out).not.toBe("");
  });

  it("falls back to input on unparseable", () => {
    expect(formatDateShort("garbage")).toBe("garbage");
  });
});
