# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CardRefinery** is a SillyTavern extension for AI-powered character card scoring, rewriting, and refinement. It provides an iterative pipeline (Score → Rewrite → Analyze) that uses LLM APIs to evaluate and improve character cards while preserving their "soul" (essential character identity).

## Build Commands

```bash
npm run dev           # Watch mode - rebuilds on file changes
npm run build         # Production build (minified)
npm run clean         # Remove dist/ folder
npm run rebuild       # Clean + build in sequence
npm run check         # Run ALL checks (typecheck + lint + format:check)
npm run fix           # Run ALL auto-fixes (lint:fix + format)
```

The build outputs to `dist/index.js`, which is the entry point referenced in `manifest.json`.

## Development

This extension is located inside the SillyTavern installation (`/public/scripts/extensions/third-party`). After running `npm run build`, reload SillyTavern to test changes.

## Architecture

### Layer Overview

```text
src/
├── index.ts              # Entry point, bootstraps on APP_READY
├── styles/               # CSS design system (BEM with cr- prefix)
│   ├── index.css         # Main entry, imports all modules
│   ├── _variables.css    # Design tokens scoped to cr- containers
│   ├── _base.css         # Reset & typography
│   ├── _utilities.css    # Layout primitives
│   ├── _responsive.css   # Mobile-first breakpoints
│   └── components/       # BEM-namespaced component styles
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

- `constants.ts` - Module name, version, CSS_PREFIX, stage definitions, field mappings
- `debug.ts` - Centralized logging with `[MODULE_NAME]` prefix, log storage, diagnostics
- `st.ts` - SillyTavern API abstraction (`popup`, `toast`, utilities)
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

The extension uses a PostCSS-powered modular CSS design system with `cr-` prefix (CardRefinery):

- **CSS_PREFIX Constant** - Defined in `src/shared/constants.ts` for easy prefix changes
- **Design Tokens** - CSS variables inheriting from SillyTavern's SmartTheme
- **Layout Primitives** - `.cr-stack`, `.cr-row`, `.cr-grid`
- **Components** - `.cr-popup`, `.cr-panel`, `.cr-section`, `.cr-list-item`, etc.
- **Button Modifiers** - Extends ST's `.menu_button` with `--primary`, `--icon`, `--sm`, `--ghost`
- **Responsive** - Mobile-first with 768px breakpoint

**PostCSS Plugins:**
- `postcss-import` - Modular CSS via `@import`
- `postcss-nested` - Sass-like nesting for cleaner BEM
- `postcss-custom-media` - Responsive breakpoint variables
- `autoprefixer` - Vendor prefix automation
- `postcss-prefix-selector` - Available for CSS scoping if needed
- `cssnano` - Production minification

**To change the CSS prefix:**
1. Update `CSS_PREFIX` in `src/shared/constants.ts`
2. Find-replace in `src/styles/` and `src/ui/`: old prefix → new prefix
3. Update `_variables.css` root selectors

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

### Logging Pattern

Use the centralized logger from `src/shared/debug.ts`:

```typescript
import { log } from './shared';

log.info('Extension loaded');              // Always logs to console
log.debug('Processing', { items: 42 });    // Only if debug mode on, always stored
log.warn('Deprecated feature');            // Warning level
log.error('Failed to save', error);        // Error level
```

All logs are prefixed with `[SillyTavern-CardRefinery]` and stored for diagnostics (max 100 entries).

### Settings Pattern

Settings are stored in `SillyTavern.getContext().extensionSettings[MODULE_NAME]`. The settings module handles initialization, migration, and persistence.

**Best practices:**
- Never store API keys or secrets in extensionSettings (they're stored in plain text)
- Use lodash.merge with structuredClone for default initialization
- Call `saveSettingsDebounced()` after changes

```typescript
const { extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();

// Initialize with defaults
extensionSettings[MODULE_NAME] = SillyTavern.libs.lodash.merge(
    structuredClone(defaultSettings),
    extensionSettings[MODULE_NAME]
);
```

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

### Security Best Practices

Following SillyTavern extension guidelines:
- Sanitize user inputs with `DOMPurify.sanitize()` before DOM insertion
- Never store secrets in `extensionSettings`
- Validate input types before processing

### Performance Best Practices

- Don't store large data in `extensionSettings` (loaded into memory frequently)
- Use `localforage` for large data storage (IndexedDB abstraction)
- Remove event listeners when no longer needed
- Use async/await for I/O operations to avoid blocking UI

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
