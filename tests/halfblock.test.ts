import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { resetCapabilitiesCache, visibleWidth } from "@earendil-works/pi-tui";
import { downscale, toHalfblockLines } from "../src/halfblock.ts";
import { HalfblockRenderer } from "../src/render_halfblock.ts";
import { resolveRenderer } from "../src/terminal.ts";
import { toAvatarBlock } from "../src/widget.ts";
import { tmpdir } from "node:os";
import { loadLayeredConfig } from "../src/config.ts";
import type { RgbaImage } from "../src/png.ts";

process.env.PI_CODING_AGENT_DIR = join(tmpdir(), "gentle-emote-test-none");
const DEFAULTS = loadLayeredConfig(join(import.meta.dirname, ".."), tmpdir()).config;

type Px = [number, number, number, number];
const RED: Px = [255, 0, 0, 255];
const BLUE: Px = [0, 0, 255, 255];
const NONE: Px = [0, 0, 0, 0];

function image(width: number, rows: Px[][]): RgbaImage {
  const data = new Uint8Array(rows.flat().flat());
  return { width, height: rows.length, data };
}

test("toHalfblockLines packs two vertical pixels per cell", () => {
  const lines = toHalfblockLines(image(4, [
    [RED, RED, NONE, NONE],
    [BLUE, NONE, BLUE, NONE],
  ]));
  assert.equal(lines.length, 1);
  assert.equal(lines[0],
    "\x1b[38;2;255;0;0m\x1b[48;2;0;0;255m▀" + // both halves: fg over bg
    "\x1b[49m\x1b[38;2;255;0;0m▀" + // upper half only, default background
    "\x1b[49m\x1b[38;2;0;0;255m▄" + // lower half only
    "\x1b[0m " + // transparent cell resets colours
    "");
  assert.equal(visibleWidth(lines[0]!), 4);
});

test("toHalfblockLines keeps an odd last row and always resets colours", () => {
  const lines = toHalfblockLines(image(1, [[RED], [RED], [RED]]));
  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => line.endsWith("\x1b[0m")));
  assert.ok(lines[1]!.includes("▀"));
});

test("toHalfblockLines draws a fully transparent row as plain spaces", () => {
  assert.deepEqual(toHalfblockLines(image(3, [[NONE, NONE, NONE], [NONE, NONE, NONE]])), ["   "]);
});

test("downscale keeps the native size and picks the dominant colour, never a blend", () => {
  const src = image(3, [[RED, RED, BLUE], [RED, RED, BLUE], [RED, RED, BLUE]]);
  assert.equal(downscale(src, 48), src);
  const one = downscale(src, 1);
  assert.deepEqual([one.width, one.height], [1, 1]);
  assert.deepEqual([...one.data], [255, 0, 0, 255]);
});

test("downscale keeps a block transparent when transparency covers most of it", () => {
  const src = image(3, [[RED, NONE, NONE], [NONE, NONE, NONE], [NONE, NONE, BLUE]]);
  assert.deepEqual([...downscale(src, 1).data], [0, 0, 0, 0]);
  const mostlyRed = image(3, [[RED, RED, NONE], [RED, RED, NONE], [RED, NONE, NONE]]);
  assert.deepEqual([...downscale(mostlyRed, 1).data], [255, 0, 0, 255]);
});

test("HalfblockRenderer shows gentleman frames as text rows that fit the gutter", () => {
  const renderer = new HalfblockRenderer(48);
  renderer.loadFrames(join(import.meta.dirname, "..", "emotes", "gentleman"), "");
  assert.ok(renderer.showRandomFrame("idle"));
  const frame = renderer.getRenderedFrame();
  assert.equal(frame?.kind, "placeholder");
  if (frame?.kind !== "placeholder") return;
  assert.equal(frame.cols, 48);
  assert.equal(frame.rows, 20);
  assert.ok(frame.lines.every((line) => visibleWidth(line) === 48));
  assert.ok(frame.lines.some((line) => line.includes("\x1b[38;2;")));

  const avatar = toAvatarBlock(frame, { ...DEFAULTS, frame: true }, (text) => text);
  assert.equal(avatar?.cols, 48);
  assert.ok(avatar?.border, "plain text rows get the themed box like the ASCII avatar");
});

test("the default halfblockSize draws a 32 x 14 avatar", () => {
  assert.equal(DEFAULTS.halfblockSize, 32);
  const renderer = new HalfblockRenderer(DEFAULTS.halfblockSize);
  renderer.loadFrames(join(import.meta.dirname, "..", "emotes", "gentleman"), "");
  renderer.showRandomFrame("idle");
  const frame = renderer.getRenderedFrame();
  assert.equal(frame?.kind === "placeholder" && frame.cols, 32);
  assert.equal(frame?.kind === "placeholder" && frame.rows, 14);
});

test("HalfblockRenderer honours a smaller halfblockSize", () => {
  const renderer = new HalfblockRenderer(24);
  renderer.loadFrames(join(import.meta.dirname, "..", "emotes", "gentleman"), "");
  renderer.showRandomFrame("idle");
  const frame = renderer.getRenderedFrame();
  assert.equal(frame?.kind === "placeholder" && frame.cols, 24);
  assert.equal(frame?.kind === "placeholder" && frame.rows, 10);
});

const TERMINAL_ENV = [
  "TMUX", "ZELLIJ", "ZELLIJ_SESSION_NAME", "KITTY_WINDOW_ID", "GHOSTTY_RESOURCES_DIR", "WEZTERM_PANE",
  "ITERM_SESSION_ID", "WARP_SESSION_ID", "WARP_TERMINAL_SESSION_UUID", "WT_SESSION", "TERM_PROGRAM",
  "TERMINAL_EMULATOR", "COLORTERM", "PI_IMAGE_PROTOCOL", "PI_TRUE_COLOR", "ORCA_IMAGE_PROTOCOL",
];

function withTerminal(env: Record<string, string>, run: () => void) {
  const saved = Object.fromEntries([...TERMINAL_ENV, "TERM"].map((key) => [key, process.env[key]]));
  for (const key of TERMINAL_ENV) delete process.env[key];
  process.env.TERM = "xterm-256color";
  Object.assign(process.env, env);
  resetCapabilitiesCache();
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetCapabilitiesCache();
  }
}

test("an unknown truecolor terminal without an image protocol gets the half-block renderer", () => {
  withTerminal({ TERM_PROGRAM: "SomeTerm", COLORTERM: "truecolor" }, () => {
    assert.equal(resolveRenderer(DEFAULTS.terminals, new Set()).protocol, "halfblock");
  });
});

test("an unknown terminal without truecolor keeps the ASCII renderer", () => {
  withTerminal({ PI_TRUE_COLOR: "0" }, () => {
    assert.equal(resolveRenderer(DEFAULTS.terminals, new Set()).protocol, "ascii");
  });
});

test("terminals with an image protocol keep it", () => {
  withTerminal({ GHOSTTY_RESOURCES_DIR: "/usr/share/ghostty" }, () => {
    assert.equal(resolveRenderer(DEFAULTS.terminals, new Set()).protocol, "kitty");
  });
});

test("an explicit render: halfblock mapping is honoured", () => {
  withTerminal({ TERM_PROGRAM: "WezTerm" }, () => {
    const terminals = [{ match: "wezterm", render: "halfblock" as const }];
    assert.equal(resolveRenderer(terminals, new Set(["wezterm"])).protocol, "halfblock");
  });
});
