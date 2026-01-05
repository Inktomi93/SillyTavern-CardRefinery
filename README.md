# CardRefinery

AI-powered character card scoring, rewriting, and refinement pipeline for SillyTavern.

## Features

- **Score** - AI critic rates your character card fields (1-10), identifies strengths, weaknesses, and suggestions
- **Rewrite** - AI editor improves the card based on feedback (conservative, expansive, or default modes)
- **Analyze** - AI QA compares original vs rewrite, checks "soul preservation" (did we keep the character's essence?)

### Key Capabilities

- **Iterative Refinement** - Run stages individually or chain Score → Rewrite → Analyze cycles
- **Soul Check** - Unique feature that ensures rewrites preserve the character's essence
- **Field Selection** - Choose which character fields to process (description, personality, first message, etc.)
- **Preset System** - Save and reuse prompt and schema configurations
- **Structured Output** - Use JSON schemas for consistent, parseable results
- **Session History** - Track iteration history and compare results
- **Mobile-First UI** - Responsive design that works on any screen size

## Installation

1. Clone or download this repository into your SillyTavern's `public/scripts/extensions/third-party/` directory
2. Restart SillyTavern or reload extensions
3. Look for the **CardRefinery** button in the extensions panel

## Usage

1. Click the **CardRefinery** button in the extensions panel
2. **Select a character** from the search/browse list
3. **Choose fields** to include in the analysis
4. **Configure the prompt** (or use a preset)
5. **Run a stage** (Score, Rewrite, or Analyze)
6. View results and iterate as needed

### Pipeline Stages

| Stage       | Purpose                     | Output                                                  |
| ----------- | --------------------------- | ------------------------------------------------------- |
| **Score**   | Rate character quality      | Structured scores with feedback                         |
| **Rewrite** | Improve character content   | Enhanced text suggestions                               |
| **Analyze** | Compare original vs rewrite | Soul check verdict (ACCEPT/NEEDS_REFINEMENT/REGRESSION) |

## Development

### Build Commands

```bash
npm install           # Install dependencies
npm run dev           # Watch mode - auto-rebuilds on changes
npm run build         # Production build
npm run check         # Run all checks (typecheck + lint + format:check)
npm run fix           # Run all auto-fixes (lint:fix + format)
```

### Project Structure

```
src/
├── index.ts          # Extension entry point
├── styles/           # CSS design system (PostCSS)
├── shared/           # Constants, logging, ST API helpers
├── types/            # TypeScript interfaces
├── data/             # Settings, storage, presets
├── state/            # Popup state management
├── domain/           # Business logic (pipeline, generation, schemas)
└── ui/               # UI components (popup, panel, components/)
```

## Requirements

- SillyTavern with a configured Chat Completion API (OpenAI, Claude, etc.)
- An API that supports the selected model

## License

MIT

## Author

Inktomi93
