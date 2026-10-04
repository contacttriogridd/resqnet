#!/usr/bin/env node
/**
 * Generates the RESQNET PWA icons (PNG) without any image dependencies:
 * a white "plus" inside a ring on an emergency-red tile, rendered with 4×4
 * supersampling for smooth edges.
 *
 *   node scripts/generate-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public');
const RED = [180, 35, 24];
const WHITE = [255, 255, 255];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function encodePng(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const S = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / (S * S)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedRect(u, v, radius) {
  const dx = Math.max(radius - u, 0, u - (1 - radius));
  const dy = Math.max(radius - v, 0, v - (1 - radius));
  return dx * dx + dy * dy <= radius * radius;
}

/** Symbol (plus + ring) at the given scale around the centre. */
function symbol(u, v, scale) {
  const x = (u - 0.5) / scale;
  const y = (v - 0.5) / scale;
  const plus = (Math.abs(x) < 0.07 && Math.abs(y) < 0.21) || (Math.abs(y) < 0.07 && Math.abs(x) < 0.21);
  const d = Math.hypot(x, y);
  const ring = d > 0.3 && d < 0.355;
  return plus || ring;
}

const tile = ({ maskable, scale }) => (u, v) => {
  if (!maskable && !insideRoundedRect(u, v, 0.22)) return [0, 0, 0, 0];
  return symbol(u, v, scale) ? [...WHITE, 1] : [...RED, 1];
};

mkdirSync(join(OUT, 'icons'), { recursive: true });
const write = (file, size, opts) => {
  writeFileSync(join(OUT, file), encodePng(size, tile(opts)));
  console.log(`  ✓ ${file}`);
};
write('icons/icon-192.png', 192, { maskable: false, scale: 1 });
write('icons/icon-512.png', 512, { maskable: false, scale: 1 });
// Maskable icons keep the symbol inside the central 80% safe zone.
write('icons/maskable-512.png', 512, { maskable: true, scale: 0.78 });
write('apple-touch-icon.png', 180, { maskable: true, scale: 0.85 });
