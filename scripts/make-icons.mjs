// Renders the extension icon at each required size: a purple rounded square
// with two stacked "tab" cards collapsing into one — the front card wearing a
// happy little face. Rendered at 4x and box downsampled for anti-aliasing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.mjs';

const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;

const BG_TOP = [0x9d, 0x71, 0xea]; // lighter purple
const BG_BOTTOM = [0x7b, 0x46, 0xd4]; // GitHub-ish PR purple
const FACE = [0x6f, 0x3d, 0xc4]; // deep purple for the face
const CORNER_RADIUS = 0.24; // fraction of icon size

// Unit-square geometry (x, y, w, h, radius, alpha). Back card first; the
// front card gets the face.
const CARDS = [
  { x: 0.34, y: 0.16, w: 0.5, h: 0.5, r: 0.11, a: 0.45 },
  { x: 0.16, y: 0.34, w: 0.5, h: 0.5, r: 0.11, a: 1.0 },
];

// Face geometry, relative to the front card's center (0.41, 0.59).
const EYES = [
  { x: 0.325, y: 0.535, r: 0.034 },
  { x: 0.495, y: 0.535, r: 0.034 },
];
const SMILE = { x: 0.41, y: 0.58, r: 0.1, thickness: 0.05, minDy: 0.35 };

function insideFace(u, v) {
  for (const eye of EYES) {
    if (Math.hypot(u - eye.x, v - eye.y) <= eye.r) return true;
  }
  const dx = u - SMILE.x;
  const dy = v - SMILE.y;
  const dist = Math.hypot(dx, dy);
  return (
    Math.abs(dist - SMILE.r) <= SMILE.thickness / 2 &&
    dy >= SMILE.r * SMILE.minDy
  );
}

// Signed-distance test for a rounded rectangle.
function insideRoundedRect(px, py, x, y, w, h, r) {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) <= r;
}

function renderSize(size) {
  const big = size * SUPERSAMPLE;
  const bigPixels = new Float64Array(big * big * 4);

  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      const u = (x + 0.5) / big;
      const v = (y + 0.5) / big;
      const i = (y * big + x) * 4;

      if (!insideRoundedRect(u, v, 0, 0, 1, 1, CORNER_RADIUS)) continue;

      // Vertical gradient background.
      let r = BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * v;
      let g = BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * v;
      let b = BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * v;

      let onFrontCard = false;
      for (const card of CARDS) {
        if (insideRoundedRect(u, v, card.x, card.y, card.w, card.h, card.r)) {
          r = r + (255 - r) * card.a;
          g = g + (255 - g) * card.a;
          b = b + (255 - b) * card.a;
          onFrontCard = card.a === 1.0;
        }
      }

      if (onFrontCard && insideFace(u, v)) {
        [r, g, b] = FACE;
      }

      bigPixels[i] = r;
      bigPixels[i + 1] = g;
      bigPixels[i + 2] = b;
      bigPixels[i + 3] = 255;
    }
  }

  // Box downsample.
  const rgba = new Uint8Array(size * size * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const i =
            ((y * SUPERSAMPLE + sy) * big + (x * SUPERSAMPLE + sx)) * 4;
          acc[0] += bigPixels[i];
          acc[1] += bigPixels[i + 1];
          acc[2] += bigPixels[i + 2];
          acc[3] += bigPixels[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      for (let c = 0; c < 4; c++) rgba[o + c] = Math.round(acc[c] / samples);
    }
  }

  return encodePng(size, size, rgba);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  const file = join(outDir, `icon${size}.png`);
  writeFileSync(file, renderSize(size));
  console.log(`wrote ${file}`);
}
