import type { TUI } from "@earendil-works/pi-tui";
import type { EmoteState, Config, EmotesConfig } from "./types.ts";
import type { Renderer, RenderedFrame } from "./renderer.ts";
import { log } from "./log.ts";

// --- Helpers ---

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// --- Animator ---

export class Animator {
  // State machine
  currentState: EmoteState = "idle";

  // Renderer
  private renderer: Renderer;
  private config: Config;
  private emotesConfig: EmotesConfig = {};

  // Timers
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private blinkTimer: ReturnType<typeof setTimeout> | null = null;
  private talkTimer: ReturnType<typeof setInterval> | null = null;
  private cycleTimer: ReturnType<typeof setInterval> | null = null;
  private thinkTimer: ReturnType<typeof setTimeout> | null = null;
  private talkGapTimer: ReturnType<typeof setTimeout> | null = null;
  private talkDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private grandmaTimer: ReturnType<typeof setTimeout> | null = null;

  // Cycle state
  private cycleIndex = 0;
  private cycleDirection = 1;

  // Hold state
  private holdNextState: EmoteState = "idle";
  private afterTalkState: EmoteState = "idle";
  private stopped = false;
  private idleVariant: EmoteState | null = null;

  // Talk state
  private talkWordCount = 0;
  private talkStartTime = 0;
  private lastTokenTime = 0;
  private talkMouthClosed = false;

  constructor(config: Config, renderer: Renderer) {
    this.config = config;
    this.renderer = renderer;
  }

  updateConfig(config: Config) {
    this.config = config;
  }

  setRenderer(renderer: Renderer) {
    this.renderer = renderer;
  }

  setTui(tui: TUI | null) {
    this.renderer.setTui(tui);
  }

  setEmotesConfig(emotesConfig: EmotesConfig) {
    this.emotesConfig = emotesConfig;
  }

  setHoldNextState(state: EmoteState) {
    this.holdNextState = state;
  }

  /** State to play once the current talk animation finishes (then back to idle). */
  setAfterTalkState(state: EmoteState) {
    this.afterTalkState = state;
  }

  private finishTalk() {
    const next = this.afterTalkState;
    this.afterTalkState = "idle";
    this.transitionTo(next);
  }

  /** Get current rendered frame for the widget. */
  getRenderedFrame(): RenderedFrame | null {
    return this.renderer.getRenderedFrame();
  }

  resetRenderCache() {
    this.renderer.resetCache();
  }

  disposeRenderer() {
    this.renderer.dispose();
  }

  // --- Timer management ---

  /** Session ended: cancel everything and keep in-flight blink callbacks from rescheduling. */
  stop() {
    this.stopped = true;
    this.clearAllTimers();
  }

  clearAllTimers() {
    if (this.holdTimer) { clearTimeout(this.holdTimer); this.holdTimer = null; }
    if (this.blinkTimer) { clearTimeout(this.blinkTimer); this.blinkTimer = null; }
    if (this.talkTimer) { clearInterval(this.talkTimer); this.talkTimer = null; }
    if (this.cycleTimer) { clearInterval(this.cycleTimer); this.cycleTimer = null; }
    if (this.talkGapTimer) { clearTimeout(this.talkGapTimer); this.talkGapTimer = null; }
    if (this.talkDurationTimer) { clearTimeout(this.talkDurationTimer); this.talkDurationTimer = null; }
    if (this.thinkTimer) { clearTimeout(this.thinkTimer); this.thinkTimer = null; }
    if (this.grandmaTimer) { clearTimeout(this.grandmaTimer); this.grandmaTimer = null; }
  }

  private clearStateTimers() {
    if (this.grandmaTimer) { clearTimeout(this.grandmaTimer); this.grandmaTimer = null; }
    if (this.holdTimer) { clearTimeout(this.holdTimer); this.holdTimer = null; }
    if (this.talkTimer) { clearInterval(this.talkTimer); this.talkTimer = null; }
    if (this.cycleTimer) { clearInterval(this.cycleTimer); this.cycleTimer = null; }
    if (this.talkGapTimer) { clearTimeout(this.talkGapTimer); this.talkGapTimer = null; }
    if (this.talkDurationTimer) { clearTimeout(this.talkDurationTimer); this.talkDurationTimer = null; }
    if (this.thinkTimer) { clearTimeout(this.thinkTimer); this.thinkTimer = null; }
  }

  // --- State transitions ---

  transitionTo(state: EmoteState) {
    this.stopped = false;
    this.clearStateTimers();
    if (this.currentState === "idle" && this.blinkTimer) {
      clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }
    this.currentState = state;

    switch (state) {
      case "hi": this.enterHi(); break;
      case "idle": this.enterIdle(); break;
      case "think": this.enterThink(); break;
      case "talk": this.enterTalk(); break;
      case "read":
      case "write":
      case "tool":
      case "ask": this.enterCycle(state); break;
      case "success": this.enterHold(state, this.config.holdDuration.success, this.holdNextState); this.holdNextState = "idle"; break;
      case "failure": this.enterHold(state, this.config.holdDuration.failure, this.holdNextState); this.holdNextState = "idle"; break;
      case "compact":
      case "delegate":
      case "jobs":
      case "remember":
      case "yolo": this.enterCycle(state); break;
      case "grandma": this.enterSequence(state); break;
      case "bye": this.enterSequence(state); break;
    }
  }

  private enterHi() {
    this.enterCycle("hi");
    this.holdTimer = setTimeout(() => this.transitionTo("idle"), this.config.holdDuration.hi);
  }

  /**
   * A state whose frames replace idle while it holds (YOLO mode keeps the
   * sunglasses on while resting). Its files are `<state>.png` and `<state>_blink.png`.
   */
  setIdleVariant(state: EmoteState | null) {
    if (state === this.idleVariant) return;
    this.idleVariant = state;
    if (this.currentState === "idle") this.transitionTo("idle");
  }

  private idleFrames(): { state: EmoteState; rest: string; blink: string } {
    const variant = this.idleVariant;
    if (variant && this.renderer.getFrameFiles(variant).includes(`${variant}.png`)) {
      return { state: variant, rest: `${variant}.png`, blink: `${variant}_blink.png` };
    }
    return {
      state: "idle",
      rest: this.emotesConfig.idle?.default ?? "idle.png",
      blink: this.emotesConfig.idle?.blink ?? "idle_blink.png",
    };
  }

  enterIdle() {
    const frames = this.idleFrames();
    this.renderer.showFrame(frames.state, frames.rest);
    this.scheduleBlink();
    this.scheduleGrandma();
  }

  /** User activity while idle postpones the grandma transformation. */
  touch() {
    if (this.currentState === "idle") this.scheduleGrandma();
  }

  private scheduleGrandma() {
    if (this.grandmaTimer) { clearTimeout(this.grandmaTimer); this.grandmaTimer = null; }
    if (this.stopped || this.config.grandmaAfterMs <= 0 || this.renderer.getFrameFiles("grandma").length === 0) return;
    this.grandmaTimer = setTimeout(() => {
      this.grandmaTimer = null;
      if (this.currentState === "idle") this.transitionTo("grandma");
    }, this.config.grandmaAfterMs);
  }

  private scheduleBlink() {
    if (this.blinkTimer) { clearTimeout(this.blinkTimer); this.blinkTimer = null; }
    if (this.stopped) return;
    const delay = randomInRange(this.config.blinkInterval[0], this.config.blinkInterval[1]);
    this.blinkTimer = setTimeout(() => {
      if (this.currentState !== "idle") return;
      this.doBlink();
    }, delay);
  }

  private doBlink() {
    const { state, rest: defaultFile, blink: blinkFile } = this.idleFrames();
    if (!this.renderer.showFrame(state, blinkFile)) {
      this.scheduleBlink();
      return;
    }

    const doubleBlink = Math.random() < 0.15;
    const blinkDuration = 150;

    setTimeout(() => {
      if (this.currentState !== "idle") return;
      this.renderer.showFrame(state, defaultFile, true);

      if (doubleBlink) {
        setTimeout(() => {
          if (this.currentState !== "idle") return;
          this.renderer.showFrame(state, blinkFile, true);
          setTimeout(() => {
            if (this.currentState !== "idle") return;
            this.renderer.showFrame(state, defaultFile, true);
            this.scheduleBlink();
          }, blinkDuration);
        }, 100);
      } else {
        this.scheduleBlink();
      }
    }, blinkDuration);
  }

  private enterThink() {
    const defaultFile = this.emotesConfig.think?.default ?? "think.png";
    this.renderer.showFrame("think", defaultFile);
    this.scheduleThinkSwap();
  }

  private scheduleThinkSwap() {
    if (this.thinkTimer) { clearTimeout(this.thinkTimer); this.thinkTimer = null; }
    if (this.stopped) return;
    const delay = randomInRange(this.config.blinkInterval[0], this.config.blinkInterval[1]);
    this.thinkTimer = setTimeout(() => {
      if (this.currentState !== "think") return;
      this.doThinkSwap();
    }, delay);
  }

  private doThinkSwap() {
    const hardFile = this.emotesConfig.think?.hard ?? "think_hard.png";
    if (!this.renderer.showFrame("think", hardFile, true)) {
      this.scheduleThinkSwap();
      return;
    }

    const defaultFile = this.emotesConfig.think?.default ?? "think.png";
    setTimeout(() => {
      if (this.currentState !== "think") return;
      this.renderer.showFrame("think", defaultFile, true);
      this.scheduleThinkSwap();
    }, 800);
  }

  private enterTalk() {
    this.talkWordCount = 0;
    this.talkStartTime = Date.now();
    this.lastTokenTime = Date.now();
    this.talkMouthClosed = false;

    this.renderer.showTalkFrame(this.emotesConfig);

    this.talkTimer = setInterval(() => {
      if (this.currentState !== "talk") return;
      if (this.talkMouthClosed) {
        this.renderer.showTalkCloseFrame();
      } else {
        this.renderer.showTalkFrame(this.emotesConfig);
      }
    }, this.config.talkTickMs);
  }

  onTalkToken(text: string) {
    if (this.currentState !== "talk") return;

    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    this.talkWordCount += words;
    this.lastTokenTime = Date.now();

    if (this.talkMouthClosed) {
      this.talkMouthClosed = false;
    }

    if (this.talkGapTimer) { clearTimeout(this.talkGapTimer); this.talkGapTimer = null; }
    this.talkGapTimer = setTimeout(() => {
      if (this.currentState !== "talk") return;
      this.talkMouthClosed = true;
    }, 200);

    this.recalculateTalkDuration();
  }

  private recalculateTalkDuration() {
    if (this.talkDurationTimer) { clearTimeout(this.talkDurationTimer); this.talkDurationTimer = null; }

    const targetDurationMs = (this.talkWordCount / this.config.readingSpeed) * 1000;
    const elapsed = Date.now() - this.talkStartTime;
    const remaining = Math.max(0, targetDurationMs - elapsed);

    this.talkDurationTimer = setTimeout(() => {
      if (this.currentState !== "talk") return;
      const timeSinceLastToken = Date.now() - this.lastTokenTime;
      if (timeSinceLastToken > 200) {
        this.finishTalk();
      } else {
        this.talkDurationTimer = setTimeout(() => {
          if (this.currentState === "talk") this.finishTalk();
        }, 200);
      }
    }, remaining);
  }

  endTalk() {
    if (this.currentState !== "talk") return;
    const targetDurationMs = (this.talkWordCount / this.config.readingSpeed) * 1000;
    const elapsed = Date.now() - this.talkStartTime;
    if (elapsed >= targetDurationMs) {
      this.finishTalk();
    } else {
      // Streaming finished but reading time remains — keep mouth animating
      if (this.talkGapTimer) { clearTimeout(this.talkGapTimer); this.talkGapTimer = null; }
      this.talkMouthClosed = false;
    }
  }

  private frameMs(state: EmoteState): number {
    return this.emotesConfig.frameMs?.[state] ?? this.config.cycleMs;
  }

  private enterCycle(state: EmoteState) {
    this.cycleIndex = 0;
    this.cycleDirection = 1;
    this.renderer.showCycleFrame(state, 0);

    const count = this.renderer.getCycleFrameCount(state);
    if (count <= 1) return;

    const loop = this.emotesConfig.cycle?.[state] === "loop";
    this.cycleTimer = setInterval(() => {
      if (this.currentState !== state) return;
      if (loop) {
        this.cycleIndex = (this.cycleIndex + 1) % count;
      } else {
        this.cycleIndex += this.cycleDirection;
        if (this.cycleIndex >= count - 1) this.cycleDirection = -1;
        if (this.cycleIndex <= 0) this.cycleDirection = 1;
      }
      this.renderer.showCycleFrame(state, this.cycleIndex);
    }, this.frameMs(state));
  }

  /** Plays `in_*` frames once, then loops the remaining frames forward. */
  private enterSequence(state: EmoteState) {
    const files = this.renderer.getFrameFiles(state);
    const intro = files.filter((f) => f.startsWith("in_"));
    const loop = files.filter((f) => !f.startsWith("in_"));
    const ordered = [...intro, ...loop];
    if (ordered.length === 0) return;

    let index = 0;
    this.renderer.showFrame(state, ordered[0]!);
    if (ordered.length === 1) return;

    this.cycleTimer = setInterval(() => {
      if (this.currentState !== state) return;
      index++;
      if (index >= ordered.length) index = loop.length > 0 ? intro.length : ordered.length - 1;
      this.renderer.showFrame(state, ordered[index]!);
    }, this.frameMs(state));
  }

  private enterHold(state: EmoteState, duration: number, nextState: EmoteState = "idle") {
    this.enterCycle(state);
    this.holdTimer = setTimeout(() => this.transitionTo(nextState), duration);
  }
}
