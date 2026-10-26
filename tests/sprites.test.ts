import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EMOTE_STATES } from "../src/types.ts";
import { decodePng } from "../src/png.ts";
import { ACCENT_KEYS } from "../src/accent.ts";
import { cycleFrameFiles } from "../src/emotes.ts";
import { toolNameToState } from "../src/index.ts";

const SET = join(import.meta.dirname, "..", "emotes", "gentleman");

test("the gentleman set has frames for every state, all 48x40", () => {
  for (const state of EMOTE_STATES) {
    const files = readdirSync(join(SET, state)).filter((f) => f.endsWith(".png"));
    assert.ok(files.length > 0, `no frames for ${state}`);
    for (const file of files) {
      const png = decodePng(readFileSync(join(SET, state, file)));
      assert.deepEqual([png.width, png.height], [48, 40], `${state}/${file}`);
    }
  }
});

test("only the rose logo carries accent keys; the mustache matches the hair", () => {
  const { width, data } = decodePng(readFileSync(join(SET, "idle", "idle.png")));
  const isBase = (i: number) =>
    data[i] === ACCENT_KEYS.base[0] && data[i + 1] === ACCENT_KEYS.base[1] && data[i + 2] === ACCENT_KEYS.base[2];
  let keys = 0;
  let keysOnFace = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (!isBase(i)) continue;
    keys++;
    if (Math.floor(i / 4 / width) < 26) keysOnFace++;
  }
  assert.ok(keys > 0, "the rose logo follows the customize accent");
  assert.equal(keysOnFace, 0, "no accent pixels on the head (mustache uses the hair palette)");
});

test("no frame paints the old buck-tooth color", () => {
  const tooth = [0xf5, 0xef, 0xe6];
  for (const set of ["gentleman", "gentleman-yolo"]) {
    const root = join(SET, "..", set);
    for (const state of EMOTE_STATES) {
      for (const file of readdirSync(join(root, state)).filter((name) => name.endsWith(".png"))) {
        const { data } = decodePng(readFileSync(join(root, state, file)));
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          assert.ok(
            data[i] !== tooth[0] || data[i + 1] !== tooth[1] || data[i + 2] !== tooth[2],
            `${set}/${state}/${file} still has a tooth pixel`,
          );
        }
      }
    }
  }
});

test("the verify failure stamp is a frame, and it is not part of the loop", () => {
  const files = readdirSync(join(SET, "verify")).filter((name) => name.endsWith(".png")).sort();
  assert.ok(files.includes("fail.png"));
  assert.deepEqual(cycleFrameFiles(files), files.filter((name) => name !== "fail.png"));
});

test("the greeting flies in once, then the propeller keeps spinning", () => {
  const files = readdirSync(join(SET, "hi")).filter((name) => name.endsWith(".png")).sort();
  assert.ok(files.some((name) => name.startsWith("in_")), "missing the fly-in frames");
  assert.ok(files.some((name) => name.startsWith("landed_")), "missing the spinning-propeller loop");
});

test("emotes.json names files that exist", () => {
  const config = JSON.parse(readFileSync(join(SET, "emotes.json"), "utf-8"));
  for (const file of [config.idle.default, config.idle.blink]) readFileSync(join(SET, "idle", file));
  for (const file of Object.keys(config.talk.weights)) readFileSync(join(SET, "talk", file));
});

test("tools map to the right gestures", () => {
  assert.equal(toolNameToState("edit"), "write");
  assert.equal(toolNameToState("read"), "read");
  assert.equal(toolNameToState("ask_user_choice"), "ask");
  assert.equal(toolNameToState("mem_session_summary"), "bye");
  assert.equal(toolNameToState("bash"), "tool");
});
