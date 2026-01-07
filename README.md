# CardRefinery

## Your Waifu Is Trash. Let's Fix That.

**That character card you're so proud of? It sucks.** I don't care how long you spent on it. I don't care that "it works fine for me." You're here because deep down, you know something's wrong.

CardRefinery is the intervention your characters need.

---

## How It Works

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   SCORE     │ ───▶ │   REWRITE   │ ───▶ │   ANALYZE   │
│  Tear apart │      │   Rebuild   │      │ Soul check  │
└─────────────┘      └─────────────┘      └─────────────┘
       ▲                                        │
       │        STILL NOT GOOD ENOUGH?          │
       └────────────────────────────────────────┘
```

1. **SCORE** — An AI tears your card apart. Field by field. No mercy.
2. **REWRITE** — That same AI fixes what you couldn't fix yourself.
3. **ANALYZE** — Checks if we accidentally lobotomized your character. "Better" doesn't mean shit if it's not _them_ anymore.

Then you iterate until it's actually good.

---

## The Full Loop

```
                                ┌──────────────────┐
                                │  Pick a victim   │
                                └────────┬─────────┘
                                         │
                                         ▼
                           ┌──────────────────────────┐
                           │         SCORE            │
                           │   "Tell me what's wrong" │
                           └────────────┬─────────────┘
                                        │
                             ┌──────────▼──────────┐
                             │       REWRITE       │
                             │    "Fix it then"    │
                             └──────────┬──────────┘
                                        │
                             ┌──────────▼──────────┐
                             │       ANALYZE       │
                             │  "Did we break it?" │
                             └──────────┬──────────┘
                                        │
                  ┌─────────────────────┼─────────────────────┐
                  ▼                     ▼                     ▼
             ┌─────────┐           ┌─────────┐           ┌─────────┐
             │ ACCEPT  │           │  NEEDS  │           │REGRESSION│
             │   Done  │           │ REFINE  │           │  Revert  │
             └─────────┘           └────┬────┘           └────┬────┘
                                        │                     │
                          Add guidance: │                     │
                          "Keep the sass"◄────────────────────┘
                          "Don't soften her"
                                        │
                                        └──────────▶ REWRITE (again)
```

Each stage knows what came before. We always compare against your **original** card, not the previous rewrite—no character drift.

---

## Features

### Field-Level Control

Select what you want to process. Only care about dialogue? Just pick first message + examples. Not going to waste your tokens on shit you don't care about.

- Description, Personality, Scenario
- First Message, Example Messages
- System Prompt, Post-History Instructions
- Creator Notes, Tags
- Alternate Greetings (individually)

### Structured Output (JSON Schema)

Force the AI to respond in a specific format. Scores become visual bars. Verdicts get color coding.

**Don't know JSON Schema?** Click Generate, describe what you want in plain English, done.

```
You type: "rating 1-10 for each field, list of critical issues,
          overall vibe (shit/mid/decent/good/excellent)"

AI generates: A working JSON schema. Click save.
```

### 8 Built-in Presets

| Preset                   | What It Does                      |
| ------------------------ | --------------------------------- |
| **Default Score**        | Full roast, every field           |
| **Quick Score**          | Fast vibes check                  |
| **Default Rewrite**      | Balanced improvements             |
| **Conservative Rewrite** | Surgical precision                |
| **Expansive Rewrite**    | ADD DEPTH. ADD SOUL.              |
| **Default Analyze**      | Full soul check                   |
| **Iteration Analyze**    | Tracks progress across iterations |
| **Quick Analyze**        | Fast verdict                      |

Make your own. Save them. Import/export them.

### Session Management

- **Auto-save** — Close the popup, come back next week, everything's there
- **Multiple sessions** — Different approaches for the same character
- **Full history** — Every iteration recoverable
- **IndexedDB** — Your SillyTavern settings don't get bloated

### Export

- **Apply to Card** — Write directly to your character
- **Download PNG** — Card image with embedded data
- **Download JSON** — Raw data backup

### Compare View

Side-by-side original vs. rewritten. See exactly what changed.

### Real-Time Token Counting

See exactly how big your prompt is before you hit run.

---

## Installation

### From SillyTavern

1. Extensions panel (stacked cubes icon)
2. **Install Extension**
3. Paste: `https://github.com/Inktomi93/SillyTavern-CardRefinery`
4. **Install** → Refresh browser
5. Find **CardRefinery** in Extensions panel

### Manual

```bash
cd SillyTavern/data/<your-user>/extensions/third-party/
git clone https://github.com/Inktomi93/SillyTavern-CardRefinery
```

Restart SillyTavern.

---

## Quick Start

1. **Open** — Extensions panel → CardRefinery → Open
2. **Pick character** — Search, click, face reality
3. **Select fields** — Populated fields selected by default
4. **Run** — Current stage, all stages, or iterate

| Button      | What It Does                             |
| ----------- | ---------------------------------------- |
| **Run**     | Execute current stage                    |
| **All**     | Full pipeline: Score → Rewrite → Analyze |
| **Iterate** | Rewrite → Analyze with guidance          |
| **Stop**    | Cancel generation                        |
| **Reset**   | Nuke everything, start fresh             |

---

## Compatibility

**Works:** OpenRouter, OpenAI, Anthropic, Google AI Studio, Mistral, Groq, together.ai, any OpenAI-compatible endpoint.

**Probably Works:** Most things SillyTavern supports.

**Unknown:** Text Completion APIs (untested).

---

## Tips

- **Use a smart model.** Dumb models give dumb feedback.
- **Don't skip Analyze.** The soul check catches problems you won't notice until 50 messages deep.
- **Trust REGRESSION.** If the AI says it got worse, it got worse. Revert.
- **2-3 iterations max.** Not converging? The problem might be fundamental.
- **Use the guidance field.** "Keep her mean." "The clumsiness is endearing." Be specific.

---

## Requirements

- SillyTavern 1.12.0+
- A working Chat Completion API
- A model that can follow instructions

---

## License

MIT — Do whatever.

---

## Support

[GitHub Issues](https://github.com/Inktomi93/SillyTavern-CardRefinery/issues)

---

_"Her entire personality was 'shy catgirl who likes headpats.' Three iterations later she's a recovering hikikomori who adopted the cat persona as social camouflage. The pipeline works."_

**Now stop reading and go fix your cards.**
