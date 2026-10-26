import { test } from "node:test";
import assert from "node:assert/strict";
import { CURSOR_MARKER, Container, visibleWidth } from "@earendil-works/pi-tui";
import { composeBesideEditor, findEditorContainer, gutterWidth, installGutter } from "../src/gutter.ts";

const avatar = { lines: ["AAAA", "BBBB", "CCCC", "DDDD"], cols: 4 };

/** Stands in for the prompt: fills the width it is given, cursor on the last row. */
class FakeEditor {
  rows: number;
  constructor(rows: number) { this.rows = rows; }
  render(width: number): string[] {
    return Array.from({ length: this.rows }, (_, i) =>
      i === this.rows - 1 ? `> ${CURSOR_MARKER}${"x".repeat(width - 2)}` : "-".repeat(width));
  }
}

test("composeBesideEditor bottom-aligns a short prompt with the avatar", () => {
  const lines = composeBesideEditor(avatar, ["prompt-1", "prompt-2"]);
  assert.deepEqual(lines, ["AAAA ", "BBBB ", "CCCC prompt-1", "DDDD prompt-2"]);
});

test("composeBesideEditor keeps the avatar at the bottom of a tall prompt", () => {
  const lines = composeBesideEditor({ lines: ["AA"], cols: 2 }, ["l1", "l2", "l3"]);
  assert.deepEqual(lines, ["   l1", "   l2", "AA l3"]);
});

test("installGutter narrows the editor so every row fits the terminal width", () => {
  const container = new Container();
  container.addChild(new FakeEditor(2) as any);
  const restore = installGutter(container as any, () => avatar);

  const lines = container.render(60);
  assert.equal(lines.length, 4);
  // pi-tui rejects rows wider than the terminal; prompt rows use it fully.
  for (const line of lines) assert.ok(visibleWidth(line) <= 60);
  assert.equal(visibleWidth(lines[2]!), 60);
  assert.equal(visibleWidth(lines[3]!), 60);
  assert.ok(lines[0]!.startsWith("AAAA "));

  // The hardware cursor column shifts by exactly the gutter width.
  const cursorLine = lines[3]!;
  const before = cursorLine.slice(0, cursorLine.indexOf(CURSOR_MARKER));
  assert.equal(visibleWidth(before), gutterWidth(avatar) + 2);

  restore();
  assert.equal(Object.prototype.hasOwnProperty.call(container, "render"), false);
  assert.deepEqual(container.render(10), new FakeEditor(2).render(10));
});

test("installGutter passes the full width through when there is no avatar", () => {
  const container = new Container();
  container.addChild(new FakeEditor(1) as any);
  installGutter(container as any, () => null);
  assert.equal(visibleWidth(container.render(30)[0]!), 30);
  assert.equal(container.render(30)[0]!.startsWith("> "), true);
});

test("installGutter leaves an empty editor (hidden prompt) empty", () => {
  const container = new Container();
  installGutter(container as any, () => avatar);
  assert.deepEqual(container.render(50), []);
});

test("findEditorContainer picks the container right after the anchor's widget container", () => {
  const anchor = { render: () => [] };
  const widgets = new Container();
  widgets.addChild(anchor as any);
  const editor = new Container();
  const tui = { children: [new Container(), widgets, editor, new Container()] };
  assert.equal(findEditorContainer(tui, anchor), editor);
});

test("findEditorContainer falls back to the container holding the focused component", () => {
  const focused = { render: () => [] };
  const editor = new Container();
  editor.addChild(focused as any);
  const tui = { children: [new Container(), editor], getFocusedComponent: () => focused };
  assert.equal(findEditorContainer(tui, { render: () => [] }), editor);
});

test("findEditorContainer returns null when nothing matches", () => {
  assert.equal(findEditorContainer({ children: [new Container()] }, {}), null);
  assert.equal(findEditorContainer({}, {}), null);
});
