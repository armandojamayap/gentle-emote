import type { RgbaImage } from "./png.ts";
import { ALPHA_CUTOFF, resample } from "./halfblock.ts";

type Rgb = [number, number, number];
/** One sub-pixel: a colour, or null for transparent (terminal background). */
type Sub = Rgb | null;

const SUB_COLS = 2;
const SUB_ROWS = 3;
/** Cost of drawing a transparent sub-pixel opaque (or the reverse): worse than any colour swap. */
const TRANSPARENCY_COST = 3 * 255 * 255 + 1;

/**
 * Character for a 2x3 sub-pixel mask. Bit `row * 2 + col` set means that
 * sub-pixel takes the foreground colour. Unicode encodes the 60 sextants at
 * U+1FB00.. in mask order, skipping the three patterns that already exist as
 * block elements: left half (mask 21), right half (42) and full block (63).
 */
export function sextantChar(mask: number): string {
  if (mask <= 0) return " ";
  if (mask >= 63) return "█";
  if (mask === 21) return "▌";
  if (mask === 42) return "▐";
  return String.fromCodePoint(0x1fb00 + mask - 1 - (mask > 21 ? 1 : 0) - (mask > 42 ? 1 : 0));
}

const same = (a: Sub, b: Sub) => a === b || (a !== null && b !== null && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);

function cost(pixel: Sub, colour: Sub): number {
  if (pixel === null || colour === null) return pixel === colour ? 0 : TRANSPARENCY_COST;
  return (pixel[0] - colour[0]) ** 2 + (pixel[1] - colour[1]) ** 2 + (pixel[2] - colour[2]) ** 2;
}

/**
 * A cell can show two colours. With more, keep the pair that represents its
 * six sub-pixels with the least colour error; transparency is never traded
 * for a colour while a closer choice exists.
 */
export function cellColours(subs: Sub[]): [Sub, Sub] {
  const distinct: Sub[] = [];
  for (const sub of subs) if (!distinct.some((seen) => same(seen, sub))) distinct.push(sub);
  if (distinct.length === 1) return [distinct[0]!, distinct[0]!];
  let best: [Sub, Sub] = [distinct[0]!, distinct[1]!];
  let bestError = Infinity;
  for (let i = 0; i < distinct.length; i++) {
    for (let j = i + 1; j < distinct.length; j++) {
      const a = distinct[i]!, b = distinct[j]!;
      const error = subs.reduce((sum, sub) => sum + Math.min(cost(sub, a), cost(sub, b)), 0);
      if (error < bestError) {
        bestError = error;
        best = [a, b];
      }
    }
  }
  return best;
}

const fg = ([r, g, b]: Rgb) => `\x1b[38;2;${r};${g};${b}m`;
const bg = ([r, g, b]: Rgb) => `\x1b[48;2;${r};${g};${b}m`;

function subPixel(image: RgbaImage, x: number, y: number): Sub {
  const at = (y * image.width + x) * 4;
  if (image.data[at + 3]! <= ALPHA_CUTOFF) return null;
  return [image.data[at]!, image.data[at + 1]!, image.data[at + 2]!];
}

/** One text cell: the opaque colour of the pair is the foreground, so transparency keeps the default background. */
function cell(subs: Sub[]): { text: string; coloured: boolean } {
  let [front, back] = cellColours(subs);
  if (front === null) [front, back] = [back, front];
  if (front === null) return { text: " ", coloured: false };
  let mask = 0;
  subs.forEach((sub, index) => {
    if (cost(sub, front) <= cost(sub, back)) mask |= 1 << index;
  });
  const background = back === null || same(front, back) ? "\x1b[49m" : bg(back);
  return { text: `${fg(front)}${background}${sextantChar(same(front, back) ? 63 : mask)}`, coloured: true };
}

/**
 * Draws the image in `cols` x `rows` cells of 2x3 sub-pixels each (Unicode
 * sextants): three times the detail of half blocks in the same space. The
 * image is resampled by dominant colour to fill the cells exactly. Every row
 * is `cols` cells wide and resets its colours at the end.
 */
export function toSextantLines(image: RgbaImage, cols: number, rows: number): string[] {
  const grid = resample(image, cols * SUB_COLS, rows * SUB_ROWS);
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = "";
    let open = false;
    for (let col = 0; col < cols; col++) {
      const subs: Sub[] = [];
      for (let y = 0; y < SUB_ROWS; y++) {
        for (let x = 0; x < SUB_COLS; x++) subs.push(subPixel(grid, col * SUB_COLS + x, row * SUB_ROWS + y));
      }
      const drawn = cell(subs);
      if (!drawn.coloured && open) line += "\x1b[0m";
      line += drawn.text;
      open = drawn.coloured;
    }
    lines.push(open ? `${line}\x1b[0m` : line);
  }
  return lines;
}

/** Rows that keep the sprite's aspect ratio at `cols` cells of the given pixel size. */
export function sextantRows(image: { width: number; height: number }, cols: number, cell: { widthPx: number; heightPx: number }): number {
  return Math.max(1, Math.round((cols * cell.widthPx * image.height) / (image.width * cell.heightPx)));
}
