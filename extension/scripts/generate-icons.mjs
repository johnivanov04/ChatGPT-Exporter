// One-shot icon generator. Writes solid-violet rounded PNG icons in the four
// sizes Chrome wants for an MV3 extension. Uses only Node's built-in zlib —
// no native deps.
//
// Run:   node extension/scripts/generate-icons.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "icons");
mkdirSync(OUT, { recursive: true });

// Brand: gunmetal slate body (matches the favicon vault color). At
// toolbar sizes a single-color rounded square is indistinguishable from
// the full vault SVG, so we render slate-700 to match the body fill.
const FILL = [51, 65, 85]; // #334155 (slate-700)

for (const size of [16, 32, 48, 128]) {
  const buf = makeRoundedSquarePng(size, FILL);
  writeFileSync(resolve(OUT, `icon-${size}.png`), buf);
  console.log(`wrote icon-${size}.png (${buf.length} bytes)`);
}

/* ---------- minimal PNG writer (RGBA, no filter, single IDAT) ---------- */

function makeRoundedSquarePng(size, [r, g, b]) {
  // Round the four corners with a radius proportional to size (about 22%).
  const radius = Math.max(2, Math.round(size * 0.22));
  const rowBytes = size * 4 + 1;
  const raw = Buffer.alloc(rowBytes * size);

  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0; // filter byte: None
    for (let x = 0; x < size; x++) {
      const i = y * rowBytes + 1 + x * 4;
      const alpha = cornerAlpha(x, y, size, radius);
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = alpha;
    }
  }

  const idat = deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function cornerAlpha(x, y, size, radius) {
  // Distance from the nearest corner inside the rounded-square mask.
  // Pixels inside the rounded shape: 255. Outside: 0. Edge band: anti-aliased.
  const cx = x < radius ? radius : x > size - 1 - radius ? size - 1 - radius : x;
  const cy = y < radius ? radius : y > size - 1 - radius ? size - 1 - radius : y;
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d <= radius - 0.5) return 255;
  if (d >= radius + 0.5) return 0;
  return Math.round(255 * (radius + 0.5 - d));
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crc ^ buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
