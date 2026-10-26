import { test } from "node:test";
import assert from "node:assert/strict";
import { Container, visibleWidth } from "@earendil-works/pi-tui";

const PLACEHOLDER = "\u{10EEEE}";

/** Loads the extension against a fake Pi and a real pi-tui component tree (Ghostty, no multiplexer). */
async function boot() {
  for (const key of ["TMUX", "ZELLIJ", "ZELLIJ_SESSION_NAME", "KITTY_WINDOW_ID", "TERM_PROGRAM"]) delete process.env[key];
  process.env.GHOSTTY_RESOURCES_DIR = "/usr/share/ghostty";
  process.env.PI_CODING_AGENT_DIR = "/nonexistent/agent";

  const writes: string[] = [];
  const realWrite = process.stdout.write.bind(process.stdout);
  (process.stdout as any).write = (chunk: string) => { writes.push(String(chunk)); return true; };

  const handlers = new Map<string, Function[]>();
  const commands = new Map<string, any>();
  const pi = {
    on: (event: string, handler: Function) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
    registerCommand: (name: string, options: any) => commands.set(name, options),
    getThinkingLevel: () => "high",
  };
  const emit = async (event: string, payload: any = {}) => {
    for (const handler of handlers.get(event) ?? []) await handler(payload, ctx);
  };

  const widgets = new Container();
  const editor = new Container();
  // Same shape as Gentle Shell's float prompt: hint row, input row, blank panel row.
  editor.addChild({ render: (width: number) => [`┃ waiting for input`.padEnd(width), `┃ > `.padEnd(width), `┃`.padEnd(width)] } as any);
  const tui = { children: [widgets, editor], requestRender() {}, getFocusedComponent: () => null };
  const ctx = {
    hasUI: true,
    cwd: "/tmp",
    model: { id: "claude-test" },
    ui: {
      notify() {},
      onTerminalInput: () => () => {},
      setWidget: (_key: string, factory: any) => { widgets.clear(); if (factory) widgets.addChild(factory(tui, {})); },
    },
  };

  const { default: extension } = await import("../src/index.ts");
  extension(pi as any);
  await emit("session_start");
  const shutdown = async () => {
    if (shutDown) return;
    shutDown = true;
    await emit("session_shutdown", { reason: "quit" });
  };
  let shutDown = false;
  return { emit, widgets, editor, writes, shutdown, commands, ctx, restore: () => { (process.stdout as any).write = realWrite; } };
}

const plain = (line: string) => line.replace(/\x1b\[[0-9;]*m/g, "");

test("the framed avatar sits beside the prompt, which grows to the frame height", async () => {
  const lab = await boot();
  try {
    await lab.emit("tool_execution_start", { toolName: "bash" });
    assert.deepEqual(lab.widgets.render(100), [], "beside-editor leaves no row above the prompt");

    const lines = lab.editor.render(100).map(plain);
    for (const line of lines) assert.ok(visibleWidth(line) <= 100);
    assert.equal(lines.length, 4, "frameRows (4): the frame and the prompt share the same height");
    assert.ok(lines.every((line) => line.startsWith(PLACEHOLDER)), "the framed image fills every row, no text border rows");
    assert.ok(lines[0]!.includes("waiting for input"), "the prompt is not pushed down: it grows instead");
    assert.ok(lines.slice(2).every((line) => line.includes("┃")), "the blank panel row fills the extra height");
    assert.ok(lab.writes.some((w) => /a=T,f=100,q=2,U=1,i=\d+,c=\d+,r=4/.test(w)), "the frame image is sent 4 rows tall");

    const emote = lab.commands.get("emote");
    assert.ok(emote, "/emote is registered");
    const completions = await emote.getArgumentCompletions("gr");
    assert.deepEqual(completions.map((item: any) => item.value), ["grandma"]);
    const before = lab.writes.length;
    await emote.handler("grandma", lab.ctx);
    assert.ok(lab.writes.length > before, "/emote grandma swaps the frame without the model");

    // The image itself travels out of band as a kitty virtual placement.
    assert.ok(lab.writes.some((w) => w.includes("\x1b_Ga=T") && w.includes("U=1")));
    assert.ok(!lab.writes.some((w) => w.startsWith("\x1bPtmux;")), "no tmux wrapping outside tmux");

    await lab.shutdown();
    assert.ok(!lab.editor.render(100)[0]!.includes(PLACEHOLDER), "shutdown restores the plain prompt");
  } finally {
    await lab.shutdown();
    lab.restore();
  }
});
