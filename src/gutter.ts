import { visibleWidth } from "@earendil-works/pi-tui";

/**
 * An avatar ready to sit left of the prompt: plain text rows of `cols` cells.
 * With `border`, it is boxed in a rounded frame painted by that function.
 */
export interface AvatarBlock {
  lines: string[];
  cols: number;
  border?: (text: string) => string;
}

interface ContainerLike {
  children: unknown[];
  render(width: number): string[];
  handleMouse?: (event: { x?: number; y: number; width: number; height: number }) => unknown;
}

interface TuiLike {
  children?: unknown[];
  getFocusedComponent?: () => unknown;
}

const GAP = 1;

function isContainer(value: unknown): value is ContainerLike {
  return typeof value === "object" && value !== null
    && Array.isArray((value as ContainerLike).children)
    && typeof (value as ContainerLike).render === "function";
}

/**
 * Pi mounts `widgetsAbove` and `editor` as consecutive root children; the
 * editor container also hosts selectors and dialogs that replace the prompt.
 * The anchor (our own widget) pins the widgets container; focus is the backup.
 */
export function findEditorContainer(tui: TuiLike, anchor: unknown): ContainerLike | null {
  const roots = tui.children;
  if (!Array.isArray(roots)) return null;

  const anchorIndex = roots.findIndex((child) => isContainer(child) && child.children.includes(anchor));
  if (anchorIndex >= 0 && isContainer(roots[anchorIndex + 1])) {
    return roots[anchorIndex + 1] as ContainerLike;
  }

  const focused = tui.getFocusedComponent?.();
  if (!focused) return null;
  const owner = roots.find((child) => isContainer(child) && child.children.includes(focused));
  return (owner as ContainerLike | undefined) ?? null;
}

/** Pads every avatar row to exactly `cols` cells so the prompt column stays aligned. */
function fitAvatarRow(line: string | undefined, cols: number): string {
  if (!line) return " ".repeat(cols);
  const width = visibleWidth(line);
  return width < cols ? line + " ".repeat(cols - width) : line;
}

const FRAME_ROWS = 2;
const FRAME_COLS = 2;

function avatarHeight(avatar: AvatarBlock): number {
  return avatar.lines.length + (avatar.border ? FRAME_ROWS : 0);
}

const ANSI = /\x1b\[[0-9;:]*[A-Za-z]|\x1b_[^\x07\x1b]*(?:\x07|\x1b\\)/g;
const SIDE_BARS = /^[│┃║▎▏▕▌▐|╎╏┆┇┊┋]{0,2}$/u;

/** Empty panel padding: nothing but spaces and, at most, the side bars. */
function isPaddingRow(line: string): boolean {
  return SIDE_BARS.test(line.replace(ANSI, "").replace(/\s/g, ""));
}

/**
 * A prompt that ends in a padding row (Gentle Shell's float panel) is grown by
 * repeating that row, so the panel gets taller next to the avatar. Prompts that
 * end in a drawn border (neon box) keep their shape and are padded on top.
 */
function growEditor(editorLines: string[], rows: number): string[] {
  const last = editorLines[editorLines.length - 1];
  if (editorLines.length >= rows || last === undefined || !isPaddingRow(last)) return editorLines;
  return [...editorLines, ...Array.from({ length: rows - editorLines.length }, () => last)];
}

/** The framed avatar stretched to `rows`, image centered inside the box. */
function framedAvatarRows(avatar: AvatarBlock, rows: number): string[] {
  const border = avatar.border!;
  const inner = rows - FRAME_ROWS;
  const top = Math.floor((inner - avatar.lines.length) / 2);
  const out = [border(`╭${"─".repeat(avatar.cols)}╮`)];
  for (let row = 0; row < inner; row++) {
    out.push(border("│") + fitAvatarRow(avatar.lines[row - top], avatar.cols) + border("│"));
  }
  out.push(border(`╰${"─".repeat(avatar.cols)}╯`));
  return out;
}

export interface BesideEditorLayout {
  lines: string[];
  /** Rows of blank padding above the editor (mouse rows shift by this much). */
  editorTop: number;
  /** Columns left of the editor (mouse columns shift by this much). */
  editorLeft: number;
}

/**
 * Lays the avatar left of the editor lines. The editor is rendered narrower
 * by the gutter width; when it is shorter than the avatar it grows (blank last
 * row) or is padded on top so both share the bottom edge.
 */
export function layoutBesideEditor(avatar: AvatarBlock, editorLines: string[]): BesideEditorLayout {
  const editor = growEditor(editorLines, avatarHeight(avatar));
  const rows = Math.max(editor.length, avatarHeight(avatar));
  const editorTop = rows - editor.length;
  const left = avatar.border
    ? framedAvatarRows(avatar, rows)
    : Array.from({ length: rows }, (_, row) => avatar.lines[row - (rows - avatar.lines.length)]);
  const leftCols = avatar.cols + (avatar.border ? FRAME_COLS : 0);
  // A prompt that already starts with its own margin column needs no extra gap.
  const gapCols = editorLines.every((line) => line.startsWith(" ")) ? 0 : GAP;
  const gap = " ".repeat(gapCols);
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    const right = row >= editorTop ? editor[row - editorTop]! : "";
    lines.push(`${fitAvatarRow(left[row], leftCols)}${gap}${right}`);
  }
  return { lines, editorTop, editorLeft: leftCols + gapCols };
}

export function composeBesideEditor(avatar: AvatarBlock, editorLines: string[]): string[] {
  return layoutBesideEditor(avatar, editorLines).lines;
}

export function gutterWidth(avatar: AvatarBlock): number {
  return avatar.cols + (avatar.border ? FRAME_COLS : 0) + GAP;
}

/**
 * Wraps the editor container's render (and mouse hit-testing) on the instance
 * only. Returns a restore function; calling it twice is harmless.
 */
export function installGutter(
  container: ContainerLike,
  getAvatar: (width: number) => AvatarBlock | null,
): () => void {
  const ownRender = Object.prototype.hasOwnProperty.call(container, "render") ? container.render : undefined;
  const ownMouse = Object.prototype.hasOwnProperty.call(container, "handleMouse") ? container.handleMouse : undefined;
  const baseRender = container.render;
  const baseMouse = container.handleMouse;
  let activeGutter = 0;
  let activeLeft = 0;
  let activeTop = 0;

  container.render = function (this: ContainerLike, width: number): string[] {
    const avatar = getAvatar(width);
    activeGutter = 0;
    activeLeft = 0;
    activeTop = 0;
    if (!avatar) return baseRender.call(this, width);
    const gutter = gutterWidth(avatar);
    const editorLines = baseRender.call(this, width - gutter);
    if (editorLines.length === 0) return editorLines;
    const layout = layoutBesideEditor(avatar, editorLines);
    activeGutter = gutter;
    activeLeft = layout.editorLeft;
    activeTop = layout.editorTop;
    return layout.lines;
  };

  if (baseMouse) {
    container.handleMouse = function (this: ContainerLike, event) {
      if (activeGutter === 0 || event.x === undefined) return baseMouse.call(this, event);
      if (event.x < activeLeft || event.y < activeTop) return undefined;
      return baseMouse.call(this, {
        ...event,
        x: event.x - activeLeft,
        y: event.y - activeTop,
        width: event.width - activeGutter,
        height: event.height - activeTop,
      });
    };
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    if (ownRender) container.render = ownRender;
    else delete (container as Partial<ContainerLike>).render;
    if (baseMouse) {
      if (ownMouse) container.handleMouse = ownMouse;
      else delete container.handleMouse;
    }
  };
}
