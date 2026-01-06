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
npm run check         # Run ALL checks (typecheck + lint + lint:css + format:check)
npm run fix           # Run ALL auto-fixes (lint:fix + lint:css:fix + format)
npm run test          # Run tests with Vitest
npm run test:watch    # Watch mode for tests
npm run test:coverage # Run tests with coverage report
npm run sync-types        # Fetch ST types for reference
npm run sync-types:check  # Compare our types with ST's
npm run sync-types:clean  # Remove fetched reference files
```

The build outputs to `dist/index.js`, which is the entry point referenced in `manifest.json`.

## Development

This extension is located inside the SillyTavern installation (`/public/scripts/extensions/third-party`). After running `npm run build`, reload SillyTavern to test changes.

## Architecture

### Layer Overview

```text
src/
├── index.ts                    # Entry point, bootstraps on APP_READY event
├── styles/                     # CSS design system (BEM with cr- prefix)
│   ├── index.css               # Main entry, imports all modules
│   ├── _variables.css          # Design tokens, SmartTheme inheritance
│   ├── _base.css               # Reset & typography
│   ├── _utilities.css          # Layout primitives (.cr-stack, .cr-row, etc.)
│   ├── _responsive.css         # Mobile-first breakpoints
│   └── components/             # 25+ BEM-namespaced component styles
├── shared/                     # Constants, logging, ST API utilities
│   ├── constants.ts            # MODULE_NAME, VERSION, CSS_PREFIX, STAGES, FIELDS
│   ├── debug.ts                # Centralized logging with levels
│   ├── st.ts                   # SillyTavern API abstraction
│   ├── profiles.ts             # API readiness, profile detection, token estimation
│   ├── templates.ts            # Template interpolation with conditionals
│   ├── tokens.ts               # Token counting with caching/debouncing
│   └── utils.ts                # General utilities (html tag, retry, timer)
├── types/                      # TypeScript interfaces
│   ├── character.ts            # Character, CharacterField, PopulatedField
│   ├── preset.ts               # PromptPreset, SchemaPreset
│   ├── session.ts              # Session, SessionIndex, StorageMeta
│   ├── settings.ts             # Settings interface
│   ├── stage.ts                # StageName, StageStatus, StageConfig, StageResult
│   └── state.ts                # PopupState, FieldSelection, StageFieldSelection
├── data/                       # Persistence layer
│   ├── settings/               # Extension settings, presets, registry
│   │   ├── settings.ts         # Settings management with migrations
│   │   ├── registry.ts         # Preset registry with event subscriptions
│   │   ├── defaults.ts         # Default settings and builtin presets
│   │   └── presets.ts          # Preset utilities
│   └── storage/                # IndexedDB sessions via localforage
│       ├── sessions.ts         # Session CRUD with migrations
│       └── cache.ts            # In-memory caching
├── state/                      # Runtime popup state management
│   ├── popup-state.ts          # Central state with all actions
│   ├── session-actions.ts      # Session CRUD operations
│   ├── pipeline-actions.ts     # Pipeline execution actions
│   └── auto-save.ts            # Debounced auto-save logic
├── domain/                     # Business logic
│   ├── generation.ts           # LLM API calls with structured output
│   ├── schema.ts               # JSON schema validation, auto-fix, generation
│   ├── png-writer.ts           # PNG encoding with character data
│   ├── character/              # Character utilities
│   │   ├── fields.ts           # Field extraction and formatting
│   │   └── summary.ts          # Character summary building
│   └── pipeline/               # Pipeline execution
│       ├── execution.ts        # Stage execution, pipeline runner
│       └── prompt.ts           # Prompt building from templates
└── ui/                         # Presentation layer
    ├── popup.ts                # Main popup container, lifecycle
    ├── panel.ts                # Extension panel button
    ├── formatter.ts            # Response formatting (JSON/markdown)
    └── components/             # 14 modular UI components
        ├── base.ts             # DOM utilities ($, $$, morphdom, cx, createSignal)
        ├── update-coordinator.ts # Central UI update orchestration
        ├── character-selector.ts # Fuzzy character search with Fuse.js
        ├── session-dropdown.ts   # Session management dropdown
        ├── stage-tabs.ts         # Pipeline stage navigation
        ├── stage-config.ts       # Per-stage config (prompts, schemas, fields)
        ├── results-panel.ts      # Results display and history navigation
        ├── compare-view.ts       # Diff comparison (original vs rewritten)
        ├── apply-suggestions.ts  # Apply rewritten content to character
        ├── settings-drawer.ts    # Global settings slideout
        ├── preset-drawer.ts      # Preset management slideout
        └── api-status.ts         # API status badge
```

### Key Modules

#### Entry Point (`src/index.ts`)

- Exports `init()` called by SillyTavern on `APP_READY` event
- Registers event listeners for character changes, settings updates
- Initializes settings, panel UI, and storage

#### Shared Layer (`src/shared/`)

| Module         | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| `constants.ts` | MODULE_NAME, VERSION, CSS_PREFIX, STAGES, CHARACTER_FIELDS   |
| `debug.ts`     | Centralized logging with levels (debug/info/warn/error)      |
| `st.ts`        | ST API abstraction (popup, toast, loader, managers)          |
| `profiles.ts`  | API readiness checks, profile detection, token estimation    |
| `templates.ts` | Template interpolation with `{{if}}` conditionals            |
| `tokens.ts`    | Async token counting with caching and debouncing             |
| `utils.ts`     | html template tag, retry, createTimer, parseJSON, hashString |

#### Data Layer (`src/data/`)

**Settings (`settings/`):**

- `settings.ts` - Settings access, migration framework, persistence via `extensionSettings`
- `registry.ts` - Preset registry (prompt/schema presets) with event subscriptions
- `defaults.ts` - Default settings, builtin presets with version tracking
- `presets.ts` - Preset validation and utilities

**Storage (`storage/`):**

- `sessions.ts` - IndexedDB session storage via localforage with migration support
- `cache.ts` - In-memory cache for session data

#### State Layer (`src/state/`)

- `popup-state.ts` - Central runtime state with 35+ actions for popup management
- `session-actions.ts` - Session create/load/save/delete operations
- `pipeline-actions.ts` - Pipeline execution, stage progression
- `auto-save.ts` - Debounced auto-save with dirty tracking

#### Domain Layer (`src/domain/`)

**Core:**

- `generation.ts` - LLM generation with structured output support, retry logic
- `schema.ts` - JSON schema validation against Anthropic limits, auto-fix, LLM generation
- `png-writer.ts` - PNG chunk encoding/decoding for character card export

**Character (`character/`):**

- `fields.ts` - Field extraction, formatting, validation, shallow detection
- `summary.ts` - Build character summary from selected fields

**Pipeline (`pipeline/`):**

- `execution.ts` - Run individual stages or full pipeline with abort support
- `prompt.ts` - Build prompts from templates with context (character, guidance, history)

#### UI Layer (`src/ui/`)

**Core:**

- `popup.ts` - Main popup container, lifecycle management, event binding
- `panel.ts` - Extension settings panel with launch button and debug toggle
- `formatter.ts` - Rich response formatting (JSON rendering, markdown sections, score badges)

**Components (`components/`):**

| Component               | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `base.ts`               | DOM utilities ($, $$, on, cx, morphdom, createSignal)      |
| `update-coordinator.ts` | Central update orchestration with category-based batching  |
| `character-selector.ts` | Fuzzy character search using Fuse.js                       |
| `session-dropdown.ts`   | Session list, rename, delete with keyboard navigation      |
| `stage-tabs.ts`         | Stage navigation tabs with status indicators               |
| `stage-config.ts`       | Per-stage config: prompt/schema presets, field selection   |
| `results-panel.ts`      | Results display with view modes and history navigation     |
| `compare-view.ts`       | Side-by-side diff with word-level highlighting             |
| `apply-suggestions.ts`  | Apply rewritten fields to character card                   |
| `settings-drawer.ts`    | Global settings: profiles, system prompts, generation mode |
| `preset-drawer.ts`      | Preset CRUD with validation and schema editor              |
| `api-status.ts`         | API connection status badge with profile selector          |

### CSS Architecture

The extension uses a PostCSS-powered modular CSS design system with `cr-` prefix (CardRefinery):

**Structure:**

```text
src/styles/
├── index.css               # Entry point with @import statements
├── _variables.css          # Design tokens, custom media queries
├── _base.css               # Reset, typography
├── _utilities.css          # Layout primitives
├── _responsive.css         # Mobile breakpoints
└── components/             # 25+ component stylesheets
    ├── _popup.css, _header.css, _toolbar.css
    ├── _dropdown.css, _character-option.css, _session-option.css
    ├── _stage-tabs.css, _tabs.css
    ├── _forms.css, _form-shared.css, _field-list.css
    ├── _buttons.css, _badges.css, _alerts.css
    ├── _results-panel.css, _compare-view.css, _json-render.css
    ├── _drawer.css, _settings-modal.css, _preset-drawer.css
    ├── _history.css, _preview.css, _loading.css
    └── _panel.css, _layout.css, _list.css, _api-status.css
```

**Design System:**

- **CSS_PREFIX** - `cr-` constant in `src/shared/constants.ts`
- **Design Tokens** - CSS variables inheriting from SillyTavern's SmartTheme
- **Layout Primitives** - `.cr-stack`, `.cr-row`, `.cr-grid`
- **Custom Media** - `--mobile`, `--tablet`, `--desktop`, `--reduced-motion`
- **BEM Naming** - `.cr-component`, `.cr-component__element`, `.cr-component--modifier`

**PostCSS Plugins:**

- `postcss-import` - Modular CSS via `@import`
- `postcss-nested` - Sass-like nesting for BEM
- `postcss-custom-media` - Responsive breakpoint variables
- `autoprefixer` - Vendor prefix automation
- `cssnano` - Production minification

**Button Pattern:**

```css
:is(.cr-popup, .cr-drawer) .menu_button {
    /* Base normalization */
}
```

Modifiers: `--primary`, `--danger`, `--icon`, `--sm`, `--lg`, `--full`, `--ghost`

## Key Patterns

### Accessing SillyTavern APIs

```typescript
import { popup, toast, loader, log } from './shared';

// Popups (namespaced to avoid shadowing window globals)
if (await popup.confirm('Delete?', 'Are you sure?')) { ... }
toast.success('Saved!');
await loader.wrap(asyncOperation);

// Use ST bundled libs directly
const { lodash, DOMPurify, Fuse, localforage, morphdom } = SillyTavern.libs;
const ctx = SillyTavern.getContext();
```

### Logging Pattern

Use the centralized logger from `src/shared/debug.ts`:

```typescript
import { log } from './shared';

log.info('Extension loaded'); // Always logs to console
log.debug('Processing', { n: 42 }); // Only if debug mode on, always stored
log.warn('Deprecated feature'); // Warning level
log.error('Failed to save', error); // Error level
```

All logs are prefixed with `[SillyTavern-CardRefinery]` and stored for diagnostics (max 100 entries).

### Settings Pattern

Settings are stored in `SillyTavern.getContext().extensionSettings[MODULE_NAME]`. The settings module handles initialization, migration, and persistence.

```typescript
import { getSettings, save } from './data/settings';

const settings = getSettings();
settings.debugMode = true;
await save();
```

**Best practices:**

- Never store API keys or secrets in extensionSettings
- Use the migration framework for schema changes
- Call `save()` after changes (debounced internally)

### Preset Registry Pattern

Presets use a singleton registry with arrow function methods (preserves `this` when destructured):

```typescript
import { getPromptPresets, registerPromptPreset, subscribe } from './data/settings/registry';

// Get presets for a stage
const presets = getPromptPresets({ stage: 'score' });

// Subscribe to changes
const unsubscribe = subscribe((event) => {
    if (event.type === 'updated') { ... }
});
```

### Component Pattern

UI components follow a render/update/bind pattern:

```typescript
export function renderComponent(): string { ... }      // Initial HTML string
export function updateComponent(): void { ... }        // DOM updates via morphdom
export function bindComponentEvents(el: HTMLElement): () => void { ... }  // Returns cleanup
```

### DOM Utilities

The `base.ts` module provides jQuery-like utilities:

```typescript
import {
    $,
    $$,
    on,
    cx,
    morphElement,
    createSignal,
} from './ui/components/base';

// Query selectors
const el = $('.cr-popup');
const items = $$('.cr-list-item');

// Event binding with cleanup
const cleanup = on(el, 'click', handler);

// Class names with conditionals
const classes = cx('cr-button', { 'cr-button--active': isActive });

// Efficient DOM updates
morphElement(container, newHtml);

// Reactive signals (simple state)
const [count, setCount] = createSignal(0);
```

### Update Coordinator

Centralized UI update orchestration to prevent redundant renders:

```typescript
import {
    registerUpdate,
    refreshAfterStageChange,
} from './ui/components/update-coordinator';

// Register a component's update function
registerUpdate(['stage', 'results'], updateMyComponent);

// Trigger coordinated updates
refreshAfterStageChange();
```

### Token Counting

Debounced, cached token counting:

```typescript
import { countTokensDebounced, getTokenCountBatch } from './shared/tokens';

// Single text with callback
countTokensDebounced('my text', (count) => updateUI(count));

// Batch counting
const results = await getTokenCountBatch([
    { key: 'description', text: desc },
    { key: 'personality', text: personality },
]);
```

### Template Processing

Template interpolation with conditionals and SillyTavern macro escaping:

```typescript
import { processTemplate, buildContext } from './shared/templates';

const context = buildContext(character, { stage: 'score' });
const prompt = processTemplate(template, context);
// Supports: {{field}}, {{if condition}}...{{/if}}, {{char}}, etc.
```

### Schema Validation

JSON schema validation against Anthropic structured output limits:

```typescript
import {
    validateSchema,
    autoFixSchema,
    generateSchemaFromDescription,
} from './domain/schema';

const result = validateSchema(schema);
if (!result.valid) {
    const fixed = autoFixSchema(schema);
}

// Generate schema from natural language
const { schema, error } = await generateSchemaFromDescription(
    'A score from 1-10 with feedback',
);
```

### Security Best Practices

Following SillyTavern extension guidelines:

- Sanitize user inputs with `DOMPurify.sanitize()` before DOM insertion
- Never store secrets in `extensionSettings`
- Validate input types before processing
- Use the `html` template tag for safe HTML construction

### Performance Best Practices

- Don't store large data in `extensionSettings` (loaded into memory frequently)
- Use `localforage` for large data storage (IndexedDB abstraction)
- Remove event listeners via cleanup functions
- Use morphdom for efficient DOM updates
- Debounce token counting and auto-save operations
- Batch UI updates via update-coordinator

## TypeScript Configuration

- Target: ES6
- Module: ESNext with Bundler resolution
- Strict mode enabled
- Source maps enabled

## Testing

Tests use Vitest with happy-dom for DOM simulation:

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

Test structure mirrors source:

```text
tests/
├── setup.ts                    # Global test setup
├── ui/                         # Component tests
├── domain/                     # Business logic tests
│   ├── schema.test.ts
│   └── pipeline/
├── state/                      # State management tests
├── shared/                     # Utility tests
├── data/                       # Data layer tests
└── integration/                # End-to-end tests
```

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
- User guidance for iterative refinement

## Type Management

SillyTavern types are declared standalone in `globals.d.ts` for CI compatibility.

**Why standalone?** ST's actual `global.d.ts` uses imports that reference other ST files, which don't exist when building outside the ST installation (e.g., in GitHub CI).

**Keeping types in sync:**

```bash
npm run sync-types        # Fetch ST's types for reference
npm run sync-types:check  # Compare our types with ST's exports
```

The fetched files go to `.st-types/` (gitignored) for reference. To update `globals.d.ts`:

1. Run `npm run sync-types` to fetch ST's current types
2. Review `.st-types/global.d.ts` for changes
3. Update `globals.d.ts` with any new/changed types
4. Run `npm run check` to verify

## Dependencies

**Runtime:**

- `crc` - CRC32 calculation for PNG chunks
- `png-chunk-text` - PNG tEXt chunk encoding
- `png-chunks-extract` - PNG chunk extraction

**Dev:**

- TypeScript, Webpack, ESLint, Prettier, Stylelint
- PostCSS with plugins (nested, custom-media, import, autoprefixer, cssnano)
- Vitest with happy-dom and v8 coverage
- Husky for pre-commit hooks

## Version Management

```bash
npm run version:sync        # Sync version across package.json, manifest.json, constants.ts
npm run version:check       # Verify all versions match
npm run version:sync 2.0.0  # Set specific version everywhere
```

## Git Workflow

```bash
npm run git:status    # Show branch status and pending commits
npm run git:switch    # Toggle between main and dev branches
npm run git:sync      # Rebase dev on main (keeps dev up to date)
npm run git:promote   # Merge dev into main (local + push)
```

## Pre-commit Hook

On every `git commit`, the pre-commit hook automatically:

1. Runs all checks (typecheck, lint, format)
2. Runs tests
3. Syncs versions from package.json
4. Runs production build
5. Stages dist/, manifest.json, and constants.ts
