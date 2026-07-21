// Generates the PWA icons (solid green tile with a simple sprout) without any
// image dependencies — writes valid PNGs by hand using zlib for compression.
// Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [58, 125, 68]; // #3a7d44
const FG = [235, 246, 233]; // pale leaf

function crc32(buf) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function inEllipse(x, y, cx, cy, rx, ry, angle) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const dx = x - cx,
    dy = y - cy;
  const u = (dx * cos + dy * sin) / rx;
  const v = (-dx * sin + dy * cos) / ry;
  return u * u + v * v <= 1;
}

function makePng(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const cx = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let [r, g, b] = BG;
      const stem = Math.abs(x - cx) < size * 0.025 && y > size * 0.42 && y < size * 0.8;
      const leafL = inEllipse(x, y, size * 0.34, size * 0.42, size * 0.17, size * 0.1, -0.55);
      const leafR = inEllipse(x, y, size * 0.66, size * 0.42, size * 0.17, size * 0.1, 0.55);
      const bud = inEllipse(x, y, cx, size * 0.3, size * 0.055, size * 0.075, 0);
      if (stem || leafL || leafR || bud) [r, g, b] = FG;
      const i = y * (size * 3 + 1) + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", makePng(192));
writeFileSync("public/icons/icon-512.png", makePng(512));
writeFileSync("public/icons/apple-touch-icon.png", makePng(180));
console.log("Icons written to public/icons/");
