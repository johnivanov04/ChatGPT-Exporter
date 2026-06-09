// One-shot icon generator. Rasterizes the vault favicon SVG into the four
// PNG sizes Chrome wants for an MV3 extension. Requires `rsvg-convert`
// (install via `brew install librsvg`).
//
// Run:   node extension/scripts/generate-icons.mjs

import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SVG = resolve(ROOT, "public", "favicon.svg");
const OUT = resolve(ROOT, "extension", "icons");
mkdirSync(OUT, { recursive: true });

try {
  execSync("rsvg-convert --version", { stdio: "ignore" });
} catch {
  console.error(
    "rsvg-convert not found. Install with: brew install librsvg",
  );
  process.exit(1);
}

for (const size of [16, 32, 48, 128]) {
  const outPath = resolve(OUT, `icon-${size}.png`);
  execSync(
    `rsvg-convert -w ${size} -h ${size} -o "${outPath}" "${SVG}"`,
    { stdio: "inherit" },
  );
  console.log(`wrote icon-${size}.png`);
}
