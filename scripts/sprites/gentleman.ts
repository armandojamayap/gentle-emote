import { Canvas, sprite } from "./canvas.ts";
import type { Palette } from "./canvas.ts";

/** Accent keys: recolored at load time to the /gentle:customize color (see src/accent.ts). */
export const KEY = { base: "#ff00ff", shade: "#aa00aa", light: "#ff80ff" };

export const C = {
  hair: "#3d2516", hairHi: "#6b4429", hairShade: "#28170d",
  grey: "#a7a3ad", greyHi: "#d2ced8", greyShade: "#7d7984",
  skin: "#eab38c", skinShade: "#c98a66",
  stubble: "#a8775c",
  frame: "#0d0d0f", wire: "#5d5f66", glare: "#d8ecff",
  white: "#f4f4f4", iris: "#4fa860", pupil: "#10151f", lid: "#5a3424",
  mouth: "#4a1c1c", teeth: "#f5efe6", tongue: "#c4505a",
  shirt: "#25252c", shirtEdge: "#55556a",
  chain: "#b9bcc6", leaf: "#3fa34d",
  soot: "#3a3330", sootShade: "#2a2422", sootStubble: "#221d1b",
  smoke: "#6e6e78", smokeLight: "#a2a2ae",
  robot: "#9aa3ad", robotDark: "#5f6871", robotLight: "#cdd5dd", robotLed: "#ff5050",
  spark: "#ffe066", sweat: "#7fd4ff",
  pan: "#2b2b30", panRim: "#6a6a75", wood: "#7a5230", flame: "#ff8c3a",
  paper: "#f2f0e6", paperLine: "#b8b4a6",
  shawl: "#7a2f4f", shawlHi: "#a34a6e", curler: "#c8a2ff", curlerDark: "#8e6cc7", needle: "#e2e2e8",
  bubble: "#f4f4f4", ink: "#1d1d22",
  whip: "#6b4426",
  brass: "#c9a227", lens: "#bfe6ff",
  book: "#6b3d2e", bookPage: "#efe6d2", drawer: "#8a6240", drawerDark: "#5e4129",
  hat: "#3a3540", hatHi: "#6a6474", cloud: "#e9e9f0", cloudShade: "#b9b9c6",
  code1: "#7fdbff", code2: "#ffd36b",
};

export const W = 48;
export const H = 40;
export const newCanvas = () => new Canvas(W, H);

const HEAD = sprite("head", [
  "......hH.HH.hH........",
  "....hHHHHHHHHHHHh.....",
  "...HHHHhHHHHHHHHHH....",
  "..HHHHHHHHHHhHHHHHHH..",
  ".HHHHHHHHHHHHHHHHHHHH.",
  ".HHHHHHHhHHHHHHHHHHHH.",
  ".HHHSSSSHHHHHHSSSSHHH.",
  ".HHSSSSSSSSSSSSSSSSHH.",
  ".HSSSSSSSSSSSSSSSSSSH.",
  ".SGGGGGGGGSSGGGGGGGGS.",
  "sSGSSSSSSGGGGSSSSSSGSs",
  "sSGSSSSSSGSSGSSSSSSGSs",
  "sSGSSSSSSGSSGSSSSSSGSs",
  ".SSggggggSssSggggggSS.",
  ".SSSSSSSSSssSSSSSSSSS.",
  ".SSSSSSSSSssSSSSSSSSS.",
  ".SSSSSSSSSSSSSSSSSSSS.",
  ".SSSSSSSSSSSSSSSSSSSS.",
  ".sBSSSSSSSSSSSSSSSSBs.",
  "..BSSSSSSNNNNSSSSSSB..",
  "..BBSSSSSSSSSSSSSSBB..",
  "...BBBSSBBBBBBSSBBB...",
  "....BBBBBBBBBBBBBB....",
  "......BBBBBBBBBB......",
  ".......ssSSSSss.......",
]);

export const HEAD_W = 22;

export interface Look {
  eyes?: EyeKind;
  mouth?: MouthKind;
  mustache?: MustacheKind;
  brows?: "angry" | "worried";
  soot?: boolean;
  grandma?: boolean;
  /** Raise the mustache by one pixel (talking wide). */
  mustacheLift?: number;
}

const headPalette = (look: Look): Palette => {
  const skin = look.soot ? C.soot : C.skin;
  const shade = look.soot ? C.sootShade : C.skinShade;
  return {
    H: look.grandma ? C.grey : C.hair,
    h: look.grandma ? C.greyHi : C.hairHi,
    S: skin, s: shade,
    B: look.soot ? C.sootStubble : C.stubble,
    G: C.frame, g: C.wire,
    N: C.mouth,
  };
};

// --- Eyes: 6x3 interiors of each lens (left lens x3..8, right lens x13..18, rows 10..12) ---

export type EyeKind = "open" | "blink" | "happy" | "angry" | "wide" | "up" | "right" | "down" | "wink" | "dizzy";

const EYES: Record<Exclude<EyeKind, "wink">, [string[], string[]]> = {
  open: [["wSSSSS", "SWEPWS", "SWEEWS"], ["wSSSSS", "SWEPWS", "SWEEWS"]],
  blink: [["wSSSSS", "SSSSSS", "SLLLLS"], ["wSSSSS", "SSSSSS", "SLLLLS"]],
  happy: [["wSSSSS", "SSLLSS", "SLSSLS"], ["wSSSSS", "SSLLSS", "SLSSLS"]],
  angry: [["SSSLLL", "SWEPLS", "SWEEWS"], ["LLLSSS", "SLEPWS", "SWEEWS"]],
  wide: [["SWWWWS", "SWPPWS", "SWWWWS"], ["SWWWWS", "SWPPWS", "SWWWWS"]],
  up: [["SEPWWS", "SEEWWS", "SWWWWS"], ["SEPWWS", "SEEWWS", "SWWWWS"]],
  right: [["wSSSSS", "SWWEPS", "SWWEES"], ["wSSSSS", "SWWEPS", "SWWEES"]],
  down: [["wSSSSS", "SLLLLS", "SWEPWS"], ["wSSSSS", "SLLLLS", "SWEPWS"]],
  dizzy: [["SLSSLS", "SSLLSS", "SLSSLS"], ["SLSSLS", "SSLLSS", "SLSSLS"]],
};

function drawEyes(cv: Canvas, hx: number, hy: number, look: Look) {
  const kind = look.eyes ?? "open";
  const [left, right] = kind === "wink" ? [EYES.open[0], EYES.happy[1]] : EYES[kind];
  const skin = look.soot ? C.soot : C.skin;
  const palette: Palette = { S: skin, W: C.white, E: C.iris, P: C.pupil, L: look.soot ? C.white : C.lid, w: C.glare };
  cv.blit(left, hx + 3, hy + 10, palette);
  cv.blit(right, hx + 13, hy + 10, palette);
  if (look.brows === "angry") {
    const brow = look.grandma ? C.grey : C.hair;
    cv.line(hx + 3, hy + 7, hx + 8, hy + 8, brow, 1);
    cv.line(hx + 13, hy + 8, hx + 18, hy + 7, brow, 1);
    cv.line(hx + 4, hy + 7, hx + 8, hy + 8, brow, 1);
  } else if (look.brows === "worried") {
    const brow = look.grandma ? C.grey : C.hair;
    cv.line(hx + 3, hy + 8, hx + 8, hy + 7, brow, 1);
    cv.line(hx + 13, hy + 7, hx + 18, hy + 8, brow, 1);
  }
}

// --- Mouths (drawn under the mustache) ---

export type MouthKind = "closed" | "small" | "mid" | "wide" | "o" | "grin" | "kiss" | "frown" | "clench";

function drawMouth(cv: Canvas, hx: number, hy: number, look: Look) {
  const kind = look.mouth ?? "closed";
  const skin = look.soot ? C.soot : C.skin;
  const y = hy + 19;
  cv.rect(hx + 9, y, 4, 1, skin);
  const put = (dx: number, dy: number, rows: string[]) =>
    cv.blit(rows, hx + dx, y + dy, { N: C.mouth, n: C.teeth, t: C.tongue, S: skin });
  switch (kind) {
    case "closed": put(9, 0, ["NNNN"]); break;
    case "small": put(9, 0, ["NNNN", "NNNN"]); break;
    case "mid": put(8, 0, ["NnnnnN", "NNNNNN"]); break;
    case "wide": put(8, 0, ["NnnnnN", "NNttNN", ".NNNN."]); break;
    case "o": put(9, 0, [".NN.", "NNNN", ".NN."]); break;
    case "grin": put(7, 0, ["nnnnnnnn", ".NNNNNN."]); break;
    case "clench": put(7, 0, ["nNnNnNnn", ".nnnnnn."]); break;
    case "kiss": put(10, 0, ["tt", "NN"]); break;
    case "frown": put(8, 0, [".NNNN.", "N....N"]); break;
  }
}

// --- Mustache variants: left half (11 wide) mirrored, drawn from head row 14 ---

export type MustacheKind = "normal" | "up" | "droop" | "frizz";

const mirrored = (name: string, half: string[]) =>
  sprite(name, half.map((row) => row + [...row].reverse().join("")));

// One solid silhouette (no thin strokes across the cheeks): full under the
// nose, tapering arms, and each tip rolled up into a small solid curl.
// Halves are 9 wide (18 mirrored), drawn 2px in from the head edge so the
// curls sit on the cheeks instead of merging with the jaw stubble.
const MUSTACHE_INSET = 2;
const MUSTACHES: Record<MustacheKind, string[]> = {
  normal: mirrored("mustache-normal", [
    ".........",
    "M........",
    "MM.....MM",
    "MMM..MMLM",
    ".MMMMMMMM",
    "...MMMMM.",
  ]),
  up: mirrored("mustache-up", [
    "M........",
    "MM.......",
    "MMM....MM",
    ".MMMMMMLM",
    "..MMMMMMM",
    ".....MMM.",
  ]),
  droop: mirrored("mustache-droop", [
    ".........",
    ".......MM",
    ".....MMLM",
    "..MMMMMMM",
    "MMMMMM...",
    "MM.......",
    "M........",
  ]),
  frizz: mirrored("mustache-frizz", [
    "M..M.....",
    "MMMM...MM",
    "MMMMM.MMM",
    ".MMMMMMLM",
    "M.MMMMM..",
    "..M..M...",
  ]),
};

function drawMustache(cv: Canvas, hx: number, hy: number, look: Look) {
  const rows = MUSTACHES[look.mustache ?? "normal"];
  const palette = look.grandma
    ? { M: C.grey, m: C.greyShade, L: C.greyHi }
    : { M: C.hair, m: C.hairShade, L: C.hairHi };
  cv.blit(rows, hx + MUSTACHE_INSET, hy + 14 - (look.mustacheLift ?? 0), palette);
}

function drawCurlers(cv: Canvas, hx: number, hy: number) {
  for (const [dx, dy] of [[3, 2], [8, 0], [13, 0], [18, 2], [1, 6], [20, 6]] as const) {
    cv.disc(hx + dx, hy + dy + 1, 1, C.curler);
    cv.set(hx + dx, hy + dy + 1, C.curlerDark);
  }
}

export function drawHead(cv: Canvas, hx: number, hy: number, look: Look = {}) {
  cv.blit(HEAD, hx, hy, headPalette(look));
  drawEyes(cv, hx, hy, look);
  drawMouth(cv, hx, hy, look);
  drawMustache(cv, hx, hy, look);
  if (look.grandma) drawCurlers(cv, hx, hy);
  if (look.soot) {
    // Singed hair tufts sticking up.
    for (const dx of [2, 6, 11, 15, 19]) cv.line(hx + dx, hy - 1, hx + dx + (dx % 2 ? 1 : -1), hy - 3, C.hair, 1);
  }
}

// --- Torso ---

const ROSE = sprite("rose", [
  ".LMM.",
  "MmMmM",
  ".MmM.",
  "..V..",
  ".VV..",
]);

export interface TorsoOptions {
  shawl?: boolean;
}

/** Torso centered on `cx`, starting at `top` and running to the bottom of the canvas. */
export function drawTorso(cv: Canvas, cx: number, top: number, options: TorsoOptions = {}) {
  const fill = options.shawl ? C.shawl : C.shirt;
  for (let row = 0; top + row < cv.height; row++) {
    const half = Math.min(15, 5 + Math.round(row * 2.6));
    for (let x = cx - half; x < cx + half; x++) {
      const edge = x === cx - half || x === cx + half - 1;
      let color = edge ? C.shirtEdge : fill;
      if (options.shawl && !edge) color = (x + row) % 3 === 0 ? C.shawlHi : C.shawl;
      cv.set(x, top + row, color);
    }
  }
  if (options.shawl) {
    // Shawl fringe and a knotted front.
    cv.rect(cx - 2, top + 3, 4, 3, C.shawlHi);
    cv.line(cx - 1, top + 6, cx - 3, top + 10, C.shawlHi);
    cv.line(cx, top + 6, cx + 2, top + 10, C.shawlHi);
    return;
  }
  // V-neck with the chain from the reference photo.
  for (let row = 0; row < 3; row++) {
    const half = 3 - row;
    cv.rect(cx - half, top + row, half * 2, 1, C.skin);
  }
  cv.set(cx - 3, top + 1, C.chain);
  cv.set(cx + 2, top + 1, C.chain);
  cv.set(cx - 2, top + 2, C.chain);
  cv.set(cx + 1, top + 2, C.chain);
  // Gentle Shell rose on the wearer's left chest (viewer's right).
  cv.blit(ROSE, cx + 5, top + 5, { M: KEY.base, m: KEY.shade, L: KEY.light, V: C.leaf });
}

// --- Arms ---

/**
 * Arm from the shoulder through the elbow to the hand. The first stretch is
 * the black sleeve, the rest bare skin; the hand is a small rounded block.
 */
export function drawArm(cv: Canvas, shoulder: [number, number], elbow: [number, number], hand: [number, number], sleeve = 0.55) {
  const sx = shoulder[0] + (elbow[0] - shoulder[0]) * sleeve;
  const sy = shoulder[1] + (elbow[1] - shoulder[1]) * sleeve;
  cv.line(elbow[0], elbow[1], hand[0], hand[1], C.skin, 3);
  cv.line(sx, sy, elbow[0], elbow[1], C.skin, 3);
  cv.line(shoulder[0], shoulder[1], sx, sy, C.shirt, 4);
  cv.disc(hand[0], hand[1], 2, C.skin);
  cv.set(hand[0] + 1, hand[1] + 1, C.skinShade);
}

const PALM = sprite("palm", [
  "S.S.S.S.",
  "S.S.S.S.",
  "SSSSSSS.",
  "SSSSSSSS",
  "sSSSSSSS",
  ".sSSSSs.",
  "..SSSS..",
]);

/** Open palm facing the viewer (STOP / wave); `x,y` is its top-left. */
export function drawPalm(cv: Canvas, x: number, y: number, flip = false) {
  cv.blit(PALM, x, y, { S: C.skin, s: C.skinShade }, flip);
}

// Raised arm on the viewer's left, elbow out: open hand, upright forearm well
// clear of the face, then the black short sleeve running into the shoulder.
const RAISED_ARM_ROWS = [
  ".S.S.S.S.......",
  ".S.S.S.S.......",
  ".SSSSSSS.S.....",
  ".SSSSSSSSS.....",
  ".sSSSSSSS......",
  "..sSSSSs.......",
  "...SSSs........",
  "...SSSs........",
  "...SSSs........",
  "...SSSs........",
  "...SSSs........",
  "...SSSs........",
  "...SSSs........",
  "...SSSSEEEEEE..",
  "...sSSSKKKKKKE.",
  "...ssSKKKKKKKKE",
  "....sEKKKKKKKKK",
  ".....EEKKKKKKKK",
  ".......EEEKKKKK",
];
const RAISED_ARM_W = RAISED_ARM_ROWS[0]!.length;
/** Sprite row where the sleeve meets the shoulder point. */
const RAISED_ARM_SHOULDER_ROW = 15;

function leanHand(rows: string[], lean: number): string[] {
  if (lean <= 0) return rows;
  return rows.map((row, index) => {
    const shift = index < 10 ? Math.min(lean, 1) : 0;
    return row.slice(shift) + ".".repeat(shift);
  });
}

/**
 * Waving arm attached at a shoulder point of the bust. `side` picks the
 * viewer's left or right shoulder; `lean` tips the hand outward (wave frame 2).
 */
export function drawRaisedArm(cv: Canvas, shoulder: [number, number], lean = 0, side: "left" | "right" = "left") {
  const rows = sprite(`raised-arm-${lean}`, leanHand(RAISED_ARM_ROWS, lean));
  const x = side === "left" ? shoulder[0] + 2 - (RAISED_ARM_W - 1) : shoulder[0] - 2;
  const y = shoulder[1] - RAISED_ARM_SHOULDER_ROW;
  cv.blit(rows, x, y, { S: C.skin, s: C.skinShade, K: C.shirt, E: C.shirtEdge }, side === "right");
}

/** Head + torso bust centered on `cx`; returns the head origin. */
export function drawBust(cv: Canvas, cx: number, look: Look = {}, torso: TorsoOptions = {}, headTop = 1) {
  const hx = cx - HEAD_W / 2;
  drawTorso(cv, cx, headTop + 25, torso);
  drawHead(cv, hx, headTop, look);
  return { hx, hy: headTop, torsoTop: headTop + 25 };
}
