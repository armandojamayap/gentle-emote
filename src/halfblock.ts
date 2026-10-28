import type { RgbaImage } from "./png.ts";

/** Pixels at or below this alpha are drawn as the terminal background. */
export const ALPHA_CUTOFF = 128;
const UPPER_HALF = "▀";
const LOWER_HALF = "▄";

/**
 * Pixel-art downscale to `cols` pixels wide, keeping the aspect ratio. Each
 * target pixel takes the colour that covers most of its source area (or stays
 * transparent when transparency covers more), so the palette stays exact and
 * edges stay crisp instead of blending into muddy averages.
 */
export function downscale(image: RgbaImage, cols: number): RgbaImage {
  const width = Math.max(1, Math.min(image.width, Math.round(cols)));
  if (width === image.width) return image;
  return resample(image, width, Math.max(1, Math.round((image.height * width) / image.width)));
}

/**
 * Resamples to exactly `width` x `height` pixels with the same dominant-colour
 * rule as {@link downscale}; used when the target cells are not square.
 */
export function resample(image: RgbaImage, width: number, height: number): RgbaImage {
  const out = new Uint8Array(width * height * 4);
  const sx = image.width / width;
  const sy = image.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = y * sy, y1 = (y + 1) * sy;
    for (let x = 0; x < width; x++) {
      const x0 = x * sx, x1 = (x + 1) * sx;
      const coverage = new Map<number, number>();
      let clear = 0;
      for (let py = Math.floor(y0); py < Math.ceil(y1); py++) {
        const wy = Math.min(y1, py + 1) - Math.max(y0, py);
        for (let px = Math.floor(x0); px < Math.ceil(x1); px++) {
          const w = (Math.min(x1, px + 1) - Math.max(x0, px)) * wy;
          if (w <= 0) continue;
          const at = (py * image.width + px) * 4;
          if (image.data[at + 3]! <= ALPHA_CUTOFF) {
            clear += w;
            continue;
          }
          const rgb = (image.data[at]! << 16) | (image.data[at + 1]! << 8) | image.data[at + 2]!;
          coverage.set(rgb, (coverage.get(rgb) ?? 0) + w);
        }
      }
      let best = -1, bestArea = 0;
      for (const [rgb, area] of coverage) {
        if (area > bestArea) { best = rgb; bestArea = area; }
      }
      if (best < 0 || bestArea < clear) continue;
      const at = (y * width + x) * 4;
      out[at] = (best >> 16) & 255;
      out[at + 1] = (best >> 8) & 255;
      out[at + 2] = best & 255;
      out[at + 3] = 255;
    }
  }
  return { width, height, data: out };
}

function pixel(image: RgbaImage, x: number, y: number): [number, number, number] | null {
  if (y >= image.height) return null;
  const at = (y * image.width + x) * 4;
  if (image.data[at + 3]! <= ALPHA_CUTOFF) return null;
  return [image.data[at]!, image.data[at + 1]!, image.data[at + 2]!];
}

const fg = ([r, g, b]: [number, number, number]) => `\x1b[38;2;${r};${g};${b}m`;
const bg = ([r, g, b]: [number, number, number]) => `\x1b[48;2;${r};${g};${b}m`;

/**
 * Draws the image as truecolor text: each cell holds two vertical pixels
 * (upper half block, foreground over background). Transparent pixels keep the
 * terminal background, so the avatar blends into any theme. Every row is
 * exactly `image.width` cells wide and resets its colours at the end.
 */
export function toHalfblockLines(image: RgbaImage): string[] {
  const lines: string[] = [];
  for (let y = 0; y < image.height; y += 2) {
    let line = "";
    let open = false;
    for (let x = 0; x < image.width; x++) {
      const top = pixel(image, x, y);
      const bottom = pixel(image, x, y + 1);
      if (!top && !bottom) {
        line += open ? `\x1b[0m ` : " ";
        open = false;
      } else if (top && bottom) {
        line += `${fg(top)}${bg(bottom)}${UPPER_HALF}`;
        open = true;
      } else {
        // One opaque half: draw it as foreground on the default background.
        line += `\x1b[49m${fg((top ?? bottom)!)}${top ? UPPER_HALF : LOWER_HALF}`;
        open = true;
      }
    }
    lines.push(open ? `${line}\x1b[0m` : line);
  }
  return lines;
}
