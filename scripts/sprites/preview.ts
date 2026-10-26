import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "../../src/png.ts";
import { BANNER_ACCENTS, createAccentTransform } from "../../src/accent.ts";

/**
 * Contact sheet of every frame, upscaled, recolored and on a terminal-like
 * background: `node scripts/sprites/preview.ts [accent] [out.png]`.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "emotes", "gentleman");
const accentName = process.argv[2] ?? "pink";
const out = process.argv[3] ?? join(root, "..", "..", `preview-${accentName}.png`);
const transform = createAccentTransform(BANNER_ACCENTS[accentName] ?? BANNER_ACCENTS.pink!);

const only = process.argv[4]?.split(",");
const SCALE = only ? 10 : 6;
const PAD = 8;
const BG = [24, 22, 30];

const states = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  .filter((name) => !only || only.includes(name)).sort();
const rows = states.map((state) => readdirSync(join(root, state)).filter((f) => f.endsWith(".png")).sort().map((file) =>
  decodePng(Buffer.from(transform(readFileSync(join(root, state, file)).toString("base64")), "base64"))));

const cellW = 48 * SCALE + PAD;
const cellH = 40 * SCALE + PAD;
const cols = Math.max(...rows.map((r) => r.length));
const width = cols * cellW + PAD;
const height = rows.length * cellH + PAD;
const data = new Uint8Array(width * height * 4);
for (let i = 0; i < width * height; i++) data.set([BG[0]!, BG[1]!, BG[2]!, 255], i * 4);

rows.forEach((images, row) => images.forEach((img, col) => {
  const ox = PAD + col * cellW;
  const oy = PAD + row * cellH;
  for (let y = 0; y < img.height * SCALE; y++) for (let x = 0; x < img.width * SCALE; x++) {
    const s = (Math.floor(y / SCALE) * img.width + Math.floor(x / SCALE)) * 4;
    const d = ((oy + y) * width + ox + x) * 4;
    const a = img.data[s + 3]! / 255;
    if (a === 0) {
      // Faint frame of the cell so empty space is visible.
      if (x === 0 || y === 0 || x === img.width * SCALE - 1 || y === img.height * SCALE - 1) data.set([60, 56, 70, 255], d);
      continue;
    }
    for (let c = 0; c < 3; c++) data[d + c] = Math.round(img.data[s + c]! * a + data[d + c]! * (1 - a));
  }
}));

writeFileSync(out, encodePng({ width, height, data }));
console.log(`preview: ${states.join(", ")} → ${out}`);
