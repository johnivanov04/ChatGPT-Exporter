import { describe, it, expect } from "vitest";
import { safeStringify } from "./safeStringify";

describe("safeStringify", () => {
  describe("primitives", () => {
    it("returns empty string for null", () => {
      expect(safeStringify(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(safeStringify(undefined)).toBe("");
    });

    it("returns string values unchanged", () => {
      expect(safeStringify("hello")).toBe("hello");
    });

    it("returns the literal empty string when given empty string", () => {
      expect(safeStringify("")).toBe("");
    });

    it("preserves multi-line strings unchanged (no quoting)", () => {
      expect(safeStringify("a\nb\nc")).toBe("a\nb\nc");
    });

    it("converts numbers to string form", () => {
      expect(safeStringify(0)).toBe("0");
      expect(safeStringify(42)).toBe("42");
      expect(safeStringify(-1.5)).toBe("-1.5");
    });

    it("converts NaN and Infinity to their string forms", () => {
      expect(safeStringify(Number.NaN)).toBe("NaN");
      expect(safeStringify(Infinity)).toBe("Infinity");
      expect(safeStringify(-Infinity)).toBe("-Infinity");
    });

    it("converts booleans to string", () => {
      expect(safeStringify(true)).toBe("true");
      expect(safeStringify(false)).toBe("false");
    });
  });

  describe("objects and arrays", () => {
    it("stringifies a flat object as JSON", () => {
      expect(safeStringify({ a: 1, b: "x" })).toBe('{"a":1,"b":"x"}');
    });

    it("stringifies arrays", () => {
      expect(safeStringify([1, 2, 3])).toBe("[1,2,3]");
    });

    it("respects the indent argument for pretty-printing", () => {
      const pretty = safeStringify({ a: 1 }, 2);
      expect(pretty).toBe('{\n  "a": 1\n}');
    });

    it("stringifies nested objects", () => {
      expect(safeStringify({ a: { b: { c: 1 } } })).toBe(
        '{"a":{"b":{"c":1}}}',
      );
    });

    it("preserves empty object and array forms", () => {
      expect(safeStringify({})).toBe("{}");
      expect(safeStringify([])).toBe("[]");
    });
  });

  describe("difficult-to-serialize values", () => {
    it("replaces circular references with '[Circular]' instead of throwing", () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      const out = safeStringify(obj);
      expect(out).toContain('"a":1');
      expect(out).toContain('"[Circular]"');
    });

    it("handles circular references nested inside arrays", () => {
      const a: unknown[] = [];
      a.push(a);
      const out = safeStringify(a);
      expect(out).toBe('["[Circular]"]');
    });

    it("serializes BigInt values as their string form", () => {
      expect(safeStringify({ n: 9007199254740993n })).toBe(
        '{"n":"9007199254740993"}',
      );
    });

    it("omits function-valued properties (per JSON.stringify behavior)", () => {
      const v = { a: 1, fn: () => 42 };
      expect(safeStringify(v)).toBe('{"a":1}');
    });

    it("omits symbol-keyed properties", () => {
      const s = Symbol("k");
      const v: Record<string | symbol, unknown> = { a: 1 };
      v[s] = "hidden";
      expect(safeStringify(v)).toBe('{"a":1}');
    });

    it("serializes Dates as ISO strings (default JSON behavior)", () => {
      const d = new Date("2026-05-26T00:00:00.000Z");
      expect(safeStringify({ d })).toBe('{"d":"2026-05-26T00:00:00.000Z"}');
    });
  });
});
