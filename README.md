# gentle-emote

A pixel-art **Gentleman** that sits in a frame to the left of your prompt and acts out what the agent is doing: thinking, talking, reading, writing, delegating to subagents, watching background jobs, saving memories, going YOLO…

Works in [Gentle Shell](https://github.com/Gentleman-Programming/gentle-shell) and [Pi](https://pi.dev). Forked from [cgxeiji/pi-emote](https://github.com/cgxeiji/pi-emote). Want a different character? [Create your own avatar](#create-your-own-avatar).

See every state in the [gallery](https://github.com/efolchmontiel/gentle-emote/blob/main/docs/gallery.md), or preview them live with `/emote demo`.

## Install

```bash
# Gentle Shell
gentle-shell install npm:gentle-emote

# Pi
pi install npm:gentle-emote
```

Restart the session (or `/reload`) and the Gentleman says hi.

## Does it use tokens?

**No.** gentle-emote only listens to local session events (agent start/end, message streaming, tool calls). It never calls a model, never adds anything to the context, and makes no network requests. Rendering happens entirely in your terminal.

## Commands

| Command | What it does |
|---------|--------------|
| `/emote` | Lists every state |
| `/emote <state>` | Previews one state for a few seconds (tab-completes), e.g. `/emote delegate` |
| `/emote demo` | Plays every state in sequence |
| `/emote idle` | Stops a preview and goes back to rest |

Any new prompt cancels a preview, so the avatar always follows the real agent.

## What he does and when

| State | Situation | How it is detected | Animation |
|-------|-----------|--------------------|-----------|
| `hi` | Session starts | `session_start` | Waves hello |
| `idle` | Waiting for input | No activity | Rests and blinks |
| `think` | Model is reasoning | Thinking tokens streaming | Hand on chin, eyes up, thought bubble |
| `talk` | Model is answering | Text streaming; stops half a second after the text ends | Live on stream: headphones, podcast mic, an ON AIR sign that lights up while he speaks |
| `read` | Reading code or memory | `read`, `grep`, `find`, `ls`, `glob`, `mem_search`, `codegraph_explore`, `web_fetch`… | Sweeps a huge magnifying glass |
| `write` | Editing code | `write`, `edit`, `multi_edit`, `apply_patch` | Cooks code in a frying pan |
| `tool` | Running other tools | Any other tool, e.g. `bash` | Whips the "IA" robot |
| `ask` | Agent needs your answer | `ask_user_question`, `ask_user_choice` | Raised palm with a Y/N bubble |
| `success` | Agent finished fine | A run that used tools ends with no tool errors | Chef's kiss |
| `failure` | Something failed | Tool result with error | The robot blows up in his face |
| `compact` | Context compaction | `session_before_compact` | Squashes a pile of papers |
| **`delegate`** | **Subagents** (generic) | `subagent_run`, `subagent_continue`, `subagent_reply` for an agent not listed below | Directs three mini "IA" robots with a megaphone |
| **`explore`** | Exploring subagent | `subagent_run` with an agent matching `explore` (`gentle-ai-explore`) | Pith helmet and binoculars, a treasure map gets its X |
| **`build`** | Implementing / fixing subagent | Agent matching `worker`, `fix` or `apply` (`gentle-ai-worker`, `jd-fix-agent`) | Hard hat, fixing the "IA" robot with a wrench |
| **`verify`** | Verifying subagent | Agent matching `verify` or `validator` (`gentle-ai-verify`, `review-validator`) | Ticks a checklist on a clipboard |
| **`judge`** | Judging subagent | Agent matching `judge` or `refuter` (`jd-judge-a`, `jd-judge-b`, `review-refuter`) | Powdered wig and a gavel strike |
| **`review`** | Reviewing subagent | Agent starting with `review-` (`review-readability`, `review-reliability`, `review-resilience`, `review-risk`) | Red pen in hand while the robot rotates the signs: magnifier, test tube, shield, warning |
| **`jira`** | Jira subagent | Agent matching `jira` (`jira-comment`) | Writes a comment on a ticket card |
| **`jobs`** | **Background jobs** | `bash_background`, `monitor`, `job_list`, `job_stop` | Sips mate while watching a progress bar, with a kitchen timer beside him |
| **`yolo`** | **YOLO mode** | Reads Gentle Shell's YOLO state (read-only, never changes it) | Sunglasses and a "YOLO" headband in every scene, switched the moment YOLO turns on or off; at rest he adds a rocket |
| **`remember`** | **Saves a memory in Engram** (optional) | `mem_save` | Writes in a notebook and taps his temple |
| `grandma` | Long idle | No activity or keystrokes for `grandmaAfterMs` (30 s) | Turns into a knitting grandma |
| `bye` | You say goodbye | A prompt matching `farewellPattern` (`chau`, `bye`, `nos vemos`…) | Tips his hat |

The subagent scene comes from the `agent` argument of the tool call, so new agents that follow the same naming get the right scene for free. A call without an agent name (for example, continuing a task by id) shows `delegate`.

The subagent scenes, `jobs`, `yolo` and `remember` need the matching Gentle Shell tools or the Engram extension. Without them those states are simply never triggered. In plain Pi the rest works the same.

The rose on his chest follows your accent color (Gentle Shell's `/gentle:customize`), and so does the YOLO headband.

## Config

Drop a `config.json` with only the keys you want to change in either place (the later one wins):

- `<agent dir>/extensions/gentle-emote/config.json`: global. The agent dir is `PI_CODING_AGENT_DIR`, or `~/.pi/agent` by default.
- `.pi/extensions/gentle-emote/config.json`: per project.

```json
{
  "frameRows": 5,
  "grandmaAfterMs": 120000
}
```

| Key | Default | Meaning |
|-----|---------|---------|
| `enabled` | `true` | Turns the avatar on or off |
| `placement` | `"beside-editor"` | Where the avatar sits: `"beside-editor"` or `"above-editor"` |
| `frame` | `true` | Draws a rounded frame around the avatar |
| `frameRows` | `4` | Avatar height in terminal rows. The prompt grows to match it |
| `minEditorWidth` | `40` | Below this prompt width the avatar hides to leave room for typing |
| `grandmaAfterMs` | `30000` | Idle time before the grandma appears (any key resets it). Use `0` to disable it |
| `farewellPattern` | Spanish and English goodbyes | Regex (case-insensitive) that triggers `bye` |
| `accent` | `"auto"` | Rose and headband color: `"auto"` follows `/gentle:customize`; or `"pink"`, `"cyan"`, `"yellow"`, `"green"`, or a hex like `"#ff6ec7"` |
| `readingSpeed` | `4` | Words per second used to pace the `/emote talk` preview |
| `holdDuration` | see `config.json` | How long `hi`, `success`, `failure` and `bye` stay on screen (ms) |
| `emotes` | `gentleman` | Emote set per model or thinking level (see below) |
| `terminals` | see `config.json` | Renderer per terminal (see below) |

See `config.json` in the package root for every default.

## Create your own avatar

The Gentleman is just the default set. You can swap in your own character (your face, your team's mascot, a cat) without touching the extension.

### 1. Make the frames

Create a folder named after your set with one subfolder of PNG frames per state:

```
my-avatar/
├── emotes.json            # optional: timing and special frames
├── idle/idle.png          # resting pose (required)
├── idle/idle_blink.png    # optional blink
├── think/think.png
├── talk/talk_close.png    # talk_small.png, talk_mid.png, talk_wide.png
├── hi/hi_01.png           # animated states: frames play in filename order
├── hi/hi_02.png
└── ...                    # any state from the table above
```

- **Required:** only `idle`. A missing state just doesn't animate, so you can start small and add scenes later.
- **Size:** any size works, because the image is scaled to fit the frame. Small pixel art such as 48×40 keeps it crisp.
- **Frame order:** frames play in alphabetical order, so zero-pad the names (`_01`, `_02`…).
- **Transparency:** use a transparent background; the frame and the terminal show through.
- **Accent color:** pixels painted exactly `#ff00ff` (base), `#aa00aa` (shade) or `#ff80ff` (light) follow the accent color, like the Gentleman's rose.

### 2. Tune the timing (optional)

`emotes.json` sets how each state plays. Copy `emotes/gentleman/emotes.json` as a starting point:

```json
{
  "idle": { "default": "idle.png", "blink": "idle_blink.png" },
  "talk": { "weights": { "talk_close.png": 1, "talk_small.png": 3, "talk_mid.png": 3, "talk_wide.png": 1 } },
  "cycle": { "hi": "loop", "read": "pingpong" },
  "frameMs": { "hi": 300, "read": 450 }
}
```

`cycle` is `"loop"` (1-2-3-1-2-3) or `"pingpong"` (1-2-3-2-1). `frameMs` is the time per frame in milliseconds.

### 3. Install it and select it

Put the folder in one of these places:

- `<agent dir>/extensions/gentle-emote/emotes/my-avatar/`: for you, in every project.
- `.pi/extensions/gentle-emote/emotes/my-avatar/`: only for that project, so you can commit it for your team.

Then select it in your `config.json`:

```json
{
  "emotes": [{ "model": "*", "emote-set": "my-avatar" }]
}
```

Run `/reload` and `/emote demo` to check every state.

### Different avatars per model

Entries are glob patterns against the model ID and/or thinking level. The last match wins:

```json
{
  "emotes": [
    { "model": "*", "emote-set": "gentleman" },
    { "model": "*haiku*", "emote-set": "my-avatar" },
    { "thinking-level": "high", "emote-set": "focused-avatar" }
  ]
}
```

### A YOLO look for your avatar

Ship a twin set named `<your-set>-yolo` (for example `my-avatar-yolo/`) next to it. While Gentle Shell's YOLO mode is on, every frame comes from the twin instead; states missing there simply don't animate, so copy the whole set. Without a twin, your avatar just keeps its normal look.

### Text-only avatars

For terminals without images, a set can be plain text: add an `ascii.yaml` instead of PNGs. See `emotes/ascii/ascii.yaml` for the format.

### Drawing with code

The Gentleman is not hand-drawn: `scripts/sprites/` generates every frame from code, and `npm run sprites` rebuilds it. To build your character the same way, clone the repo, copy `scripts/sprites/`, change the shapes and colors, and point the output to your set's folder.

## Terminals

| Terminal | Renderer | Status |
|----------|----------|--------|
| Ghostty, kitty, WarpTerminal | kitty Unicode placeholders | ✅ Crisp image in a frame |
| tmux (inside Ghostty or kitty) | kitty Unicode placeholders | ✅ Needs `set -g allow-passthrough on` |
| iTerm2, WezTerm | iTerm2 images | ⚠️ Works, less tested |
| Zellij, screen, others | ASCII | Fallback only |

For tmux, add this to `tmux.conf` and restart the tmux server:

```bash
set -g allow-passthrough on
set -ga update-environment TERM
set -ga update-environment TERM_PROGRAM
set -sg escape-time 0
```

Force a renderer with `terminals`:

```json
{ "terminals": [{ "match": "tmux", "render": "kitty-unicode" }] }
```

Valid `render` values: `"auto"`, `"kitty-unicode"`, `"kitty"`, `"iterm2"`, `"ascii"`.

## Limitations

- Placing the avatar beside the prompt relies on Pi's internal layout. If a future version changes it, the avatar falls back to sitting above the editor.
- YOLO detection uses Gentle Shell's internal YOLO channel. It only reads and observes the state and never toggles it. In other hosts the `yolo` look never shows.
- The `bye` animation plays when you say goodbye, not when the process quits: a quit clears the screen right away.
- Zellij has no image passthrough, so it gets the ASCII fallback.

## Credits

Built on [pi-emote](https://github.com/cgxeiji/pi-emote) by Eiji Onchi ([@cgxeiji](https://github.com/cgxeiji)): the animator, renderers and terminal detection come from there. The Gentleman avatar, the framed layout beside the prompt and the Gentle Shell scenes were added in this fork.

## License

MIT. See [LICENSE](LICENSE).
