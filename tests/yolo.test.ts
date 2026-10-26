import { test } from "node:test";
import assert from "node:assert/strict";
import { readYoloRest, yoloRestVariant } from "../src/yolo.ts";

test("YOLO rests on the rocket and Super YOLO rests on the sun", () => {
  assert.equal(yoloRestVariant("ON", "yolo"), "yolo");
  assert.equal(yoloRestVariant("ON", "super-yolo"), "super-yolo");
  assert.equal(yoloRestVariant("ON", "normal"), "yolo");
  assert.equal(yoloRestVariant("OFF", "super-yolo"), null);
  assert.equal(yoloRestVariant("UNAVAILABLE", "yolo"), null);
});

test("the host snapshot picks the sun when Super YOLO is the live mode", async () => {
  const variant = await readYoloRest({
    read: async () => "ON",
    readMode: async () => "yolo",
    readSnapshot: async () => ({ yolo: "ON", mode: "super-yolo", defaultMode: "normal" }),
  });
  assert.equal(variant, "super-yolo");
});

test("an older host without a mode read keeps the rocket", async () => {
  const variant = await readYoloRest({ read: async () => "ON" });
  assert.equal(variant, "yolo");
});
