import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { AccentSetting, FrameTransform } from "./types.ts";
import { decodePng, encodePng } from "./png.ts";

export type Rgb = [number, number, number];

/** Mirrors the `rose` entry of Gentle Shell's startup banner palettes. */
export const BANNER_ACCENTS: Record<string, Rgb> = {
  pink: [255, 118, 195],
  cyan: [95, 210, 255],
  yellow: [255, 210, 95],
  green: [110, 220, 145],
};

const DEFAULT_ACCENT: Rgb = BANNER_ACCENTS.pink!;

/**
 * Sprites paint accent areas with these exact key colors; they are swapped
 * for shades of the live accent when frames load.
 */
export const ACCENT_KEYS = {
  base: [255, 0, 255] as Rgb,
  shade: [170, 0, 170] as Rgb,
  light: [255, 128, 255] as Rgb,
};

/**
 * Candidate folders for Gentle Shell's `banner.json`, in Gentle Shell's own
 * precedence (explicit env, launcher marker, standalone home, ~/.pi default).
 */
export function bannerConfigCandidates(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  const dirs: string[] = [];
  const add = (dir: string | undefined) => {
    if (dir && !dirs.includes(dir)) dirs.push(dir);
  };
  add(env.GENTLE_PI_CONFIG_HOME);
  add(env.GENTLE_SHELL_CONFIG_HOME);
  if (env.PI_CODING_AGENT_DIR) {
    add(join(dirname(env.PI_CODING_AGENT_DIR), "gentle-ai"));
    add(join(env.PI_CODING_AGENT_DIR, "gentle-ai"));
  }
  add(join(home, ".gentle-shell", "gentle-ai"));
  add(join(home, ".pi", "gentle-ai"));
  return dirs.map((dir) => join(dir, "banner.json"));
}

function parseHex(value: string): Rgb | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return null;
  const n = Number.parseInt(match[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function resolveAccent(setting: AccentSetting, candidates = bannerConfigCandidates()): Rgb {
  if (setting !== "auto") {
    return BANNER_ACCENTS[setting] ?? parseHex(setting) ?? DEFAULT_ACCENT;
  }
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const color = JSON.parse(readFileSync(path, "utf-8"))?.color;
      if (typeof color === "string" && BANNER_ACCENTS[color]) return BANNER_ACCENTS[color]!;
    } catch {
      // A malformed banner file falls through to the next candidate.
    }
  }
  return DEFAULT_ACCENT;
}

const scale = (c: Rgb, f: number): Rgb => c.map((v) => Math.round(v * f)) as Rgb;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => Math.round(v + (b[i]! - v) * t)) as Rgb;

export function accentShades(accent: Rgb): { base: Rgb; shade: Rgb; light: Rgb } {
  return { base: accent, shade: scale(accent, 0.62), light: mix(accent, [255, 255, 255], 0.45) };
}

export function createAccentTransform(accent: Rgb): FrameTransform {
  const shades = accentShades(accent);
  const swaps: Array<[Rgb, Rgb]> = [
    [ACCENT_KEYS.base, shades.base],
    [ACCENT_KEYS.shade, shades.shade],
    [ACCENT_KEYS.light, shades.light],
  ];
  return (base64) => {
    let image;
    try {
      image = decodePng(Buffer.from(base64, "base64"));
    } catch {
      return base64;
    }
    const { data } = image;
    let changed = false;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      for (const [key, to] of swaps) {
        if (data[i] === key[0] && data[i + 1] === key[1] && data[i + 2] === key[2]) {
          data[i] = to[0];
          data[i + 1] = to[1];
          data[i + 2] = to[2];
          changed = true;
          break;
        }
      }
    }
    return changed ? encodePng(image).toString("base64") : base64;
  };
}
