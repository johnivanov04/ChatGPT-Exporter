import JSZip from "jszip";

export async function loadZip(file: File): Promise<JSZip> {
  if (!file) throw new Error("No file provided.");
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".zip")) {
    throw new Error("That doesn't look like a ZIP file. Please upload a .zip.");
  }
  try {
    const buf = await file.arrayBuffer();
    return await JSZip.loadAsync(buf);
  } catch (err) {
    throw new Error(
      "Could not read the ZIP file. It may be corrupted or password-protected.",
      { cause: err as Error },
    );
  }
}

export async function readTextFile(
  zip: JSZip,
  filename: string,
): Promise<string> {
  const entry = zip.file(filename);
  if (!entry) throw new Error(`File not found in ZIP: ${filename}`);
  return entry.async("string");
}

export function listFiles(zip: JSZip): string[] {
  const names: string[] = [];
  zip.forEach((relativePath, entry) => {
    if (!entry.dir) names.push(relativePath);
  });
  return names;
}
