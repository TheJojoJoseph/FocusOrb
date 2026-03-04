// Run once: node generate-icons.js
// Generates icons/icon16.png, icon48.png, icon128.png
// Zero dependencies — uses only Node.js built-ins (zlib, fs, path)

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "icons");
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

/* ── PNG helpers ──────────────────────────────────── */

function crc32(buf) {
  let crc = 0xffffffff;
  const table =
    crc32.table ||
    (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })());
  for (let i = 0; i < buf.length; i++)
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const typeB = Buffer.from(type, "ascii");
  const lenB = u32be(data.length);
  const crcB = u32be(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([lenB, typeB, data, crcB]);
}

function buildPNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = chunk(
    "IHDR",
    Buffer.concat([
      u32be(width),
      u32be(height),
      Buffer.from([8, 2, 0, 0, 0]), // 8-bit RGB (no alpha in IHDR; we embed RGBA via IDAT)
    ]),
  );

  // Actually use RGBA (color type 6)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr2 = chunk("IHDR", ihdrData);

  // Build raw image data (filter byte 0 per row)
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    rawRows.push(0); // filter type None
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rawRows.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
    }
  }
  const raw = Buffer.from(rawRows);
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk("IDAT", compressed);
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr2, idat, iend]);
}

/* ── Draw icon ────────────────────────────────────── */

function drawIcon(size) {
  const rgba = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 1;
  const blueR = outerR * 0.38;
  const whiteR = blueR * 0.42;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= whiteR) {
        // White inner dot
        rgba[idx] = 255;
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 255;
        rgba[idx + 3] = 255;
      } else if (dist <= blueR) {
        // Blue accent
        rgba[idx] = 0;
        rgba[idx + 1] = 122;
        rgba[idx + 2] = 255;
        rgba[idx + 3] = 255;
      } else if (dist <= outerR) {
        // White/light background with subtle gradient
        const t = dist / outerR;
        const v = Math.round(255 - t * 18);
        rgba[idx] = v;
        rgba[idx + 1] = v;
        rgba[idx + 2] = Math.round(v * 0.97 + 8);
        rgba[idx + 3] = 255;
      } else if (dist <= outerR + 1) {
        // Anti-alias edge
        const alpha = Math.round((outerR + 1 - dist) * 200);
        rgba[idx] = 230;
        rgba[idx + 1] = 230;
        rgba[idx + 2] = 235;
        rgba[idx + 3] = alpha;
      } else {
        // Transparent outside
        rgba[idx + 3] = 0;
      }
    }
  }
  return Buffer.from(rgba);
}

[16, 48, 128].forEach((size) => {
  const pixels = drawIcon(size);
  const png = buildPNG(size, size, pixels);
  const out = path.join(dir, `icon${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`✓ icons/icon${size}.png`);
});

console.log("Done.");
