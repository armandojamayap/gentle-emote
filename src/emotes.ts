import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { EMOTE_STATES } from "./types.ts";
import type { EmoteState, EmoteMapping, EmotesConfig, FrameSet, FrameTransform } from "./types.ts";

export const EXTENSION_NAME = "gentle-emote";

/** Pi's agent folder: PI_CODING_AGENT_DIR (Gentle Shell homes, gs-lab) or ~/.pi/agent. */
export function agentDir(): string {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return process.env.PI_CODING_AGENT_DIR || join(homeDir, ".pi", "agent");
}

// --- Glob Matching ---

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

export function resolveEmoteSet(modelId: string, thinkingLevel: string, emotes: EmoteMapping[]): string {
  let matched: string | null = null;
  let modelMatchCount = 0;
  let thinkingMatchCount = 0;

  for (const entry of emotes) {
    const modelPattern = entry.model ?? "*";
    const thinkingPattern = entry["thinking-level"] ?? "*";
    if (globToRegex(modelPattern).test(modelId) && globToRegex(thinkingPattern).test(thinkingLevel)) {
      if (modelPattern !== "*") modelMatchCount++;
      if (thinkingPattern !== "*") thinkingMatchCount++;
      matched = entry["emote-set"];
    }
  }

  if (modelMatchCount > 1) {
    console.error(`[${EXTENSION_NAME}] Warning: multiple model patterns matched model "${modelId}", using last match.`);
  }
  if (thinkingMatchCount > 1) {
    console.error(`[${EXTENSION_NAME}] Warning: multiple thinking-level patterns matched "${thinkingLevel}", using last match.`);
  }

  return matched ?? "default";
}

// --- Emote Set Location ---

export function findEmoteSetDir(setName: string, extDir: string, cwd: string): string {
  // Priority: project → user → extension → fallback to default
  const projectDir = join(cwd, ".pi", "extensions", EXTENSION_NAME, "emotes", setName);
  if (existsSync(projectDir)) return projectDir;

  const userDir = join(agentDir(), "extensions", EXTENSION_NAME, "emotes", setName);
  if (existsSync(userDir)) return userDir;

  const extSetDir = join(extDir, "emotes", setName);
  if (existsSync(extSetDir)) return extSetDir;

  // Fallback to default
  const defaultDir = join(extDir, "emotes", "default");
  if (existsSync(defaultDir)) return defaultDir;

  return join(extDir, "emotes", "default");
}

// --- Frame Loading ---

export function loadEmotesConfig(emoteSetDir: string): EmotesConfig {
  const configPath = join(emoteSetDir, "emotes.json");
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

export function discoverFrames(emoteSetDir: string, transform?: FrameTransform): Map<EmoteState, FrameSet> {
  const frameMap = new Map<EmoteState, FrameSet>();

  for (const state of EMOTE_STATES) {
    const stateDir = join(emoteSetDir, state);
    if (!existsSync(stateDir)) continue;

    const files = readdirSync(stateDir).filter((f) => f.endsWith(".png")).sort();
    const base64Cache = new Map<string, string>();

    for (const file of files) {
      const data = readFileSync(join(stateDir, file)).toString("base64");
      base64Cache.set(file, transform ? transform(data) : data);
    }

    frameMap.set(state, { files, base64Cache });
  }

  return frameMap;
}
