import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { Animator } from "../src/animator.ts";
import extension, { toolNameToState } from "../src/index.ts";
import type { Config, EmoteState } from "../src/types.ts";

test("Gentle Shell activity tools map to their scenes", () => {
  for (const tool of ["subagent_run", "subagent_continue", "subagent_reply", "mcp__gs__subagent_run"]) {
    assert.equal(toolNameToState(tool), "delegate", tool);
  }
  for (const tool of ["bash_background", "monitor", "job_list", "job_stop"]) {
    assert.equal(toolNameToState(tool), "jobs", tool);
  }
  assert.equal(toolNameToState("mem_save"), "remember");
  assert.equal(toolNameToState("bash"), "tool");
  assert.equal(toolNameToState("read"), "read");
});

test("subagent runs pick a scene from the agent name, unknown agents keep the megaphone", () => {
  const cases: Array<[string, EmoteState]> = [
    ["gentle-ai-explore", "explore"],
    ["gentle-ai-worker", "build"],
    ["jd-fix-agent", "build"],
    ["gentle-ai-verify", "verify"],
    ["review-validator", "verify"],
    ["jd-judge-a", "judge"],
    ["jd-judge-b", "judge"],
    ["review-refuter", "judge"],
    ["review-readability", "review"],
    ["review-reliability", "review"],
    ["review-resilience", "review"],
    ["review-risk", "review"],
    ["jira-comment", "jira"],
    ["my-custom-agent", "delegate"],
  ];
  for (const [agent, state] of cases) {
    assert.equal(toolNameToState("subagent_run", { agent, task: "x" }), state, agent);
  }
  assert.equal(toolNameToState("subagent_continue", { taskId: "t1" }), "delegate");
  assert.equal(toolNameToState("subagent_run"), "delegate");
});

const config: Config = {
  enabled: true, debug: false, size: 10, placement: "beside-editor", frame: true, frameRows: 4, minEditorWidth: 40, readingSpeed: 4,
  holdDuration: { hi: 1000, success: 1000, failure: 1000, bye: 1000 },
  blinkInterval: [60_000, 60_000], talkTickMs: 120, cycleMs: 100, grandmaAfterMs: 60_000,
  accent: "auto", farewellPattern: "^chau", emotes: [], terminals: [],
};

function fakeRenderer(files: Partial<Record<EmoteState, string[]>>) {
  const shown: string[] = [];
  return {
    shown,
    setTui() {}, loadFrames() {}, getRenderedFrame: () => null, dispose() {}, resetCache() {},
    getFrameFiles: (state: EmoteState) => files[state] ?? [],
    showFrame: (state: EmoteState, name: string) => { shown.push(`${state}/${name}`); return true; },
    showRandomFrame: () => true, showTalkFrame: () => true, showTalkCloseFrame: () => true,
    showCycleFrame: () => true, getCycleFrameCount: () => 0,
  };
}

test("an idle variant replaces the resting pose and blinks with its own frame", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const renderer = fakeRenderer({ idle: ["idle.png", "idle_blink.png"], yolo: ["yolo.png", "yolo_blink.png"] });
    const animator = new Animator(config, renderer as any);
    animator.transitionTo("idle");
    animator.setIdleVariant("yolo");
    assert.equal(renderer.shown.at(-1), "yolo/yolo.png");
    mock.timers.tick(60_000);
    assert.equal(renderer.shown.at(-1), "yolo/yolo_blink.png");
    animator.setIdleVariant(null);
    assert.equal(renderer.shown.at(-1), "idle/idle.png");
    animator.stop();
  } finally {
    mock.timers.reset();
  }
});

test("the YOLO adapter is only read and observed, never toggled", async () => {
  delete process.env.TMUX;
  process.env.PI_CODING_AGENT_DIR = "/nonexistent/agent";
  const calls: string[] = [];
  let notify: () => void = () => {};
  let display = "ON";
  const adapter = {
    read: async () => { calls.push("read"); return display; },
    observe: (cb: () => void) => { calls.push("observe"); notify = cb; return () => calls.push("unobserve"); },
    dispose: () => calls.push("dispose"),
    toggle: () => calls.push("toggle"),
    setMode: () => calls.push("setMode"),
    saveDefault: () => calls.push("saveDefault"),
  };
  const channels: string[] = [];
  const handlers = new Map<string, Function[]>();
  const pi = {
    on: (event: string, handler: Function) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
    registerCommand() {},
    getThinkingLevel: () => "high",
    events: {
      emit: (channel: string, payload: any) => { channels.push(channel); payload.respond(adapter); },
      on: () => () => {},
    },
  };
  const ctx = { hasUI: true, cwd: "/tmp", ui: { notify() {}, onTerminalInput: () => () => {}, setWidget() {} } };
  const emit = async (event: string, payload: any = {}) => {
    for (const handler of handlers.get(event) ?? []) await handler(payload, ctx);
  };
  extension(pi as any);
  try {
    await emit("session_start");
    await new Promise((resolve) => setImmediate(resolve));
    display = "OFF";
    notify();
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    await emit("session_shutdown", { reason: "quit" });
  }
  assert.deepEqual(channels, ["gentle:yolo:host-ui"]);
  assert.deepEqual(calls, ["observe", "read", "read", "unobserve", "dispose"]);
});
