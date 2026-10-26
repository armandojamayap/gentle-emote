import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { Animator } from "../src/animator.ts";
import type { Config, EmoteState } from "../src/types.ts";

const config: Config = {
  enabled: true, debug: false, size: 12, placement: "beside-editor", frame: true, frameRows: 4, minEditorWidth: 40, readingSpeed: 4,
  holdDuration: { hi: 1000, success: 1000, failure: 1000, bye: 1000 },
  blinkInterval: [60_000, 60_000], talkTickMs: 120, cycleMs: 100, grandmaAfterMs: 5000,
  accent: "auto", farewellPattern: "^chau", emotes: [], terminals: [],
};

/** Records what the animator asks to show. */
function fakeRenderer(files: Partial<Record<EmoteState, string[]>>) {
  const shown: string[] = [];
  return {
    shown,
    setTui() {}, loadFrames() {}, getRenderedFrame: () => null, dispose() {}, resetCache() {},
    getFrameFiles: (state: EmoteState) => files[state] ?? [],
    showFrame: (state: EmoteState, name: string) => { shown.push(`${state}/${name}`); return true; },
    showRandomFrame: (state: EmoteState) => { shown.push(`${state}/*`); return true; },
    showTalkFrame: () => true, showTalkCloseFrame: () => true,
    showCycleFrame: (state: EmoteState, i: number) => { shown.push(`${state}#${i}`); return true; },
    getCycleFrameCount: (state: EmoteState) => files[state]?.length ?? 0,
  };
}

test("idle turns into the grandma after grandmaAfterMs and plays intro then loop", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const renderer = fakeRenderer({ idle: ["idle.png"], grandma: ["in_1.png", "in_2.png", "knit_1.png", "knit_2.png"] });
    const animator = new Animator(config, renderer as any);
    animator.transitionTo("idle");
    mock.timers.tick(4999);
    assert.equal(animator.currentState, "idle");
    mock.timers.tick(1);
    assert.equal(animator.currentState, "grandma");
    mock.timers.tick(100 * 5);
    assert.deepEqual(renderer.shown.filter((s) => s.startsWith("grandma")), [
      "grandma/in_1.png", "grandma/in_2.png", "grandma/knit_1.png", "grandma/knit_2.png", "grandma/knit_1.png", "grandma/knit_2.png",
    ]);
    animator.clearAllTimers();
  } finally {
    mock.timers.reset();
  }
});

test("touch() while idle postpones the grandma", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const animator = new Animator(config, fakeRenderer({ idle: ["idle.png"], grandma: ["knit_1.png"] }) as any);
    animator.transitionTo("idle");
    mock.timers.tick(4000);
    animator.touch();
    mock.timers.tick(4000);
    assert.equal(animator.currentState, "idle");
    mock.timers.tick(1000);
    assert.equal(animator.currentState, "grandma");
    animator.clearAllTimers();
  } finally {
    mock.timers.reset();
  }
});

test("no grandma frames means no transformation", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const animator = new Animator(config, fakeRenderer({ idle: ["idle.png"] }) as any);
    animator.transitionTo("idle");
    mock.timers.tick(60_000);
    assert.equal(animator.currentState, "idle");
    animator.clearAllTimers();
  } finally {
    mock.timers.reset();
  }
});

test("loop cycle mode runs forward instead of ping-pong", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const renderer = fakeRenderer({ tool: ["a", "b", "c"] });
    const animator = new Animator(config, renderer as any);
    animator.setEmotesConfig({ cycle: { tool: "loop" }, frameMs: { tool: 50 } });
    animator.transitionTo("tool");
    mock.timers.tick(50 * 4);
    assert.deepEqual(renderer.shown, ["tool#0", "tool#1", "tool#2", "tool#0", "tool#1"]);
    animator.clearAllTimers();
  } finally {
    mock.timers.reset();
  }
});

test("success after talk: setAfterTalkState plays once talking ends", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  try {
    const animator = new Animator(config, fakeRenderer({ success: ["s1"] }) as any);
    animator.transitionTo("talk");
    animator.setAfterTalkState("success");
    animator.endTalk();
    assert.equal(animator.currentState, "success");
    mock.timers.tick(1000);
    assert.equal(animator.currentState, "idle");
    animator.clearAllTimers();
  } finally {
    mock.timers.reset();
  }
});
