import { BaseImageRenderer } from "./render_image.ts";
import type { ImageDims } from "./render_image.ts";
import { decodePng } from "./png.ts";
import type { RgbaImage } from "./png.ts";
import { downscale, toHalfblockLines } from "./halfblock.ts";
import { log } from "./log.ts";

/**
 * Base for renderers that draw each PNG frame as truecolor text rows.
 *
 * They need no image protocol, so they work in terminals that have none
 * (Windows Terminal, xterm.js-based terminals, ...). Being plain text, the
 * rows survive TUI redraws and fit the prompt gutter like the kitty
 * placeholder rows. Converted frames are cached per frame.
 */
abstract class TextPixelRenderer extends BaseImageRenderer {
  protected cursorAdvances = false;
  private linesCache = new Map<string, { lines: string[]; cols: number }>();

  /** Converts one decoded sprite into text rows `cols` cells wide. */
  protected abstract toLines(image: RgbaImage): { lines: string[]; cols: number };

  protected encode(_base64: string, _dims: ImageDims, _rows: number, _yOffset: number): string | null {
    return null;
  }

  private linesFor(base64: string): { lines: string[]; cols: number } {
    let entry = this.linesCache.get(base64);
    if (!entry) {
      entry = this.toLines(decodePng(Buffer.from(base64, "base64")));
      this.linesCache.set(base64, entry);
    }
    return entry;
  }

  protected show(base64: string, force = false): boolean {
    if (!force && base64 === this.lastShownBase64) return true;
    this.lastShownBase64 = base64;
    try {
      const { lines, cols } = this.linesFor(base64);
      this.currentFrame = { kind: "placeholder", lines, rows: lines.length, cols, framed: false };
    } catch (error) {
      log(`${this.constructor.name}.show: ${error instanceof Error ? error.message : String(error)}`);
      this.currentFrame = null;
    }
    this.tuiRef?.requestRender();
    return true;
  }

  loadFrames(...args: Parameters<BaseImageRenderer["loadFrames"]>) {
    this.linesCache.clear();
    super.loadFrames(...args);
  }

  dispose() {
    this.linesCache.clear();
    this.currentFrame = null;
  }
}

/**
 * Half blocks: one cell holds two vertical pixels (`▀`, foreground = upper,
 * background = lower). Any truecolor terminal draws it. `size` is the width
 * in cells, which is also the sprite width in pixels after scaling.
 */
export class HalfblockRenderer extends TextPixelRenderer {
  protected toLines(image: RgbaImage) {
    const scaled = downscale(image, this.size);
    return { lines: toHalfblockLines(scaled), cols: scaled.width };
  }
}
