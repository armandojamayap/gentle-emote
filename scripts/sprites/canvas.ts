import { encodePng } from "../../src/png.ts";

export type Color = string | null;
export type Palette = Record<string, Color>;

const rgbCache = new Map<string, [number, number, number]>();

function toRgb(hex: string): [number, number, number] {
  let rgb = rgbCache.get(hex);
  if (!rgb) {
    const n = Number.parseInt(hex.slice(1), 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, rgb);
  }
  return rgb;
}

const toHex = (r: number, g: number, b: number) =>
  `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

export class Canvas {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  set(x: number, y: number, color: Color): void {
    x = Math.round(x);
    y = Math.round(y);
    if (color === null || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b] = toRgb(color);
    const i = (y * this.width + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = 255;
  }

  clear(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data.fill(0, (y * this.width + x) * 4, (y * this.width + x) * 4 + 4);
  }

  get(x: number, y: number): Color {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const i = (y * this.width + x) * 4;
    return this.data[i + 3] === 0 ? null : toHex(this.data[i]!, this.data[i + 1]!, this.data[i + 2]!);
  }

  rect(x: number, y: number, w: number, h: number, color: Color): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, color);
  }

  /** Bresenham line with a square brush of `thick` pixels. */
  line(x0: number, y0: number, x1: number, y1: number, color: Color, thick = 1): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor((thick - 1) / 2);
    for (;;) {
      this.rect(x0 - off, y0 - off, thick, thick, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Polyline through points, useful for whips and yarn. */
  path(points: Array<[number, number]>, color: Color, thick = 1): void {
    for (let i = 1; i < points.length; i++) {
      this.line(points[i - 1]![0], points[i - 1]![1], points[i]![0], points[i]![1], color, thick);
    }
  }

  disc(cx: number, cy: number, r: number, color: Color): void {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + r * 0.6) this.set(cx + x, cy + y, color);
    }
  }

  ring(cx: number, cy: number, r: number, color: Color): void {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= r * r + r * 0.6 && d >= (r - 1) * (r - 1) + (r - 1) * 0.6) this.set(cx + x, cy + y, color);
    }
  }

  /** Draws a character map; '.' and unknown chars are transparent. */
  blit(rows: string[], x: number, y: number, palette: Palette, flipX = false): void {
    rows.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        const color = palette[ch];
        if (color === undefined || color === null) return;
        this.set(flipX ? x + row.length - 1 - dx : x + dx, y + dy, color);
      });
    });
  }

  /** Swaps exact colors inside a box (e.g. skin → soot). */
  recolor(x: number, y: number, w: number, h: number, swaps: Record<string, string>): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const current = this.get(x + dx, y + dy);
      if (current && swaps[current]) this.set(x + dx, y + dy, swaps[current]!);
    }
  }

  /** Copies opaque pixels from another canvas. */
  stamp(source: Canvas, x: number, y: number): void {
    for (let sy = 0; sy < source.height; sy++) for (let sx = 0; sx < source.width; sx++) {
      const color = source.get(sx, sy);
      if (color) this.set(x + sx, y + sy, color);
    }
  }

  /** Nearest-neighbor copy at `scale` (1 draws the source unchanged). */
  scaled(source: Canvas, x: number, y: number, scale: number): void {
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
      const color = source.get(Math.floor(dx / scale), Math.floor(dy / scale));
      if (color) this.set(x + dx, y + dy, color);
    }
  }

  /** Traces a 1px outline around opaque pixels onto transparent neighbors. */
  outline(color: string): void {
    const opaque = (x: number, y: number) => this.get(x, y) !== null;
    const marks: Array<[number, number]> = [];
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      if (opaque(x, y)) continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) marks.push([x, y]);
    }
    for (const [x, y] of marks) this.set(x, y, color);
  }

  toPng(): Buffer {
    return encodePng({ width: this.width, height: this.height, data: this.data });
  }
}

/** Validates that every row of a map has the same width (catches hand-drawing slips). */
export function sprite(name: string, rows: string[]): string[] {
  const width = rows[0]!.length;
  rows.forEach((row, i) => {
    if (row.length !== width) throw new Error(`sprite "${name}" row ${i} is ${row.length} wide, expected ${width}`);
  });
  return rows;
}

const GLYPHS: Record<string, string[]> = {
  I: ["###", ".#.", ".#.", ".#.", "###"],
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  C: [".##", "#..", "#..", "#..", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  Z: ["###", "..#", ".#.", "#..", "###"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  L: ["#..", "#..", "#..", "#..", "###"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  "%": ["#.#", "..#", ".#.", "#..", "#.#"],
  "/": ["..#", "..#", ".#.", "#..", "#.."],
  "?": ["##.", "..#", ".#.", "...", ".#."],
  "!": [".#.", ".#.", ".#.", "...", ".#."],
  "{": [".##", ".#.", "#..", ".#.", ".##"],
  "}": ["##.", ".#.", "..#", ".#.", "##."],
  ";": ["...", ".#.", "...", ".#.", "#.."],
  ".": ["...", "...", "...", "...", ".#."],
};

export function text(cv: Canvas, value: string, x: number, y: number, color: string): void {
  let cursor = x;
  for (const ch of value) {
    const glyph = GLYPHS[ch];
    if (glyph) cv.blit(glyph, cursor, y, { "#": color });
    cursor += glyphWidth(ch) + 1;
  }
}

function glyphWidth(ch: string): number {
  return GLYPHS[ch]?.[0]?.length ?? 3;
}

export function textWidth(value: string): number {
  return [...value].reduce((sum, ch) => sum + glyphWidth(ch) + 1, 0) - 1;
}
