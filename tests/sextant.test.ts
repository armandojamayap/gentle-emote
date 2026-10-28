import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { visibleWidth } from "@earendil-works/pi-tui";
import { cellColours, sextantChar, sextantRows, toSextantLines } from "../src/sextant.ts";
import { SextantRenderer } from "../src/render_halfblock.ts";
import type { RgbaImage } from "../src/png.ts";

type Px = [number, number, number, number];
const RED: Px = [255, 0, 0, 255];
const DARK_RED: Px = [200, 0, 0, 255];
const BLUE: Px = [0, 0, 255, 255];
const NONE: Px = [0, 0, 0, 0];

function image(width: number, rows: Px[][]): RgbaImage {
  return { width, height: rows.length, data: new Uint8Array(rows.flat().flat()) };
}

test("sextantChar follows the Unicode sextant order and reuses existing block elements", () => {
  assert.equal(sextantChar(0), " ");
  assert.equal(sextantChar(1), "\u{1FB00}"); // top-left only
  assert.equal(sextantChar(20), "\u{1FB13}"); // last before the left half
  assert.equal(sextantChar(21), "▌"); // left half
  assert.equal(sextantChar(22), "\u{1FB14}");
  assert.equal(sextantChar(42), "▐"); // right half
  assert.equal(sextantChar(62), "\u{1FB3B}"); // last sextant
  assert.equal(sextantChar(63), "█"); // full block
  const sextants = new Set(Array.from({ length: 62 }, (_, i) => sextantChar(i + 1)));
  assert.equal(sextants.size, 62, "every mask maps to its own character");
});

test("cellColours keeps the pair with the least colour error", () => {
  const colours = cellColours([[255, 0, 0], [255, 0, 0], [200, 0, 0], [0, 0, 255], [0, 0, 255], [255, 0, 0]]);
  assert.deepEqual(colours, [[255, 0, 0], [0, 0, 255]]);
});

test("cellColours never trades transparency for a colour when a closer colour exists", () => {
  const colours = cellColours([null, null, [255, 0, 0], [200, 0, 0], null, null]);
  assert.ok(colours.includes(null));
});

test("toSextantLines draws a 2x3 cell with its exact mask and colours", () => {
  // Left column red, right column blue: the left-half mask, red over blue.
  const lines = toSextantLines(image(2, [[RED, BLUE], [RED, BLUE], [RED, BLUE]]), 1, 1);
  assert.deepEqual(lines, ["\x1b[38;2;255;0;0m\x1b[48;2;0;0;255m▌\x1b[0m"]);
});

test("toSextantLines keeps transparent sub-pixels on the default background", () => {
  const lines = toSextantLines(image(2, [[RED, NONE], [NONE, NONE], [NONE, NONE]]), 1, 1);
  assert.deepEqual(lines, ["\x1b[38;2;255;0;0m\x1b[49m\u{1FB00}\x1b[0m"]);
  assert.deepEqual(toSextantLines(image(2, [[NONE, NONE], [NONE, NONE], [NONE, NONE]]), 1, 1), [" "]);
});

test("toSextantLines draws a uniform cell as a full block", () => {
  const lines = toSextantLines(image(2, [[DARK_RED, DARK_RED], [DARK_RED, DARK_RED], [DARK_RED, DARK_RED]]), 1, 1);
  assert.deepEqual(lines, ["\x1b[38;2;200;0;0m\x1b[49m█\x1b[0m"]);
});

test("sextantRows keeps the sprite's aspect ratio for the cell size", () => {
  assert.equal(sextantRows({ width: 48, height: 40 }, 16, { widthPx: 9, heightPx: 18 }), 7);
  assert.equal(sextantRows({ width: 48, height: 40 }, 24, { widthPx: 8, heightPx: 16 }), 10);
});

test("SextantRenderer draws the gentleman 16 cells wide and 7 rows tall", () => {
  const renderer = new SextantRenderer(16);
  renderer.loadFrames(join(import.meta.dirname, "..", "emotes", "gentleman"), "");
  assert.ok(renderer.showRandomFrame("idle"));
  const frame = renderer.getRenderedFrame();
  assert.equal(frame?.kind, "placeholder");
  if (frame?.kind !== "placeholder") return;
  assert.equal(frame.cols, 16);
  assert.equal(frame.rows, 7);
  assert.ok(frame.lines.every((line) => visibleWidth(line) === 16));
  assert.ok(frame.lines.join("").match(/[\u{1FB00}-\u{1FB3B}]/u), "uses sextant characters");
});
