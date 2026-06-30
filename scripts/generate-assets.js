import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "public", "assets");
mkdirSync(outDir, { recursive: true });

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function writePng(name, width, height, painter) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = painter(x / width, y / height, x, y);
      const i = row + 1 + x * 4;
      raw[i] = clamp(r);
      raw[i + 1] = clamp(g);
      raw[i + 2] = clamp(b);
      raw[i + 3] = clamp(a);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  writeFileSync(join(outDir, name), png);
}

function hash(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function palette(seed) {
  const palettes = [
    { neon: [86, 240, 255], hot: [255, 79, 159], warm: [216, 179, 92] },
    { neon: [105, 240, 189], hot: [86, 240, 255], warm: [255, 79, 159] },
    { neon: [180, 150, 255], hot: [86, 240, 255], warm: [216, 179, 92] },
    { neon: [86, 240, 255], hot: [255, 122, 89], warm: [105, 240, 189] },
  ];
  return palettes[seed % palettes.length];
}

function cityPainter(seed, variant = 0) {
  const colors = palette(seed);
  return (u, v, x, y) => {
    const vertical = 1 - v;
    const rain = hash(Math.floor(x / 2), Math.floor(y / 22), seed);
    const skyPulse = Math.max(0, 1 - Math.hypot(u - 0.72, v - 0.38) * 2.2);
    const lowerGlow = Math.max(0, 1 - Math.abs(v - 0.78) * 5);
    let r = 4 + vertical * 18 + skyPulse * colors.hot[0] * 0.22;
    let g = 8 + vertical * 22 + skyPulse * colors.hot[1] * 0.18;
    let b = 14 + vertical * 28 + skyPulse * colors.hot[2] * 0.3;

    const grid =
      (Math.abs(((u * 28 + seed * 0.13) % 1) - 0.5) < 0.015 ||
        Math.abs(((v * 18 + seed * 0.19) % 1) - 0.5) < 0.012) &&
      v > 0.28;
    if (grid) {
      r += colors.neon[0] * 0.18;
      g += colors.neon[1] * 0.18;
      b += colors.neon[2] * 0.18;
    }

    const skyline = 0.34 + 0.3 * hash(Math.floor(u * 34), seed, variant);
    const building = v > skyline && hash(Math.floor(u * 54), 9, seed) > 0.22;
    if (building) {
      r *= 0.34;
      g *= 0.42;
      b *= 0.52;
      const lit =
        Math.abs(((u * 92 + seed) % 1) - 0.5) < 0.11 &&
        Math.abs(((v * 42 + variant) % 1) - 0.5) < 0.15 &&
        hash(Math.floor(u * 92), Math.floor(v * 42), seed) > 0.36;
      if (lit) {
        const c = hash(Math.floor(u * 120), Math.floor(v * 60), seed) > 0.5 ? colors.neon : colors.hot;
        r += c[0] * 0.78;
        g += c[1] * 0.78;
        b += c[2] * 0.78;
      }
    }

    const horizon = Math.exp(-Math.pow((v - 0.61) * 12, 2));
    r += colors.neon[0] * horizon * 0.34 + colors.warm[0] * lowerGlow * 0.18;
    g += colors.neon[1] * horizon * 0.34 + colors.warm[1] * lowerGlow * 0.18;
    b += colors.neon[2] * horizon * 0.34 + colors.warm[2] * lowerGlow * 0.18;

    if (rain > 0.985 && v < 0.84) {
      r += 96;
      g += 140;
      b += 166;
    }

    return [r, g, b, 255];
  };
}

function portraitPainter(seed) {
  const colors = palette(seed);
  return (u, v, x, y) => {
    const bg = cityPainter(seed + 1, 1)(u, v, x, y);
    const dx = (u - 0.5) / 0.22;
    const dy = (v - 0.45) / 0.34;
    const face = Math.hypot(dx, dy) < 1;
    const shoulder = v > 0.62 && Math.abs(u - 0.5) < 0.25 + (v - 0.62) * 0.9;
    const halo = Math.max(0, 1 - Math.hypot((u - 0.5) / 0.35, (v - 0.44) / 0.5));
    let [r, g, b] = bg;
    r += colors.hot[0] * halo * 0.28;
    g += colors.hot[1] * halo * 0.28;
    b += colors.hot[2] * halo * 0.28;

    if (shoulder) {
      r *= 0.24;
      g *= 0.28;
      b *= 0.36;
      const edge = Math.abs(Math.abs(u - 0.5) - (0.22 + (v - 0.62) * 0.52));
      if (edge < 0.011) {
        r += colors.neon[0] * 0.9;
        g += colors.neon[1] * 0.9;
        b += colors.neon[2] * 0.9;
      }
    }

    if (face) {
      r = r * 0.32 + 24;
      g = g * 0.32 + 28;
      b = b * 0.32 + 38;
      if (Math.abs(v - 0.45) < 0.014 && Math.abs(u - 0.5) < 0.13) {
        r += colors.hot[0];
        g += colors.hot[1];
        b += colors.hot[2];
      }
      if (Math.abs(u - 0.5) < 0.011 && v > 0.27 && v < 0.62) {
        r += colors.neon[0] * 0.7;
        g += colors.neon[1] * 0.7;
        b += colors.neon[2] * 0.7;
      }
    }

    if (Math.abs(((u + v) * 18 + seed) % 1 - 0.5) < 0.015) {
      r += colors.neon[0] * 0.16;
      g += colors.neon[1] * 0.16;
      b += colors.neon[2] * 0.16;
    }

    return [r, g, b, 255];
  };
}

writePng("hero-poster.png", 1920, 1080, cityPainter(2, 2));
writePng("contact-poster.png", 1920, 1080, portraitPainter(7));
writePng("project-01.png", 1300, 900, portraitPainter(1));
writePng("project-02.png", 1300, 900, cityPainter(5, 3));
writePng("project-03.png", 1300, 900, portraitPainter(3));
writePng("category-01.png", 900, 1100, cityPainter(9, 4));
writePng("category-02.png", 900, 1100, portraitPainter(6));
writePng("category-03.png", 900, 1100, cityPainter(11, 5));
writePng("category-04.png", 900, 1100, portraitPainter(10));

console.log(`Generated visual assets in ${outDir}`);
