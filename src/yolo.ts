import type { EmoteState } from "./types.ts";

/**
 * Rest pose for Gentle Shell's permission mode.
 * `read()` reports ON for both YOLO and Super YOLO; the mode picks the picture.
 * Rocket when YOLO is on. Sun when the mode is super-yolo. Nothing otherwise.
 */
export function yoloRestVariant(display: unknown, mode: unknown): EmoteState | null {
  if (display !== "ON") return null;
  return mode === "super-yolo" ? "super-yolo" : "yolo";
}

interface YoloSnapshot {
  yolo?: unknown;
  mode?: unknown;
}

/** Prefer the host snapshot so the flag and the mode come from one read. */
export async function readYoloRest(reader: {
  read: () => Promise<unknown>;
  readMode?: () => Promise<unknown>;
  readSnapshot?: () => Promise<unknown>;
}): Promise<EmoteState | null> {
  if (typeof reader.readSnapshot === "function") {
    try {
      const snapshot = await reader.readSnapshot();
      if (snapshot && typeof snapshot === "object" && "yolo" in snapshot) {
        const value = snapshot as YoloSnapshot;
        return yoloRestVariant(value.yolo, value.mode);
      }
    } catch { /* fall through to the separate reads */ }
  }
  const mode = typeof reader.readMode === "function" ? await reader.readMode() : undefined;
  return yoloRestVariant(await reader.read(), mode);
}
