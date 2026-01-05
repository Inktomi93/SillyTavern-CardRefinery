# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Character Tools** is a SillyTavern extension for AI-powered character card analysis, scoring, and enhancement. It provides a multi-stage pipeline (Score, Rewrite, Analyze) that uses LLM APIs to evaluate and improve character cards.

## Build Commands

```bash
npm run build         # Production build (webpack --mode production)
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier format
npm run format:check  # Prettier check
```

The build outputs to `dist/index.js`, which is the entry point referenced in `manifest.json`.

## Development

This extension is located inside the SillyTavern installation (`/public/scripts/extensions/third-party`). After running `npm run build`, reload SillyTavern to test changes.

## Architecture

### Layer Overview

```text
src/
├── index.ts              # Entry point, bootstraps on APP_READY
├── style.css             # CSS design system (BEM with ct- prefix)
├── shared/               # Constants, logging, ST API utilities
├── types/                # TypeScript interfaces
├── data/                 # Persistence layer
│   ├── settings/         # Extension settings, presets, registry
│   └── storage/          # IndexedDB sessions via localforage
├── state/                # Runtime popup state management
├── domain/               # Business logic
│   ├── pipeline/         # Stage execution, prompt building
│   ├── generation.ts     # LLM API calls via ST
│   └── schema.ts         # JSON schema utilities
└── ui/                   # Presentation layer
    ├── panel.ts          # Settings panel button
    ├── popup.ts          # Main popup container
    └── components/       # UI components (character-search, pipeline-tabs, etc.)
```

### Key Modules

#### Entry Point (`src/index.ts`)

- Exports `init()` called by SillyTavern on `APP_READY` event
- Initializes settings, panel UI, and event listeners

#### Shared Layer (`src/shared/`)

- `constants.ts` - Module name, version, stage definitions, field mappings
- `st.ts` - SillyTavern API abstraction (`popup`, `toast`, `log`, utilities)
- `profiles.ts` - API readiness checks and model profile detection
- `templates.ts` - Template string interpolation

#### Data Layer (`src/data/`)

- `settings/settings.ts` - Settings access, migration, persistence via `extensionSettings`
- `settings/registry.ts` - Preset registry (prompt/schema presets) with event subscriptions
- `settings/defaults.ts` - Default settings, builtin presets
- `storage/` - Session storage via localforage with in-memory caching

#### State Layer (`src/state/`)

- `popup-state.ts` - Runtime state for the popup (character, fields, stages, results)
- `session-actions.ts` - Session CRUD operations
- `auto-save.ts` - Debounced auto-save logic

#### Domain Layer (`src/domain/`)

- `pipeline/execution.ts` - Run stages, handle abort, collect results
- `pipeline/prompt.ts` - Build user/system prompts from templates
- `generation.ts` - Centralized LLM generation with API checks
- `schema.ts` - JSON schema validation and transformation
- `fields.ts` - Character field extraction and analysis

#### UI Layer (`src/ui/`)

- `popup.ts` - Main popup container, lifecycle management
- `panel.ts` - Extension settings panel with launch button
- `components/` - Modular UI components:
    - `character-search.ts` - Character selection with fuzzy search
    - `pipeline-tabs.ts` - Stage tabs and execution controls
    - `stage-config.ts` - Prompt/schema configuration
    - `results-panel.ts` - Results display and history
    - `preset-editor.ts` - Preset management dialogs

### CSS Architecture

The extension uses a BEM-style CSS design system with `ct-` prefix:

- **Design Tokens** - CSS variables inheriting from SillyTavern's SmartTheme
- **Layout Primitives** - `.ct-stack`, `.ct-row`, `.ct-grid`
- **Components** - `.ct-popup`, `.ct-panel`, `.ct-section`, `.ct-list-item`, etc.
- **Button Modifiers** - Extends ST's `.menu_button` with `--primary`, `--icon`, `--sm`, `--ghost`
- **Responsive** - Mobile-first with 768px breakpoint

## Key Patterns

### Accessing SillyTavern APIs

```typescript
import { popup, toast, log } from './shared';

// Popups (namespaced to avoid shadowing window globals)
if (await popup.confirm('Delete?', 'Are you sure?')) { ... }
toast.success('Saved!');

// Use ST bundled libs directly
const { lodash, DOMPurify, Fuse } = SillyTavern.libs;
const ctx = SillyTavern.getContext();
```

### Settings Pattern

Settings are stored in `SillyTavern.getContext().extensionSettings[MODULE_NAME]`. The settings module handles initialization, migration, and persistence.

### Preset Registry Pattern

Presets use a singleton registry with arrow function methods (important for `this` binding when destructured):

```typescript
// Arrow functions preserve this binding when destructured
getPromptPresets = (filter?: PresetFilter): PromptPreset[] => {
    return this.applyFilter(settings.promptPresets, filter);
};

// Exported for convenience
export const { getPromptPresets, registerPromptPreset, ... } = presetRegistry;
```

### Component Pattern

UI components follow a render/update/bind pattern:

```typescript
export function renderComponent(): string { ... }      // Initial HTML
export function updateComponent(): void { ... }        // Incremental updates
export function bindComponentEvents(el: HTMLElement): () => void { ... }  // Returns cleanup
```

## TypeScript Configuration

- Target: ES6
- Module: ESNext with Bundler resolution
- Strict mode enabled
- Source maps enabled

## Pipeline Stages

| Stage   | Purpose                    | Output                          |
| ------- | -------------------------- | ------------------------------- |
| Score   | Evaluate character quality | Structured scores with feedback |
| Rewrite | Improve character content  | Enhanced text suggestions       |
| Analyze | Deep character analysis    | Detailed breakdown and insights |

Each stage can use:

- Custom prompts or prompt presets
- Optional JSON schemas for structured output
- Field selection to control what character data is included
