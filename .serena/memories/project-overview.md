# CardRefinery - Project Overview

## Purpose

A SillyTavern extension for AI-powered character card scoring, rewriting, and refinement. Provides an iterative pipeline (Score → Rewrite → Analyze) that evaluates and improves character cards while preserving their "soul" (essential character identity).

## Tech Stack

- TypeScript (ES6 target, ESNext modules, strict mode)
- Webpack for bundling
- PostCSS for CSS processing (nested, custom-media, import)
- Vitest for testing (with happy-dom)
- ESLint + Prettier + Stylelint for code quality
- Husky for pre-commit hooks
- No external UI frameworks - vanilla TS with custom CSS

## Architecture

```
src/
├── index.ts              # Entry point, bootstraps on APP_READY
├── styles/               # CSS design system (BEM with cr- prefix)
│   ├── index.css         # Main entry with @import
│   ├── _variables.css    # Design tokens, custom media
│   ├── _base.css         # Reset & typography
│   ├── _utilities.css    # Layout primitives
│   ├── _responsive.css   # Mobile breakpoints
│   └── components/       # 25+ BEM-namespaced component styles
├── shared/               # Constants, logging, ST API utilities
│   ├── constants.ts      # MODULE_NAME, VERSION, CSS_PREFIX, STAGES, FIELDS
│   ├── debug.ts          # Centralized logging with levels
│   ├── st.ts             # ST API abstraction (popup, toast, loader, managers)
│   ├── profiles.ts       # API readiness, profile detection, token estimation
│   ├── templates.ts      # Template interpolation with conditionals
│   ├── tokens.ts         # Token counting with caching/debouncing
│   └── utils.ts          # General utilities (html tag, retry, timer)
├── types/                # TypeScript interfaces
│   ├── character.ts      # Character, CharacterField, PopulatedField
│   ├── preset.ts         # PromptPreset, SchemaPreset
│   ├── session.ts        # Session, SessionIndex, StorageMeta
│   ├── settings.ts       # Settings interface
│   ├── stage.ts          # StageName, StageStatus, StageConfig, StageResult
│   └── state.ts          # PopupState, FieldSelection, StageFieldSelection
├── data/                 # Persistence layer
│   ├── settings/         # Extension settings, presets, registry
│   │   ├── settings.ts   # Settings management with migrations
│   │   ├── registry.ts   # Preset registry with event subscriptions
│   │   ├── defaults.ts   # Default settings and builtin presets
│   │   └── presets.ts    # Preset utilities
│   └── storage/          # IndexedDB sessions via localforage
│       ├── sessions.ts   # Session CRUD with migrations
│       └── cache.ts      # In-memory caching
├── state/                # Runtime popup state management
│   ├── popup-state.ts    # Central state with 35+ actions
│   ├── session-actions.ts # Session CRUD operations
│   ├── pipeline-actions.ts # Pipeline execution actions
│   └── auto-save.ts      # Debounced auto-save logic
├── domain/               # Business logic
│   ├── generation.ts     # LLM API calls with structured output
│   ├── schema.ts         # JSON schema validation, auto-fix, generation
│   ├── png-writer.ts     # PNG encoding for character export
│   ├── character/        # Character utilities
│   │   ├── fields.ts     # Field extraction and formatting
│   │   └── summary.ts    # Character summary building
│   └── pipeline/         # Pipeline execution
│       ├── execution.ts  # Stage execution, pipeline runner
│       └── prompt.ts     # Prompt building from templates
└── ui/                   # Presentation layer
    ├── popup.ts          # Main popup container, lifecycle
    ├── panel.ts          # Extension panel button
    ├── formatter.ts      # Response formatting (JSON/markdown)
    └── components/       # 14 modular UI components
        ├── base.ts       # DOM utilities ($, $$, morphdom, cx, createSignal)
        ├── update-coordinator.ts # Central UI update orchestration
        ├── character-selector.ts # Fuzzy search with Fuse.js
        ├── session-dropdown.ts   # Session management
        ├── stage-tabs.ts         # Pipeline stage navigation
        ├── stage-config.ts       # Per-stage configuration
        ├── results-panel.ts      # Results and history
        ├── compare-view.ts       # Diff comparison
        ├── apply-suggestions.ts  # Apply to character
        ├── settings-drawer.ts    # Global settings slideout
        ├── preset-drawer.ts      # Preset management
        └── api-status.ts         # API status badge
```

## Key Patterns

- **BEM CSS** with `cr-` prefix (CardRefinery), inheriting SillyTavern SmartTheme variables
- **CSS_PREFIX** constant in `src/shared/constants.ts` for easy prefix changes
- **Component pattern**: render/update/bind with cleanup functions
- **Arrow functions** for class methods (preserves `this` when destructured)
- **Update coordinator** for batched UI updates
- **morphdom** for efficient DOM diffing
- Uses ST's bundled libs: DOMPurify, lodash, Fuse, localforage, morphdom, moment

## Pipeline Stages

| Stage   | Purpose                    | Output                          |
| ------- | -------------------------- | ------------------------------- |
| Score   | Evaluate character quality | Structured scores with feedback |
| Rewrite | Improve character content  | Enhanced text suggestions       |
| Analyze | Deep character analysis    | Detailed breakdown and insights |

Each stage supports:

- Custom prompts or prompt presets
- JSON schemas for structured output
- Field selection for context control
- User guidance for iterative refinement

## Dependencies

**Runtime:** crc, png-chunk-text, png-chunks-extract

**Dev:** TypeScript, Webpack, PostCSS, Vitest, ESLint, Prettier, Stylelint, Husky

## Testing

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

Tests mirror source structure in `tests/` folder.

## Related Memories

For SillyTavern API documentation, see these memories (source of truth):

| Memory                 | Contents                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| `st-context-api-map`   | Complete `SillyTavern.getContext()` API reference (~100+ methods) |
| `st-bundled-libs`      | Bundled libraries via `SillyTavern.libs`                          |
| `st-modules-reference` | Core ST modules (events, popup, extensions, tokenizers, etc.)     |
| `css-conventions`      | CSS design system and SmartTheme integration                      |
| `suggested_commands`   | npm scripts and git workflow commands                             |
