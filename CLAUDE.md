# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**CardRefinery** is a SillyTavern extension for AI-powered character card refinement. It provides an iterative pipeline (Score → Rewrite → Analyze) that evaluates and improves character cards while preserving their "soul."

## Quick Reference

```bash
npm run dev           # Watch mode
npm run build         # Production build
npm run check         # ALL checks (typecheck + lint + lint:css + format:check)
npm run fix           # ALL auto-fixes
npm run test          # Run tests
npm run test:coverage # Tests with coverage
```

Build outputs to `dist/index.js`. After building, reload SillyTavern.

## Architecture

```
src/
├── index.ts              # Entry point (APP_READY event)
├── styles/               # CSS (BEM with cr- prefix)
├── shared/               # Constants, logging, ST API, utilities
├── types/                # TypeScript interfaces
├── data/                 # Persistence (settings, sessions, presets)
├── state/                # Runtime state (observable store, actions)
├── domain/               # Business logic (generation, schema, pipeline)
└── ui/                   # Presentation (popup, components, formatters)
```

### Layer Responsibilities

| Layer       | Purpose                                                       | Key Files                                           |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------- |
| **shared/** | ST API abstraction, logging, utilities                        | `st.ts`, `debug.ts`, `tokens.ts`                    |
| **data/**   | Settings with migrations, IndexedDB sessions, preset registry | `settings.ts`, `sessions.ts`, `registry.ts`         |
| **state/**  | Observable store, popup actions, pipeline execution           | `store.ts`, `popup-state.ts`, `pipeline-actions.ts` |
| **domain/** | LLM generation, schema validation, character fields           | `generation.ts`, `schema/`, `pipeline/`             |
| **ui/**     | Popup lifecycle, 14+ components, formatters                   | `popup.ts`, `components/`                           |

## Key Patterns

### SillyTavern APIs

```typescript
import { popup, toast, log } from './shared';

await popup.confirm('Delete?', 'Are you sure?');
toast.success('Saved!');
log.debug('Processing', { data });

// ST bundled libs
const { lodash, DOMPurify, Fuse, localforage, morphdom } = SillyTavern.libs;
```

### Settings & Presets

```typescript
import { getSettings, save } from './data/settings';
import { getPromptPresets, subscribe } from './data/settings/registry';

const settings = getSettings();
settings.debugMode = true;
await save();

const presets = getPromptPresets({ stage: 'score' });
const unsubscribe = subscribe((event) => {
    /* ... */
});
```

### State Management

```typescript
import { getState, setState, subscribe, batch } from './state/store';

const state = getState();
setState({ activeStage: 'rewrite' });

batch(() => {
    setState({ ... });
    setState({ ... });
}); // Single notification
```

### Component Pattern

```typescript
export function renderComponent(): string { ... }      // HTML string
export function updateComponent(): void { ... }        // DOM updates via morphdom
export function bindComponentEvents(el): () => void { ... }  // Returns cleanup
```

### Token Counting

```typescript
import { countTokensDebounced, getTokenCount } from './shared/tokens';

countTokensDebounced('text', (count) => updateUI(count)); // Debounced callback
const count = await getTokenCount('text'); // Promise API with caching
```

## Pipeline Stages

| Stage       | Input                        | Output                    |
| ----------- | ---------------------------- | ------------------------- |
| **Score**   | Character fields             | Scores with feedback      |
| **Rewrite** | Original + scores + guidance | Improved text             |
| **Analyze** | Original vs rewritten        | Soul preservation verdict |

Each stage supports: custom prompts, JSON schemas, field selection, user guidance.

## CSS Architecture

- **BEM naming** with `cr-` prefix
- **SmartTheme inheritance** via CSS variables
- **PostCSS plugins**: import, nested, custom-media, autoprefixer, cssnano

```css
.cr-component {
}
.cr-component__element {
}
.cr-component--modifier {
}
```

## Testing

```bash
npm run test          # Vitest
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Tests mirror source: `tests/domain/`, `tests/state/`, `tests/ui/`, etc.

## Version & Git

```bash
npm run version:sync      # Sync version across files
npm run git:status        # Branch status
npm run git:promote       # Merge dev → main
```

Pre-commit hook runs: checks → tests → version sync → build → stage artifacts.

## Best Practices

- Use `DOMPurify.sanitize()` for user content
- Use `localforage` for large data (not extensionSettings)
- Return cleanup functions from event bindings
- Use morphdom for efficient DOM updates
- Batch state updates via `batch()` or update-coordinator
