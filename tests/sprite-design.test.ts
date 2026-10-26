import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { decodePng } from "../src/png.ts";
import { newCanvas, drawHead, setYoloLook, C } from "../scripts/sprites/gentleman.ts";

import { text } from "../scripts/sprites/canvas.ts";

const root = join(import.meta.dirname, "..", "emotes");
const pixel = (png: ReturnType<typeof decodePng>, x: number, y: number) =>
  [...png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 4)];
const count = (png: ReturnType<typeof decodePng>, rgb: number[], x0 = 0, y0 = 0, x1 = 48, y1 = 40) => {
  let total = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const p = pixel(png, x, y);
    if (p[3] === 255 && rgb.every((v, i) => p[i] === v)) total++;
  }
  return total;
};

for (const set of ["gentleman", "gentleman-yolo"]) {
  test(`${set}: elephant silhouette fits, with a shaded ear and all dynamic accents`, () => {
    for (const name of ["remember_1", "remember_2"]) {
      const png = decodePng(readFileSync(join(root, set, "remember", `${name}.png`)));
      for (let y = 0; y < 40; y++) assert.equal(pixel(png, 47, y)[3], 0, "trunk must not be clipped");
      for (const rgb of [[255, 0, 255], [170, 0, 170], [255, 128, 255]]) {
        assert.ok(count(png, rgb, 24, 4) > 2, "elephant outline must carry each dynamic accent");
      }
      assert.ok(count(png, [167, 163, 173], 24, 4) > 15, "large gray ear remains visible");
    }
  });
  test(`${set}: explorer keeps beam, footprints and gait inside the frame`, () => {
    const images = [1, 2, 3].map((n) => decodePng(readFileSync(join(root, set, "explore", `explore_${n}.png`))));
    for (const png of images) {
      for (let y = 0; y < 40; y++) for (const x of [0, 47]) assert.equal(pixel(png, x, y)[3], 0);
      for (let x = 0; x < 48; x++) assert.equal(pixel(png, x, 39)[3], 0);
      assert.ok(count(png, [226, 184, 90], 28, 22) > 25, "visible flashlight beam");
      assert.ok(count(png, [58, 42, 22], 28, 25) >= 10, "visible footprint silhouettes");
    }
    assert.equal(new Set(images.map((p) => Buffer.from(p.data.slice(30 * 48 * 4)).toString("hex"))).size, 3, "three distinct walking poses");
  });
}

test("YOLO thinking uses the rocket, while normal thinking retains the bulb", () => {
  for (const name of ["think_1", "think_2"]) {
    const normal = decodePng(readFileSync(join(root, "gentleman", "think", `${name}.png`)));
    const yolo = decodePng(readFileSync(join(root, "gentleman-yolo", "think", `${name}.png`)));
    assert.ok(count(yolo, [255, 80, 80], 33, 0) > 8, "YOLO rocket nose and fins");
    assert.equal(count(yolo, [255, 224, 102], 12, 0, 30, 12), 0, "no bulb above YOLO head");
    assert.ok(count(normal, name === "think_1" ? [138, 138, 150] : [255, 224, 102], 12, 0, 30, 10) > 20);
  }
});

test("redesigned frames remain native opaque pixel art with distinct animation frames", () => {
  for (const set of ["gentleman", "gentleman-yolo"]) for (const state of ["remember", "explore", "yolo"]) {
    const pngs = readdirSync(join(root, set, state)).filter((f) => f.endsWith(".png")).map((f) => decodePng(readFileSync(join(root, set, state, f))));
    for (const png of pngs) {
      assert.deepEqual([png.width, png.height], [48, 40]);
      for (let i = 3; i < png.data.length; i += 4) assert.ok(png.data[i] === 0 || png.data[i] === 255);
    }
    assert.equal(new Set(pngs.map((p) => Buffer.from(p.data).toString("hex"))).size, pngs.length);
  }
});


test("explorer uses the original Gentleman face at native resolution", () => {
  for (const [set, yolo] of [["gentleman", false], ["gentleman-yolo", true]] as const) {
    setYoloLook(yolo);
    try {
      for (const step of [0, 1, 2]) {
        const hy = 2 + (step === 1 ? 1 : 0);
        const expected = newCanvas();
        drawHead(expected, 10, hy, { eyes: "right", hatted: true });
        const actual = decodePng(readFileSync(join(root, set, "explore", `explore_${step + 1}.png`)));
        for (let y = hy + 9; y <= hy + 22; y++) for (let x = 12; x <= 29; x++) {
          if (pixel(expected, x, y)[3] === 0) continue; // Props may occupy space outside the face.
          assert.deepEqual(pixel(actual, x, y), pixel(expected, x, y), `${set}: shared glasses, eyes and mustache at ${x},${y}`);
        }
      }
    } finally {
      setYoloLook(false);
    }
  }
});


test("Super YOLO keeps the YOLO character and replaces only its rocket with a radiant sun", () => {
  for (const set of ["gentleman", "gentleman-yolo"]) for (const blink of [false, true]) {
    const suffix = blink ? "_blink" : "";
    const yolo = decodePng(readFileSync(join(root, set, "yolo", `yolo${suffix}.png`)));
    const superYolo = decodePng(readFileSync(join(root, set, "super-yolo", `super-yolo${suffix}.png`)));
    assert.deepEqual([superYolo.width, superYolo.height], [48, 40]);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 33; x++) {
      assert.deepEqual(pixel(superYolo, x, y), pixel(yolo, x, y), "the character must be identical");
    }
    assert.equal(count(superYolo, [255, 80, 80], 33, 0), 0, "no red rocket nose or fins");
    assert.ok(count(superYolo, [255, 224, 102], 33, 0) > 25, "sun and rays must be visible");
  }
});


test("ask keeps a calm shared face and the same Y/N text in every frame", () => {
  for (const [set, yolo] of [["gentleman", false], ["gentleman-yolo", true]] as const) {
    setYoloLook(yolo);
    try {
      for (const [name, eyes] of [["ask_1", "open"], ["ask_2", "blink"]] as const) {
        const actual = decodePng(readFileSync(join(root, set, "ask", `${name}.png`)));
        const expected = newCanvas();
        drawHead(expected, 11, 1, { eyes, mouth: "closed" });
        for (let y = 8; y < 22; y++) for (let x = 13; x < 30; x++) {
          if (pixel(expected, x, y)[3]) assert.deepEqual(pixel(actual, x, y), pixel(expected, x, y), `${set}/${name}: calm face at ${x},${y}`);
        }
        const letters = newCanvas();
        text(letters, "Y/N", 33, 3, C.ink);
        for (let y = 3; y < 8; y++) for (let x = 33; x < 45; x++) {
          if (pixel(letters, x, y)[3]) assert.deepEqual(pixel(actual, x, y), pixel(letters, x, y), `${name}: Y/N remains readable`);
        }
      }
    } finally { setYoloLook(false); }
  }
});


test("greeting lands, removes the propeller helmet, and waves with an uncovered head", () => {
  for (const set of ["gentleman", "gentleman-yolo"]) {
    const files = readdirSync(join(root, set, "hi")).filter((name) => name.endsWith(".png")).sort();
    assert.deepEqual(files, ["in_1.png", "in_2.png", "in_3.png", "in_4.png", "in_5.png", "in_6.png", "landed_1.png", "landed_2.png"]);
    const frames = files.map((name) => decodePng(readFileSync(join(root, set, "hi", name))));
    for (const png of frames) assert.deepEqual([png.width, png.height], [48, 40]);
    assert.ok(count(frames[3], [242, 194, 48], 12, 0, 35, 12) > 0, "helmet still on at landing");
    assert.ok(count(frames[4], [242, 194, 48], 12, 0, 35, 6) > 0, "helmet lifts above the head");
    for (const png of frames.slice(6)) {
      assert.equal(count(png, [242, 194, 48], 12, 0, 35, 12), 0, "no helmet over the head during wave");
      assert.ok(count(png, [234, 179, 140], 0, 15, 12, 29) > 12, "raised waving palm stays visible");
    }
    assert.notDeepEqual(frames[6].data, frames[7].data, "wave must animate");
  }
});
