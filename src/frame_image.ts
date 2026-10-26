import { decodePng, encodePng } from "./png.ts";
import type { RgbaImage } from "./png.ts";

export type Rgb = [number, number, number];

export interface CellSize {
  widthPx: number;
  heightPx: number;
}

/** A rounded box `cols` x `rows` cells big, drawn into the avatar image itself. */
export interface FrameBox {
  cols: number;
  rows: number;
  /** Border thickness in device pixels. */
  stroke: number;
  color: Rgb;
}

const DEFAULT_BORDER: Rgb = [110, 110, 125];

/** About the weight of a box-drawing line at this cell size. */
export function frameStroke(cell: CellSize): number {
  return Math.max(1, Math.round(cell.widthPx / 9));
}

/** Columns for a `rows`-tall box so the sprite fills its height without being cropped. */
export function frameCols(rows: number, cell: CellSize, sprite: { width: number; height: number }, stroke: number): number {
  const innerHeight = rows * cell.heightPx - 2 * stroke;
  const innerWidth = (innerHeight * sprite.width) / sprite.height;
  return Math.max(1, Math.ceil((innerWidth + 2 * stroke) / cell.widthPx));
}

function insideRoundedRect(x: number, y: number, left: number, top: number, right: number, bottom: number, radius: number): boolean {
  if (x < left || x >= right || y < top || y >= bottom) return false;
  const cx = x + 0.5 < left + radius ? left + radius : x + 0.5 > right - radius ? right - radius : x + 0.5;
  const cy = y + 0.5 < top + radius ? top + radius : y + 0.5 > bottom - radius ? bottom - radius : y + 0.5;
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * The sprite scaled nearest-neighbour (crisp pixels), centered and resting on
 * the bottom border of a rounded frame that fills the whole `widthPx` x `heightPx`.
 */
export function composeFramed(sprite: RgbaImage, widthPx: number, heightPx: number, stroke: number, color: Rgb): RgbaImage {
  const out = new Uint8Array(widthPx * heightPx * 4);
  const radius = Math.max(stroke * 3, Math.round(Math.min(widthPx, heightPx) / 10));
  const innerRadius = Math.max(0, radius - stroke);
  const inLeft = stroke, inTop = stroke, inRight = widthPx - stroke, inBottom = heightPx - stroke;

  const scale = Math.min((inRight - inLeft) / sprite.width, (inBottom - inTop) / sprite.height);
  const drawnW = Math.round(sprite.width * scale);
  const drawnH = Math.round(sprite.height * scale);
  const offsetX = inLeft + Math.floor((inRight - inLeft - drawnW) / 2);
  const offsetY = inBottom - drawnH;

  for (let y = 0; y < heightPx; y++) {
    for (let x = 0; x < widthPx; x++) {
      const at = (y * widthPx + x) * 4;
      if (!insideRoundedRect(x, y, 0, 0, widthPx, heightPx, radius)) continue;
      if (!insideRoundedRect(x, y, inLeft, inTop, inRight, inBottom, innerRadius)) {
        out[at] = color[0]; out[at + 1] = color[1]; out[at + 2] = color[2]; out[at + 3] = 255;
        continue;
      }
      const sx = Math.floor((x - offsetX) / scale);
      const sy = Math.floor((y - offsetY) / scale);
      if (sx < 0 || sy < 0 || sx >= sprite.width || sy >= sprite.height) continue;
      const from = (sy * sprite.width + sx) * 4;
      out[at] = sprite.data[from]!;
      out[at + 1] = sprite.data[from + 1]!;
      out[at + 2] = sprite.data[from + 2]!;
      out[at + 3] = sprite.data[from + 3]!;
    }
  }
  return { width: widthPx, height: heightPx, data: out };
}

/** Frames a base64 PNG sprite into a base64 PNG exactly `box` cells big. */
export function framePngBase64(base64: string, box: FrameBox, cell: CellSize): string {
  const sprite = decodePng(Buffer.from(base64, "base64"));
  const framed = composeFramed(sprite, box.cols * cell.widthPx, box.rows * cell.heightPx, box.stroke, box.color);
  return encodePng(framed).toString("base64");
}

const XTERM_LEVELS = [0, 95, 135, 175, 215, 255];
const XTERM_BASE: Rgb[] = [
  [0, 0, 0], [205, 0, 0], [0, 205, 0], [205, 205, 0], [0, 0, 238], [205, 0, 205], [0, 205, 205], [229, 229, 229],
  [127, 127, 127], [255, 0, 0], [0, 255, 0], [255, 255, 0], [92, 92, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
];

function xterm256(index: number): Rgb {
  if (index < 16) return XTERM_BASE[index]!;
  if (index >= 232) {
    const level = 8 + (index - 232) * 10;
    return [level, level, level];
  }
  const cube = index - 16;
  return [XTERM_LEVELS[Math.floor(cube / 36)]!, XTERM_LEVELS[Math.floor(cube / 6) % 6]!, XTERM_LEVELS[cube % 6]!];
}

/** Foreground colour of a themed string (truecolor or 256-colour SGR), if any. */
export function parseAnsiForeground(painted: string): Rgb | null {
  const truecolor = painted.match(/\x1b\[(?:[\d;]*;)?38;2;(\d+);(\d+);(\d+)/);
  if (truecolor) return [Number(truecolor[1]), Number(truecolor[2]), Number(truecolor[3])];
  const indexed = painted.match(/\x1b\[(?:[\d;]*;)?38;5;(\d+)/);
  if (indexed) return xterm256(Number(indexed[1]));
  return null;
}

export function defaultBorderColor(): Rgb {
  return [...DEFAULT_BORDER];
}
