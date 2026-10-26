import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Container } from "@earendil-works/pi-tui";
import { composeFramed, frameCols, parseAnsiForeground } from "../src/frame_image.ts";
import { decodePng } from "../src/png.ts";
import { installGutter, layoutBesideEditor } from "../src/gutter.ts";

const IDLE = join(import.meta.dirname, "..", "emotes", "gentleman", "idle", "idle.png");
const BORDER: [number, number, number] = [200, 100, 50];

const pixel = (image: { width: number; data: Uint8Array }, x: number, y: number) => {
  const at = (y * image.width + x) * 4;
  return [image.data[at], image.data[at + 1], image.data[at + 2], image.data[at + 3]];
};

test("the framed image has a rounded border and the bust rests on its bottom edge", () => {
  const sprite = decodePng(readFileSync(IDLE));
  const framed = composeFramed(sprite, 110, 80, 1, BORDER);
  assert.deepEqual([framed.width, framed.height], [110, 80]);
  assert.deepEqual(pixel(framed, 55, 0), [...BORDER, 255], "top border");
  assert.deepEqual(pixel(framed, 55, 79), [...BORDER, 255], "bottom border");
  assert.deepEqual(pixel(framed, 0, 40), [...BORDER, 255], "left border");
  assert.equal(pixel(framed, 0, 0)[3], 0, "rounded corner stays transparent");
  assert.equal(pixel(framed, 55, 78)[3], 255, "the shirt touches the bottom border: no gap under the bust");
});

test("frame columns grow with the cell aspect so the sprite is never cropped", () => {
  const sprite = { width: 48, height: 40 };
  const cols = frameCols(4, { widthPx: 9, heightPx: 20 }, sprite, 1);
  assert.ok(cols * 9 >= ((4 * 20 - 2) * 48) / 40 + 2);
  assert.ok((cols - 1) * 9 < ((4 * 20 - 2) * 48) / 40 + 2);
});

test("theme colours are read from truecolor and 256-colour foregrounds", () => {
  assert.deepEqual(parseAnsiForeground("\x1b[38;2;95;210;255mx\x1b[39m"), [95, 210, 255]);
  assert.deepEqual(parseAnsiForeground("\x1b[1;38;5;196mx\x1b[0m"), [255, 0, 0]);
  assert.equal(parseAnsiForeground("x"), null);
});

const placeholderAvatar = { lines: ["IIII", "IIII", "IIII", "IIII"], cols: 4 };

test("a padded float prompt grows to the frame height and keeps its own margin as the gap", () => {
  const layout = layoutBesideEditor(placeholderAvatar, [" ▎ waiting", " ▎ > ", " ▎   "]);
  assert.equal(layout.lines.length, 4);
  assert.equal(layout.editorTop, 0);
  assert.equal(layout.editorLeft, 4, "no extra gap column before a prompt that starts with a space");
  assert.equal(layout.lines[0], "IIII ▎ waiting");
  assert.equal(layout.lines[3], "IIII ▎   ");
});

test("a drawn box prompt keeps its shape: padded on top, one gap column, border not repeated", () => {
  const layout = layoutBesideEditor(placeholderAvatar, ["╭──╮", "│> │", "╰──╯"]);
  assert.equal(layout.editorTop, 1);
  assert.equal(layout.editorLeft, 5);
  assert.equal(layout.lines.filter((line) => line.includes("╰──╯")).length, 1);
  assert.equal(layout.lines[3], "IIII ╰──╯");
});

test("mouse events skip the avatar and the top padding", () => {
  const container = new Container();
  const seen: Array<{ x?: number; y: number }> = [];
  container.addChild({
    render: (width: number) => ["╭" + "─".repeat(width - 2) + "╮", "╰" + "─".repeat(width - 2) + "╯"],
    handleMouse: (event: { x?: number; y: number }) => { seen.push({ x: event.x, y: event.y }); return { render: true }; },
  } as any);
  const restore = installGutter(container, () => placeholderAvatar);
  const lines = container.render(40);
  assert.equal(lines.length, 4);
  assert.equal(container.handleMouse!({ x: 20, y: 0, width: 40, height: 4 }), undefined, "padding row above the prompt");
  assert.equal(container.handleMouse!({ x: 2, y: 3, width: 40, height: 4 }), undefined, "click on the avatar");
  container.handleMouse!({ x: 20, y: 3, width: 40, height: 4 });
  assert.deepEqual(seen, [{ x: 15, y: 1 }]);
  restore();
});
