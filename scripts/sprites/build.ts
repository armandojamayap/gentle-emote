import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Canvas, text, textWidth } from "./canvas.ts";
import { C, KEY, W, drawArm, drawBust, drawPalm, drawRaisedArm, headband, newCanvas, setYoloLook, sunglasses } from "./gentleman.ts";
import type { Look } from "./gentleman.ts";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "emotes", "gentleman");
/** Must match YOLO_SET_SUFFIX in src/emotes.ts: the runtime swaps to `<set>-yolo` while YOLO is on. */
const YOLO_SET_SUFFIX = "-yolo";

/** Bust centered in the canvas; scenes with props shift it left. */
const CENTER = 24;
const LEFT = 15;
const shoulders = (cx: number, headTop = 1) => ({ left: [cx - 12, headTop + 27] as [number, number], right: [cx + 11, headTop + 27] as [number, number] });

// --- Props ---

function bubble(cv: Canvas, x: number, y: number, w: number, h: number, tail: "left" | "down-left") {
  cv.rect(x + 1, y, w - 2, h, C.bubble);
  cv.rect(x, y + 1, w, h - 2, C.bubble);
  if (tail === "left") {
    cv.set(x - 1, y + h - 3, C.bubble);
    cv.set(x - 2, y + h - 2, C.bubble);
  } else {
    cv.set(x + 2, y + h, C.bubble);
    cv.set(x + 1, y + h + 1, C.bubble);
  }
}

function bubbleText(cv: Canvas, value: string, x: number, y: number, tail: "left" | "down-left", color = C.ink) {
  const w = textWidth(value) + 4;
  bubble(cv, x, y, w, 9, tail);
  text(cv, value, x + 2, y + 2, color);
}

function thoughtDots(cv: Canvas, x: number, y: number) {
  cv.disc(x, y + 8, 0, C.bubble);
  cv.disc(x + 2, y + 6, 1, C.bubble);
}

function spark(cv: Canvas, x: number, y: number, size = 2) {
  cv.line(x - size, y, x + size, y, C.spark);
  cv.line(x, y - size, x, y + size, C.spark);
  if (size > 1) {
    cv.set(x - 1, y - 1, C.white);
    cv.set(x + 1, y + 1, C.white);
  }
}

function sweatDrop(cv: Canvas, x: number, y: number) {
  cv.set(x, y, C.sweat);
  cv.rect(x - 1, y + 1, 3, 2, C.sweat);
  cv.set(x, y + 3, C.sweat);
}

function puff(cv: Canvas, x: number, y: number, r: number, light = false) {
  cv.disc(x, y, r, light ? C.smokeLight : C.smoke);
  cv.disc(x - 1, y - 1, Math.max(0, r - 2), C.smokeLight);
}

function cloud(cv: Canvas, cx: number, cy: number, scale: number) {
  const blobs: Array<[number, number, number]> = [[0, 0, 7], [-8, 3, 6], [8, 3, 6], [-5, -6, 5], [5, -6, 5], [0, 8, 6], [-11, -2, 4], [11, -2, 4]];
  for (const [dx, dy, r] of blobs) cv.disc(cx + dx * scale, cy + dy * scale, Math.max(1, Math.round(r * scale)), C.cloudShade);
  for (const [dx, dy, r] of blobs) cv.disc(cx + dx * scale - 1, cy + dy * scale - 1, Math.max(1, Math.round(r * scale) - 1), C.cloud);
}

type RobotArms = "down" | "up" | "work-a" | "work-b";

/** Robot seen from behind, "IA" printed on its back. `x` is its left edge, feet on the canvas floor. */
function robot(cv: Canvas, x: number, arms: RobotArms, jolt = 0) {
  const y = 20 - jolt;
  // Antenna and head.
  cv.line(x + 7, y, x + 7, y + 2, C.robotDark);
  cv.set(x + 7, y - 1, C.robotLed);
  cv.rect(x + 3, y + 3, 9, 6, C.robotDark);
  cv.rect(x + 4, y + 4, 7, 4, C.robot);
  cv.rect(x + 2, y + 5, 1, 2, C.robotLight);
  cv.rect(x + 12, y + 5, 1, 2, C.robotLight);
  // Neck and body.
  cv.rect(x + 6, y + 9, 3, 1, C.robotDark);
  cv.rect(x + 1, y + 10, 13, 9, C.robotDark);
  cv.rect(x + 2, y + 11, 11, 7, C.robot);
  cv.rect(x + 2, y + 11, 11, 1, C.robotLight);
  text(cv, "IA", x + 3, y + 12, C.ink);
  // Legs.
  cv.rect(x + 3, y + 19, 3, 40, C.robotDark);
  cv.rect(x + 9, y + 19, 3, 40, C.robotDark);
  // Arms.
  const armColor = C.robotDark;
  switch (arms) {
    case "down":
      cv.line(x, y + 11, x - 1, y + 17, armColor, 2);
      cv.line(x + 14, y + 11, x + 15, y + 17, armColor, 2);
      break;
    case "up":
      cv.line(x, y + 11, x - 3, y + 4, armColor, 2);
      cv.line(x + 14, y + 11, x + 17, y + 4, armColor, 2);
      break;
    case "work-a":
      cv.line(x, y + 12, x - 2, y + 15, armColor, 2);
      cv.line(x + 14, y + 12, x + 16, y + 9, armColor, 2);
      break;
    case "work-b":
      cv.line(x, y + 12, x - 2, y + 9, armColor, 2);
      cv.line(x + 14, y + 12, x + 16, y + 15, armColor, 2);
      break;
  }
}

function fryingPan(cv: Canvas, hand: [number, number], tilt: number, flame: number) {
  const [hx, hy] = hand;
  const px = hx + 10;
  const py = hy - 1;
  cv.line(hx, hy, px - 6, py, C.wood, 2);
  for (let dx = -6; dx <= 6; dx++) {
    const y = py + Math.round((dx * tilt) / 6);
    cv.rect(px + dx, y - 1, 1, dx * dx <= 16 ? 4 : 3, C.pan);
  }
  cv.line(px - 6, py - 1 - tilt, px + 6, py - 1 + tilt, C.panRim);
  // Burner flames under the pan.
  for (const dx of [-4, 0, 4]) {
    const h = 2 + ((dx + flame) & 1);
    cv.rect(px + dx, py + 4, 1, h, C.flame);
    cv.set(px + dx, py + 4 + h, C.code2);
  }
}

function magnifier(cv: Canvas, cx: number, cy: number, hand: [number, number]) {
  cv.line(cx + 4, cy + 4, hand[0], hand[1], C.wood, 2);
  cv.disc(cx, cy, 5, C.lens);
  // The magnified eye inside the lens.
  cv.disc(cx, cy, 3, C.white);
  cv.disc(cx, cy, 2, C.iris);
  cv.rect(cx, cy - 1, 2, 2, C.pupil);
  cv.set(cx - 2, cy - 3, C.white);
  cv.ring(cx, cy, 5, C.brass);
  cv.ring(cx, cy, 6, C.brass);
}

function paperStack(cv: Canvas, cx: number, top: number) {
  for (let y = top; y < 40; y++) {
    cv.rect(cx - 9, y, 18, 1, (y - top) % 3 === 2 ? C.paperLine : C.paper);
  }
}

function yarnBall(cv: Canvas, x: number, y: number) {
  cv.disc(x, y, 4, KEY.base);
  cv.line(x - 3, y - 1, x + 2, y + 3, KEY.shade);
  cv.line(x - 1, y - 3, x + 3, y + 1, KEY.shade);
  cv.set(x - 2, y - 2, KEY.light);
}

function hat(cv: Canvas, hx: number, hy: number, lift: number) {
  const y = hy - 3 - lift;
  cv.rect(hx - 1, y + 5, 24, 2, C.hat);
  cv.rect(hx - 1, y + 5, 24, 1, C.hatHi);
  cv.rect(hx + 4, y - 2, 14, 7, C.hat);
  cv.rect(hx + 5, y - 2, 12, 1, C.hatHi);
  cv.rect(hx + 4, y - 1, 1, 6, C.hatHi);
  cv.rect(hx + 4, y + 3, 14, 2, KEY.base);
}

// --- Frames ---

type Frame = (cv: Canvas) => void;
const frames: Record<string, Record<string, Frame>> = {};
const add = (state: string, name: string, draw: Frame) => {
  (frames[state] ??= {})[name] = draw;
};

const bust = (look: Look = {}, cx = CENTER) => (cv: Canvas) => { drawBust(cv, cx, look); };

// idle
add("idle", "idle", bust());
add("idle", "idle_blink", bust({ eyes: "blink" }));

// hi: waving with a wink
for (const [name, lean] of [["hi_1", 0], ["hi_2", 1]] as const) {
  add("hi", name, (cv) => {
    drawBust(cv, CENTER, { eyes: "wink", mustache: "up", mouth: "grin" });
    drawRaisedArm(cv, shoulders(CENTER).left, lean);
  });
}

// think: hand on the chin, eyes up, thought bubble
add("think", "think", (cv) => {
  const { hx } = drawBust(cv, CENTER - 3, { eyes: "up", mouth: "closed" });
  const s = shoulders(CENTER - 3);
  drawArm(cv, s.right, [s.right[0] + 2, 36], [hx + 13, 23]);
  thoughtDots(cv, 36, 6);
  bubbleText(cv, "...", 36, 0, "down-left");
});
add("think", "think_hard", (cv) => {
  const { hx, hy } = drawBust(cv, CENTER - 3, { eyes: "up", mouth: "frown", brows: "worried" });
  const s = shoulders(CENTER - 3);
  drawArm(cv, s.right, [s.right[0] + 2, 36], [hx + 13, 23]);
  sweatDrop(cv, hx + 21, hy + 6);
  thoughtDots(cv, 36, 6);
  bubbleText(cv, "?", 38, 0, "down-left");
});

// talk: live on stream, headphones and a podcast mic; ON AIR lights up while he speaks
const ON_AIR = "#e5484d";
const ON_AIR_DIM = "#5a2226";

function headphones(cv: Canvas, hx: number, hy: number) {
  cv.rect(hx + 3, hy - 1, 16, 2, C.pan);
  cv.rect(hx + 1, hy + 1, 2, 3, C.pan);
  cv.rect(hx + 19, hy + 1, 2, 3, C.pan);
  for (const x of [hx - 2, hx + 20]) {
    cv.rect(x, hy + 4, 4, 9, C.pan);
    cv.rect(x + 1, hy + 5, 2, 7, C.panRim);
  }
}

function podcastMic(cv: Canvas, x: number, y: number) {
  cv.path([[x + 2, y + 10], [x + 8, y + 15], [x + 12, y + 22]], C.pan, 2);
  cv.rect(x, y, 6, 10, C.pan);
  cv.rect(x + 1, y + 1, 4, 8, C.panRim);
  for (let gy = y + 2; gy < y + 9; gy += 2) cv.rect(x + 1, gy, 4, 1, C.pan);
}

function onAirSign(cv: Canvas, x: number, y: number, lit: boolean) {
  cv.rect(x, y, 15, 14, C.pan);
  cv.rect(x + 1, y + 1, 13, 12, lit ? ON_AIR : ON_AIR_DIM);
  const ink = lit ? C.white : C.smoke;
  text(cv, "ON", x + 3, y + 1, ink);
  text(cv, "AIR", x + 2, y + 7, ink);
}

function soundWaves(cv: Canvas, x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    const wx = x + i * 3;
    const r = 2 + i;
    cv.set(wx, y - r, C.code1);
    cv.rect(wx + 1, y - r + 1, 1, r * 2 - 1, C.code1);
    cv.set(wx, y + r, C.code1);
  }
}

for (const [name, mouth, waves] of [
  ["talk_close", "closed", 0], ["talk_small", "small", 1], ["talk_mid", "mid", 2], ["talk_wide", "wide", 3],
] as const) {
  add("talk", name, (cv) => {
    const { hx, hy } = drawBust(cv, CENTER - 5, { mouth, mustacheLift: waves >= 2 ? 1 : 0, eyes: waves === 3 ? "happy" : "open" });
    headphones(cv, hx, hy);
    podcastMic(cv, hx + 20, hy + 16);
    onAirSign(cv, 33, 1, waves > 0);
    soundWaves(cv, hx + 28, hy + 21, waves);
  });
}

// read: a huge magnifying glass sweeping across the glasses
for (const [name, dx] of [["read_1", 14], ["read_2", 9], ["read_3", 4]] as const) {
  add("read", name, (cv) => {
    const { hx, hy } = drawBust(cv, CENTER, { eyes: "open" });
    const s = shoulders(CENTER);
    drawArm(cv, s.right, [s.right[0] + 3, 37], [s.right[0] - 1, 33]);
    magnifier(cv, hx + dx + 2, hy + 11, [s.right[0] - 1, 32]);
  });
}

// write (implementing): cooking code in a frying pan
const FLYING: Array<Array<[string, number, number, string]>> = [
  [["{", 32, 21, C.code1], ["}", 39, 23, C.code2]],
  [["{", 31, 13, C.code1], [";", 37, 17, KEY.base], ["}", 42, 19, C.code2]],
  [["}", 34, 6, C.code2], ["{", 40, 10, C.code1], [";", 36, 21, KEY.base]],
  [[";", 41, 4, KEY.base], ["}", 31, 14, C.code2], ["{", 38, 22, C.code1]],
];
FLYING.forEach((glyphs, i) => {
  add("write", `write_${i + 1}`, (cv) => {
    drawBust(cv, LEFT, { eyes: "right", mustache: "up", mouth: i % 2 ? "grin" : "closed" });
    const s = shoulders(LEFT);
    const hand: [number, number] = [s.right[0] + 5, 30 - (i % 2)];
    drawArm(cv, s.right, [s.right[0] + 2, 35], hand);
    fryingPan(cv, hand, i % 2 ? -1 : 1, i);
    for (const [glyph, x, y, color] of glyphs) text(cv, glyph, x, y, color);
  });
});

// tool (working): whipping the IA robot
add("tool", "tool_1", (cv) => {
  robot(cv, 33, "work-a");
  drawBust(cv, LEFT, { eyes: "right", brows: "angry", mouth: "clench" });
  const s = shoulders(LEFT);
  drawArm(cv, s.left, [s.left[0] - 2, 18], [s.left[0] + 2, 7]);
  cv.path([[s.left[0] + 2, 5], [s.left[0] - 2, 1], [s.left[0] - 2, 9], [s.left[0] - 1, 22], [s.left[0] + 1, 38]], C.whip);
});
add("tool", "tool_2", (cv) => {
  robot(cv, 33, "up", 2);
  sweatDrop(cv, 31, 14);
  sweatDrop(cv, 47, 16);
  drawBust(cv, LEFT, { eyes: "right", brows: "angry", mouth: "wide" });
  const s = shoulders(LEFT);
  drawArm(cv, s.right, [s.right[0] + 3, 25], [s.right[0] + 5, 21]);
  cv.path([[s.right[0] + 6, 19], [33, 13], [37, 18], [40, 23], [43, 27]], C.whip);
  spark(cv, 43, 27, 3);
  spark(cv, 38, 10, 1);
});
add("tool", "tool_3", (cv) => {
  robot(cv, 33, "work-b");
  cv.line(31, 24, 31, 27, C.white);
  cv.line(47, 26, 47, 29, C.white);
  drawBust(cv, LEFT, { eyes: "right", brows: "angry", mustache: "up", mouth: "grin" });
  const s = shoulders(LEFT);
  drawArm(cv, s.right, [s.right[0] + 3, 33], [s.right[0] + 5, 30]);
  cv.path([[s.right[0] + 6, 30], [33, 34], [37, 38], [41, 39]], C.whip);
});

// success: chef's kiss
add("success", "success_1", (cv) => {
  const { hx } = drawBust(cv, CENTER, { eyes: "happy", mustache: "up", mouth: "kiss" });
  const s = shoulders(CENTER);
  drawArm(cv, s.right, [s.right[0] - 2, 34], [hx + 13, 21]);
});
add("success", "success_2", (cv) => {
  const { hx } = drawBust(cv, CENTER, { eyes: "happy", mustache: "up", mouth: "grin" });
  const s = shoulders(CENTER);
  drawArm(cv, s.right, [s.right[0] + 4, 30], [hx + 27, 16]);
  drawPalm(cv, hx + 24, 8, true);
  spark(cv, hx + 33, 6, 2);
  spark(cv, hx + 22, 3, 1);
  spark(cv, 4, 10, 1);
});

// failure: the robot blew up in his face
for (const [name, shift, eyes] of [["failure_1", 0, "wide"], ["failure_2", 2, "dizzy"], ["failure_3", 4, "wide"]] as const) {
  add("failure", name, (cv) => {
    drawBust(cv, CENTER, { soot: true, eyes, mustache: "frizz", mouth: "o" });
    puff(cv, 6, 12 - shift, 4);
    puff(cv, 42, 9 - shift, 5, true);
    puff(cv, 8, 26 - shift, 3, true);
    puff(cv, 41, 24 - shift, 3);
    puff(cv, 24, -shift + 1, 3, true);
    if (shift === 2) spark(cv, 38, 30, 2);
  });
}

// compact: squashing a pile of papers
for (const [name, top] of [["compact_1", 26], ["compact_2", 30], ["compact_3", 34]] as const) {
  add("compact", name, (cv) => {
    drawBust(cv, CENTER, { eyes: "happy", mouth: "clench", brows: "angry" });
    paperStack(cv, CENTER, top);
    const s = shoulders(CENTER);
    drawArm(cv, s.left, [s.left[0] - 2, top - 2], [CENTER - 5, top - 1]);
    drawArm(cv, s.right, [s.right[0] + 2, top - 2], [CENTER + 4, top - 1]);
    if (top === 34) {
      cv.line(CENTER - 13, 33, CENTER - 16, 31, C.white);
      cv.line(CENTER + 12, 33, CENTER + 15, 31, C.white);
    }
  });
}

// ask: "STOP — you decide": raised palm, frown, Y/N bubble
for (const [name, label] of [["ask_1", "?"], ["ask_2", "Y/N"]] as const) {
  add("ask", name, (cv) => {
    drawBust(cv, CENTER - 2, { eyes: "angry", brows: "angry", mouth: "frown" });
    const s = shoulders(CENTER - 2);
    drawArm(cv, s.left, [s.left[0] - 5, 30], [s.left[0] - 4, 23]);
    drawPalm(cv, s.left[0] - 8, 15);
    bubbleText(cv, label, W - textWidth(label) - 5, 1, "left");
  });
}

// grandma: poof, then a knitting abuela that kept the mustache
add("grandma", "in_1", (cv) => {
  drawBust(cv, CENTER, { eyes: "wide", mouth: "o" });
  cloud(cv, CENTER, 22, 0.8);
});
add("grandma", "in_2", (cv) => {
  cloud(cv, CENTER, 20, 1.3);
  spark(cv, 6, 6, 2);
  spark(cv, 42, 8, 2);
});
add("grandma", "in_3", (cv) => {
  drawBust(cv, CENTER, { grandma: true, eyes: "happy", mouth: "closed" }, { shawl: true });
  cloud(cv, 8, 34, 0.5);
  cloud(cv, 40, 33, 0.5);
});
for (const [name, swap] of [["knit_1", 0], ["knit_2", 1]] as const) {
  add("grandma", name, (cv) => {
    drawBust(cv, CENTER, { grandma: true, eyes: "down", mouth: swap ? "small" : "closed" }, { shawl: true });
    const s = shoulders(CENTER);
    const leftHand: [number, number] = [CENTER - 5 + swap, 33];
    const rightHand: [number, number] = [CENTER + 5 - swap, 33];
    drawArm(cv, s.left, [s.left[0] + 1, 36], leftHand);
    drawArm(cv, s.right, [s.right[0] - 1, 36], rightHand);
    cv.line(leftHand[0], leftHand[1], CENTER + 4 + swap, 27, C.needle);
    cv.line(rightHand[0], rightHand[1], CENTER - 4 - swap, 27, C.needle);
    cv.rect(CENTER - 3, 34, 6, 4, KEY.light);
    cv.rect(CENTER - 3, 37, 6, 1, KEY.shade);
    yarnBall(cv, 41, 35);
    cv.path([[CENTER + 2, 37], [33, 39], [37, 36]], KEY.base);
  });
}

// bye: stores the session in memory, then tips the hat
add("bye", "in_1", (cv) => {
  drawBust(cv, CENTER, { eyes: "down", mouth: "closed" });
  const s = shoulders(CENTER);
  drawArm(cv, s.right, [s.right[0] - 2, 36], [CENTER + 2, 31]);
  cv.rect(CENTER - 5, 27, 9, 8, C.book);
  cv.rect(CENTER - 4, 28, 7, 6, C.bookPage);
  text(cv, "{", CENTER - 3, 28, KEY.base);
});
add("bye", "in_2", (cv) => {
  drawBust(cv, CENTER - 6, { eyes: "right", mustache: "up", mouth: "grin" });
  const s = shoulders(CENTER - 6);
  cv.rect(33, 31, 15, 9, C.drawer);
  cv.rect(34, 32, 13, 2, C.drawerDark);
  cv.rect(37, 26, 7, 6, C.book);
  drawArm(cv, s.right, [s.right[0] + 4, 30], [36, 28]);
});
for (const [name, lift, lean] of [["bye_1", 0, 0], ["bye_2", 3, 1]] as const) {
  add("bye", name, (cv) => {
    const { hx, hy } = drawBust(cv, CENTER - 4, { eyes: "wink", mustache: "up", mouth: "grin" }, {}, 4);
    hat(cv, hx, hy, lift);
    drawRaisedArm(cv, shoulders(CENTER - 4, 4).right, lean, "right");
    bubbleText(cv, "CHAU", W - textWidth("CHAU") - 5, 0, "left");
  });
}

// delegate (subagents): yelling through a megaphone at three running IA mini-robots
function miniRobot(cv: Canvas, x: number, y: number, step: number) {
  cv.set(x + 4, y, C.robotLed);
  cv.set(x + 4, y + 1, C.robotDark);
  cv.rect(x + 2, y + 2, 5, 3, C.robotDark);
  cv.rect(x + 3, y + 3, 3, 1, C.robot);
  cv.set(x + 3, y + 3, C.robotLed);
  cv.set(x + 5, y + 3, C.robotLed);
  cv.rect(x, y + 5, 9, 7, C.robotDark);
  cv.rect(x + 1, y + 6, 7, 5, C.robot);
  text(cv, "IA", x + 1, y + 6, C.ink);
  const [front, back] = step % 2 ? [1, 6] : [2, 5];
  cv.rect(x + front, y + 12, 2, 2, C.robotDark);
  cv.rect(x + back, y + 12, 2, 2, C.robotDark);
}

function megaphone(cv: Canvas, x: number, y: number) {
  for (let dx = 0; dx <= 8; dx++) {
    const half = 1 + Math.floor(dx / 2.5);
    cv.rect(x + dx, y - half, 1, half * 2 + 1, dx === 8 ? C.white : C.flame);
  }
  cv.rect(x - 2, y - 1, 2, 3, C.panRim);
}

for (const [name, step] of [["delegate_1", 0], ["delegate_2", 1], ["delegate_3", 2]] as const) {
  add("delegate", name, (cv) => {
    const cx = LEFT - 3;
    miniRobot(cv, 30, step === 1 ? 1 : 0, step);
    miniRobot(cv, 39, step === 2 ? 12 : 13, step + 1);
    miniRobot(cv, 30, step === 0 ? 25 : 26, step);
    drawBust(cv, cx, { eyes: "right", brows: "angry", mustache: "up", mouth: step === 1 ? "mid" : "wide" });
    const s = shoulders(cx);
    drawArm(cv, s.right, [s.right[0] + 2, 31], [s.right[0] + 3, 23]);
    megaphone(cv, s.right[0] + 3, 19);
    for (const [wx, wy] of [[34, 15], [35, 19], [34, 23]] as const) cv.set(wx + (step % 2), wy, C.white);
  });
}

// jobs (background): sipping mate while a progress bar fills, kitchen timer ticking
function mate(cv: Canvas, x: number, y: number, straw: [number, number]) {
  cv.line(x + 1, y - 3, straw[0], straw[1], C.chain);
  cv.disc(x, y + 1, 3, C.wood);
  cv.rect(x - 2, y - 2, 5, 1, C.leaf);
  cv.set(x - 1, y, C.drawerDark);
}

function kitchenTimer(cv: Canvas, cx: number, cy: number, tick: number) {
  cv.rect(cx - 1, cy - 6, 3, 2, C.panRim);
  cv.disc(cx, cy, 4, C.white);
  cv.ring(cx, cy, 4, C.panRim);
  const hands: Array<[number, number]> = [[0, -3], [2, -2], [3, 0], [2, 2]];
  const [hx, hy] = hands[tick % hands.length]!;
  cv.line(cx, cy, cx + hx, cy + hy, C.robotLed);
}

function progressBar(cv: Canvas, x: number, y: number, w: number, filled: number) {
  cv.rect(x, y, w, 5, C.white);
  cv.rect(x + 1, y + 1, w - 2, 3, C.ink);
  cv.rect(x + 1, y + 1, Math.round((w - 2) * filled), 3, C.code1);
}

for (const [name, filled, sip] of [["jobs_1", 0.25, true], ["jobs_2", 0.55, false], ["jobs_3", 0.85, false]] as const) {
  add("jobs", name, (cv) => {
    const cx = CENTER - 3;
    const { hx, hy } = drawBust(cv, cx, { eyes: sip ? "happy" : "up", mouth: sip ? "kiss" : "closed" });
    const s = shoulders(cx);
    const gourd: [number, number] = [s.right[0] + 4, 30];
    drawArm(cv, s.right, [s.right[0] + 3, 37], [gourd[0], gourd[1] + 3]);
    mate(cv, gourd[0], gourd[1], sip ? [hx + 13, hy + 20] : [gourd[0] + 3, gourd[1] - 8]);
    progressBar(cv, 33, 2, 15, filled);
    kitchenTimer(cv, 5, 9, Math.round(filled * 4));
  });
}

// remember (Engram mem_save): finger on the temple, jotting it in a notebook
function notebook(cv: Canvas, x: number, y: number, lines: number) {
  cv.rect(x, y, 11, 13, C.book);
  cv.rect(x + 1, y + 1, 9, 11, C.bookPage);
  for (let i = 0; i < 4; i++) cv.rect(x + 2, y + 3 + i * 2, i < lines ? 7 : 3, 1, i < lines ? KEY.base : C.paperLine);
  for (let i = 0; i < 4; i++) cv.set(x, y + 2 + i * 3, C.chain);
}

for (const [name, lines] of [["remember_1", 2], ["remember_2", 4]] as const) {
  add("remember", name, (cv) => {
    const cx = CENTER + 4;
    const { hx, hy } = drawBust(cv, cx, { eyes: lines === 4 ? "happy" : "up", mustache: "up", mouth: lines === 4 ? "grin" : "closed" });
    const s = shoulders(cx);
    drawArm(cv, s.right, [s.right[0] + 4, 24], [hx + 21, hy + 11]);
    cv.rect(hx + 20, hy + 7, 1, 4, C.skin);
    notebook(cv, 1, 25, lines);
    drawArm(cv, s.left, [s.left[0] - 3, 36], [12, 33]);
    if (lines === 4) {
      spark(cv, hx + 25, hy + 3, 2);
      spark(cv, 6, 21, 1);
    }
  });
}

// yolo (mode, replaces idle): sunglasses, YOLO headband and a rocket
function rocket(cv: Canvas, x: number, y: number, flame: number) {
  cv.rect(x + 2, y + 2, 5, 11, C.white);
  cv.rect(x + 3, y, 3, 2, C.robotLed);
  cv.set(x + 4, y - 1, C.robotLed);
  cv.rect(x + 3, y + 5, 3, 3, C.panRim);
  cv.set(x + 4, y + 6, C.code1);
  cv.rect(x, y + 10, 2, 4, C.robotLed);
  cv.rect(x + 7, y + 10, 2, 4, C.robotLed);
  cv.rect(x + 3, y + 13, 3, 2 + flame, C.flame);
  cv.set(x + 4, y + 15 + flame, C.code2);
}

for (const [name, glint] of [["yolo", false], ["yolo_blink", true]] as const) {
  add("yolo", name, (cv) => {
    const { hx, hy } = drawBust(cv, CENTER - 3, { mustache: "up", mouth: "grin" });
    headband(cv, hx, hy);
    sunglasses(cv, hx, hy, glint);
    rocket(cv, 37, glint ? 9 : 11, glint ? 2 : 1);
  });
}

// --- Subagent scenes, picked from the subagent's name ---

const KHAKI = "#c8b27a";
const KHAKI_SHADE = "#9c8756";
const HARD_HAT = "#f2c230";
const HARD_HAT_SHADE = "#c2951c";
const RED_PEN = "#e5484d";
const JIRA_BLUE = "#2684ff";

function domeHat(cv: Canvas, hx: number, hy: number, color: string, shade: string, brim: number) {
  cv.rect(hx + 4, hy - 1, 14, 1, color);
  cv.rect(hx + 2, hy, 18, 4, color);
  cv.rect(hx + 2, hy + 3, 18, 1, shade);
  cv.rect(hx + 1 - brim, hy + 4, 20 + brim * 2, 2, color);
  cv.rect(hx + 1 - brim, hy + 5, 20 + brim * 2, 1, shade);
}

function checkMark(cv: Canvas, x: number, y: number, color: string) {
  for (const [dx, dy] of [[0, 2], [1, 3], [2, 2], [3, 1], [4, 0]] as const) cv.rect(x + dx, y + dy, 1, 2, color);
}

// explore: pith helmet and binoculars, a treasure map unfolding
function binoculars(cv: Canvas, hx: number, hy: number, glint: boolean) {
  for (const ex of [hx + 5, hx + 16]) {
    cv.disc(ex, hy + 11, 3, C.ink);
    cv.rect(ex - 1, hy + 10, 2, 2, C.lens);
  }
  cv.rect(hx + 8, hy + 10, 6, 2, C.ink);
  if (glint) cv.set(hx + 4, hy + 10, C.white);
  for (const x of [hx, hx + 21]) {
    cv.rect(x - 1, hy + 9, 3, 5, C.skin);
    cv.rect(x - 1, hy + 13, 3, 1, C.skinShade);
  }
}

function treasureMap(cv: Canvas, x: number, y: number, found: boolean) {
  cv.rect(x, y, 12, 11, C.paper);
  cv.rect(x, y, 12, 1, C.paperLine);
  cv.rect(x, y + 10, 12, 1, C.paperLine);
  cv.path([[x + 2, y + 8], [x + 4, y + 6], [x + 6, y + 7], [x + 8, y + 4]], C.paperLine);
  if (found) {
    cv.line(x + 8, y + 2, x + 10, y + 4, RED_PEN);
    cv.line(x + 10, y + 2, x + 8, y + 4, RED_PEN);
  }
}

for (const [name, step] of [["explore_1", 0], ["explore_2", 1]] as const) {
  add("explore", name, (cv) => {
    const cx = CENTER - 4;
    const { hx, hy } = drawBust(cv, cx, { mouth: step ? "o" : "closed", mustache: "up" });
    domeHat(cv, hx, hy, KHAKI, KHAKI_SHADE, 1);
    binoculars(cv, hx + step, hy, step === 1);
    treasureMap(cv, 35, 26, step === 1);
  });
}

// build (worker / fix): hard hat and a wrench on the IA robot, sparks flying
function wrench(cv: Canvas, hand: [number, number], tip: [number, number]) {
  cv.line(hand[0], hand[1], tip[0], tip[1], C.chain, 2);
  cv.rect(tip[0] - 1, tip[1] - 2, 3, 2, C.chain);
  cv.set(tip[0], tip[1] - 2, null);
}

for (const [name, step] of [["build_1", 0], ["build_2", 1], ["build_3", 2]] as const) {
  add("build", name, (cv) => {
    robot(cv, 31, step === 1 ? "work-a" : "work-b", step === 1 ? 1 : 0);
    const cx = LEFT - 3;
    const { hx, hy } = drawBust(cv, cx, { eyes: "right", brows: "angry", mouth: step === 1 ? "clench" : "closed" });
    domeHat(cv, hx, hy, HARD_HAT, HARD_HAT_SHADE, 1);
    cv.rect(hx + 10, hy - 1, 2, 5, HARD_HAT_SHADE);
    const s = shoulders(cx);
    const hand: [number, number] = [s.right[0] + 5, step === 1 ? 30 : 26];
    drawArm(cv, s.right, [s.right[0] + 2, 37], hand);
    wrench(cv, hand, [hand[0] + 4, hand[1] - 5]);
    if (step === 1) {
      spark(cv, 33, 22, 2);
      spark(cv, 30, 17, 1);
    }
  });
}

// verify (verify / validator): ticking a checklist on a clipboard
function clipboard(cv: Canvas, x: number, y: number, checks: number) {
  cv.rect(x, y, 15, 22, C.wood);
  cv.rect(x + 1, y + 2, 13, 19, C.paper);
  cv.rect(x + 5, y - 1, 5, 3, C.chain);
  for (let i = 0; i < 3; i++) {
    const ry = y + 4 + i * 6;
    cv.rect(x + 2, ry, 4, 4, C.paperLine);
    cv.rect(x + 3, ry + 1, 2, 2, C.paper);
    cv.rect(x + 8, ry + 1, 5, 1, C.paperLine);
    cv.rect(x + 8, ry + 3, 3, 1, C.paperLine);
    if (i < checks) checkMark(cv, x + 2, ry - 1, C.leaf);
  }
}

for (const [name, checks] of [["verify_1", 1], ["verify_2", 2], ["verify_3", 3]] as const) {
  add("verify", name, (cv) => {
    const cx = CENTER + 6;
    const { hx, hy } = drawBust(cv, cx, { eyes: checks === 3 ? "happy" : "down", mustache: checks === 3 ? "up" : "normal", mouth: checks === 3 ? "grin" : "closed" });
    clipboard(cv, 1, 16, checks);
    const s = shoulders(cx);
    drawArm(cv, s.left, [s.left[0] - 2, 37], [15, 30]);
    if (checks === 3) spark(cv, hx - 4, hy + 4, 1);
  });
}

// judge (judge / refuter): powdered wig and a gavel
function wig(cv: Canvas, hx: number, hy: number) {
  cv.rect(hx + 1, hy - 1, 20, 6, C.greyHi);
  for (let x = hx + 2; x < hx + 20; x += 3) cv.set(x, hy + 1, C.grey);
  for (let x = hx + 3; x < hx + 20; x += 3) cv.set(x, hy + 3, C.grey);
  for (let y = hy + 5; y <= hy + 20; y += 3) {
    for (const x of [hx - 1, hx + 22]) {
      cv.disc(x, y, 2, C.greyHi);
      cv.set(x, y, C.grey);
    }
  }
}

function gavel(cv: Canvas, hand: [number, number], head: [number, number]) {
  cv.line(hand[0], hand[1], head[0], head[1], C.wood, 2);
  cv.rect(head[0] - 3, head[1] - 2, 8, 4, C.drawerDark);
  cv.rect(head[0] - 1, head[1] - 2, 1, 4, C.brass);
  cv.rect(head[0] + 2, head[1] - 2, 1, 4, C.brass);
}

for (const [name, down] of [["judge_1", false], ["judge_2", true]] as const) {
  add("judge", name, (cv) => {
    const cx = CENTER - 4;
    const { hx, hy } = drawBust(cv, cx, { eyes: down ? "angry" : "open", brows: "angry", mouth: down ? "wide" : "closed" });
    wig(cv, hx, hy);
    cv.rect(37, 35, 11, 5, C.wood);
    cv.rect(37, 35, 11, 1, C.drawer);
    const s = shoulders(cx);
    if (down) {
      drawArm(cv, s.right, [s.right[0] + 4, 35], [s.right[0] + 9, 31]);
      gavel(cv, [s.right[0] + 9, 31], [40, 32]);
      spark(cv, 46, 31, 2);
      spark(cv, 35, 31, 1);
    } else {
      drawArm(cv, s.right, [s.right[0] + 5, 32], [s.right[0] + 9, 24]);
      gavel(cv, [s.right[0] + 9, 24], [40, 12]);
    }
  });
}

// review (review-*): red pen on the page, the IA robot cycles the review signs
type ReviewSign = "readability" | "reliability" | "resilience" | "risk";

function reviewIcon(cv: Canvas, cx: number, cy: number, sign: ReviewSign) {
  switch (sign) {
    case "readability":
      cv.ring(cx - 1, cy - 1, 3, C.brass);
      cv.disc(cx - 1, cy - 1, 1, C.lens);
      cv.line(cx + 1, cy + 1, cx + 4, cy + 4, C.wood, 2);
      break;
    case "reliability":
      cv.rect(cx - 2, cy - 5, 5, 1, C.chain);
      cv.rect(cx - 1, cy - 4, 3, 9, C.lens);
      cv.rect(cx - 1, cy, 3, 5, C.leaf);
      break;
    case "resilience":
      cv.rect(cx - 4, cy - 4, 9, 5, C.code1);
      cv.rect(cx - 3, cy + 1, 7, 2, C.code1);
      cv.rect(cx - 2, cy + 3, 5, 1, C.code1);
      cv.set(cx, cy + 4, C.code1);
      checkMark(cv, cx - 2, cy - 3, C.white);
      break;
    case "risk":
      for (let dy = 0; dy < 8; dy++) cv.rect(cx - Math.floor(dy / 2), cy - 4 + dy, 1 + 2 * Math.floor(dy / 2), 1, C.code2);
      cv.rect(cx, cy - 2, 1, 3, C.ink);
      cv.set(cx, cy + 2, C.ink);
      break;
  }
}

const REVIEW_SIGNS: ReviewSign[] = ["readability", "reliability", "resilience", "risk"];
REVIEW_SIGNS.forEach((sign, i) => {
  add("review", `review_${i + 1}`, (cv) => {
    robot(cv, 31, "up");
    cv.rect(28, 2, 20, 14, C.white);
    cv.rect(29, 3, 18, 12, C.paper);
    reviewIcon(cv, 38, 9, sign);
    const cx = LEFT - 3;
    const { hx } = drawBust(cv, cx, { eyes: "right", brows: i === 3 ? "worried" : undefined, mouth: "closed" });
    const s = shoulders(cx);
    const tip: [number, number] = [s.right[0] + 4 + (i % 2), 31 + (i % 2)];
    drawArm(cv, s.right, [s.right[0] + 1, 38], [tip[0] - 1, tip[1] + 3]);
    cv.line(tip[0] - 1, tip[1] + 3, tip[0] + 2, tip[1] - 2, RED_PEN, 2);
    cv.rect(hx + 22, 36, 6, 1, RED_PEN);
  });
});

// jira: writing a comment on a ticket card
function ticket(cv: Canvas, x: number, y: number, dots: number) {
  cv.rect(x, y, 16, 20, C.white);
  cv.rect(x, y, 16, 3, JIRA_BLUE);
  cv.rect(x + 2, y + 5, 10, 1, C.paperLine);
  cv.rect(x + 2, y + 7, 7, 1, C.paperLine);
  cv.rect(x + 2, y + 11, 12, 6, C.lens);
  for (let i = 0; i < dots; i++) cv.rect(x + 4 + i * 3, y + 13, 2, 2, JIRA_BLUE);
}

for (const [name, dots] of [["jira_1", 1], ["jira_2", 2], ["jira_3", 3]] as const) {
  add("jira", name, (cv) => {
    const cx = CENTER - 4;
    drawBust(cv, cx, { eyes: "right", mouth: dots === 2 ? "small" : "closed" });
    ticket(cv, 32, 4, dots);
    const s = shoulders(cx);
    const hand: [number, number] = [36 + dots * 3, 24];
    drawArm(cv, s.right, [s.right[0] + 3, 36], hand);
    cv.line(hand[0], hand[1], hand[0] + 2, hand[1] - 6, C.ink);
  });
}

// --- Output ---

const emotesConfig = {
  idle: { default: "idle.png", blink: "idle_blink.png" },
  think: { default: "think.png", hard: "think_hard.png" },
  talk: { weights: { "talk_close.png": 1, "talk_small.png": 3, "talk_mid.png": 3, "talk_wide.png": 1 } },
  cycle: {
    hi: "loop", tool: "loop", write: "loop", ask: "loop", success: "loop", failure: "loop", read: "pingpong", compact: "pingpong",
    delegate: "loop", jobs: "loop", remember: "loop", yolo: "loop",
    explore: "loop", build: "loop", verify: "loop", judge: "loop", review: "loop", jira: "loop",
  },
  frameMs: {
    hi: 300, tool: 260, write: 240, read: 450, ask: 800, success: 420, failure: 380, compact: 380, grandma: 520, bye: 650,
    delegate: 280, jobs: 900, remember: 700, yolo: 1100,
    explore: 800, build: 260, verify: 700, judge: 450, review: 1200, jira: 500,
  },
};

function writeSet(outDir: string, yolo: boolean) {
  setYoloLook(yolo);
  rmSync(outDir, { recursive: true, force: true });
  let count = 0;
  for (const [state, named] of Object.entries(frames)) {
    mkdirSync(join(outDir, state), { recursive: true });
    for (const [name, draw] of Object.entries(named)) {
      const cv = newCanvas();
      draw(cv);
      writeFileSync(join(outDir, state, `${name}.png`), cv.toPng());
      count++;
    }
  }
  writeFileSync(join(outDir, "emotes.json"), `${JSON.stringify(emotesConfig, null, 2)}\n`);
  console.log(`${basename(outDir)}: ${count} frames in ${Object.keys(frames).length} states → ${outDir}`);
  setYoloLook(false);
}

writeSet(OUT, false);
writeSet(`${OUT}${YOLO_SET_SUFFIX}`, true);
