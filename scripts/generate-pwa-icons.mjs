// One-shot PWA icon generator. Writes solid-violet rounded-corner PNGs
// into public/ for the PWA manifest. Uses only Node's built-in zlib —
// no native deps. Mirrors extension/scripts/generate-icons.mjs.
//
// Run:   node scripts/generate-pwa-icons.mjs

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");

// Gunmetal slate (matches favicon body).
const FILL = [51, 65, 85]; // #334155 (slate-700)

writeFileSync(resolve(PUBLIC, "pwa-192.png"), makePng(192, FILL, 0.22));
writeFileSync(resolve(PUBLIC, "pwa-512.png"), makePng(512, FILL, 0.22));
// Maskable variant: smaller corner radius + full bleed so Android's mask
// doesn't clip anything important.
writeFileSync(resolve(PUBLIC, "pwa-maskable-512.png"), makePng(512, FILL, 0));
console.log("wrote pwa-192.png, pwa-512.png, pwa-maskable-512.png");

/* ---------- minimal PNG writer (RGBA, no filter, single IDAT) ---------- */

function makePng(size, [r, g, b], radiusRatio) {
  const radius = Math.round(size * radiusRatio);
  const rowBytes = size * 4 + 1;
  const raw = Buffer.alloc(rowBytes * size);

  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * rowBytes + 1 + x * 4;
      const alpha = cornerAlpha(x, y, size, radius);
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = alpha;
    }
  }

  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function cornerAlpha(x, y, size, radius) {
  if (radius === 0) return 255;
  const cx = x < radius ? radius : x >= size - radius ? size - 1 - radius : x;
  const cy = y < radius ? radius : y >= size - radius ? size - 1 - radius : y;
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= radius - 0.5) return 255;
  if (d >= radius + 0.5) return 0;
  return Math.round((radius + 0.5 - d) * 255);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

