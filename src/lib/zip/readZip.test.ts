import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { loadZip, readTextFile, listFiles } from "./readZip";

async function makeZipFile(
  contents: Record<string, string>,
  name = "test.zip",
): Promise<File> {
  const zip = new JSZip();
  for (const [path, data] of Object.entries(contents)) {
    zip.file(path, data);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], name, { type: "application/zip" });
}

describe("loadZip", () => {
  it("rejects when no file is provided", async () => {
    // @ts-expect-error testing missing arg
    await expect(loadZip(undefined)).rejects.toThrow(/no file/i);
  });

  it("rejects files that don't end in .zip", async () => {
    const file = new File(["x"], "report.pdf", { type: "application/pdf" });
    await expect(loadZip(file)).rejects.toThrow(/zip file/i);
  });

  it("is case-insensitive on the .zip extension", async () => {
    const zip = new JSZip();
    zip.file("a.txt", "hi");
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "EXPORT.ZIP", { type: "application/zip" });
    const loaded = await loadZip(file);
    expect(listFiles(loaded)).toContain("a.txt");
  });

  it("rejects a non-ZIP blob with the .zip extension", async () => {
    const file = new File(["not actually a zip"], "fake.zip", {
      type: "application/zip",
    });
    await expect(loadZip(file)).rejects.toThrow(/could not read/i);
  });

  it("loads a valid ZIP", async () => {
    const file = await makeZipFile({ "hello.txt": "world" });
    const zip = await loadZip(file);
    expect(zip).toBeInstanceOf(JSZip);
  });
});

describe("readTextFile", () => {
  it("returns the contents of a known file", async () => {
    const file = await makeZipFile({ "a.txt": "abc" });
    const zip = await loadZip(file);
    await expect(readTextFile(zip, "a.txt")).resolves.toBe("abc");
  });

  it("rejects when the file isn't in the archive", async () => {
    const file = await makeZipFile({ "a.txt": "abc" });
    const zip = await loadZip(file);
    await expect(readTextFile(zip, "missing.txt")).rejects.toThrow(
      /not found/i,
    );
  });

  it("preserves unicode content", async () => {
    const file = await makeZipFile({ "u.txt": "héllo 🌍" });
    const zip = await loadZip(file);
    await expect(readTextFile(zip, "u.txt")).resolves.toBe("héllo 🌍");
  });

  it("handles empty file contents", async () => {
    const file = await makeZipFile({ "empty.txt": "" });
    const zip = await loadZip(file);
    await expect(readTextFile(zip, "empty.txt")).resolves.toBe("");
  });
});

describe("listFiles", () => {
  it("returns [] for an empty zip", async () => {
    const file = await makeZipFile({});
    const zip = await loadZip(file);
    expect(listFiles(zip)).toEqual([]);
  });

  it("lists top-level files", async () => {
    const file = await makeZipFile({ "a.txt": "1", "b.json": "2" });
    const zip = await loadZip(file);
    const files = listFiles(zip);
    expect(files.sort()).toEqual(["a.txt", "b.json"]);
  });

  it("lists nested files using forward slashes", async () => {
    const file = await makeZipFile({
      "root.txt": "1",
      "nested/inner.txt": "2",
      "nested/deeper/deep.json": "3",
    });
    const zip = await loadZip(file);
    const files = listFiles(zip);
    expect(files).toContain("root.txt");
    expect(files).toContain("nested/inner.txt");
    expect(files).toContain("nested/deeper/deep.json");
  });

  it("does not include directory entries", async () => {
    const zip = new JSZip();
    zip.folder("emptydir");
    zip.file("file.txt", "x");
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "z.zip", { type: "application/zip" });
    const loaded = await loadZip(file);
    const files = listFiles(loaded);
    expect(files).toEqual(["file.txt"]);
  });
});
