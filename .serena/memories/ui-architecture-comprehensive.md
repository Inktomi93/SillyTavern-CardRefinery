# CardRefinery UI Architecture - Comprehensive Documentation

## Executive Summary

The CardRefinery UI is a sophisticated, component-based system built on vanilla TypeScript without framework dependencies. It uses composition over inheritance, explicit cleanup patterns, and a centralized update coordinator for efficient state-driven rendering.

---

## Core Architecture Layers

### 1. Entry Points (`src/ui/`)

| File                | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `popup.ts`          | Main popup lifecycle orchestrator - init, render, bind, cleanup                      |
| `panel.ts`          | Extension settings panel with launch button                                          |
| `error-boundary.ts` | Error isolation with `withRenderBoundary`, `withUpdateBoundary`, `withEventBoundary` |

### 2. Component Infrastructure (`src/ui/components/`)

| File                    | Purpose                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `base.ts`               | DOM utilities (`$`, `$$`, `on`), `morphUpdate`, `cx`, formatters   |
| `update-coordinator.ts` | Centralized batched updates via microtasks, category-based refresh |
| `index.ts`              | Barrel file exporting all components                               |

### 3. Major Multi-File Components

| Component            | Files   | Purpose                                                     |
| -------------------- | ------- | ----------------------------------------------------------- |
| `stage-config/`      | 7 files | Field selector, prompt editor, schema config, token display |
| `results-panel/`     | 6 files | Pipeline results, history navigation, compare view toggle   |
| `settings-drawer/`   | 6 files | Extension settings slideout panel                           |
| `preset-drawer/`     | 8 files | Prompt/schema preset CRUD management                        |
| `apply-suggestions/` | 4 files | Apply rewritten fields to character cards                   |
| `formatter/`         | 6 files | JSON + markdown rendering pipeline                          |

### 4. Standalone Single-File Components

| Component               | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `character-selector.ts` | Searchable character dropdown with Fuse.js        |
| `session-dropdown.ts`   | Session management (create, load, rename, delete) |
| `stage-tabs.ts`         | Pipeline navigation + run/abort controls          |
| `api-status.ts`         | API connection indicator + profile selector       |
| `compare-view.ts`       | Side-by-side original vs rewritten diff           |

---

## Component Pattern (Render/Update/Bind)

Every component follows this three-function pattern:

```typescript
// 1. RENDER - Returns HTML string (wrapped with error boundary)
export const renderComponent = withRenderBoundary(_renderComponent, {
    name: 'Component',
});

// 2. UPDATE - Mutates DOM (partial updates or morphdom)
export function updateComponent(): void {
    /* ... */
}

// 3. BIND - Attaches events, returns cleanup function
export function bindComponentEvents(container: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];
    cleanups.push(on(element, 'click', handler));
    return () => cleanups.forEach((fn) => fn());
}
```

---

## State Flow Architecture

```
User Action → Event Handler → State Action → Store setState()
                                                    ↓
                                    Store notifies subscribers (by slice)
                                                    ↓
                                    Update Coordinator batches updates
                                                    ↓
                                    Component update functions execute
                                                    ↓
                                    DOM updated via morphdom or innerHTML
```

### Update Coordinator Categories

- `character` - Character selection
- `session` - Session CRUD
- `stage` - Active stage change
- `pipeline` - Pipeline status (running/complete/error)
- `fields` - Field selection
- `config` - Stage configuration
- `results` - Pipeline results
- `all` - Full refresh

---

## Key Patterns

### 1. Error Boundaries

```typescript
withRenderBoundary(fn, { name }) → Catches render errors, returns fallback HTML
withUpdateBoundary(fn, { name }) → Catches update errors, logs silently
withEventBoundary(fn, { name }) → Catches binding errors, shows toast
```

### 2. Cleanup-First Design

- Every `on()` call returns cleanup function
- Components collect cleanups in array
- `bindComponentEvents()` returns combined cleanup
- Popup stores all cleanups, executes on close

### 3. Efficient DOM Updates

```typescript
// Surgical updates preserving focus/scroll
morphUpdate(container, newHtml, options);

// Selective partial updates
const trigger = $(`#${MODULE_NAME}_trigger`);
trigger.innerHTML = updatedContent;
```

### 4. Debounce Tracking

```typescript
// Track pending debounced handlers
addPendingInput(debouncedFn);

// Before save: flush all
flushPendingInputs();

// On cleanup: cancel all
clearPendingInputs();
```

### 5. Module-Level State

Components track UI-only state (open/closed, editing mode) at module level:

```typescript
let isOpen = false;
let editingSessionId: string | null = null;
```

---

## File Count Summary

```
src/ui/                          ~50 files total
├── popup.ts                     Main orchestrator
├── panel.ts                     Settings panel
├── error-boundary.ts            Error isolation
├── formatter/                   6 files - JSON/markdown rendering
├── components/
│   ├── base.ts                  DOM utilities
│   ├── update-coordinator.ts    Batched updates
│   ├── index.ts                 Barrel exports
│   ├── stage-config/            7 files
│   ├── results-panel/           6 files
│   ├── settings-drawer/         6 files
│   ├── preset-drawer/           8 files
│   ├── apply-suggestions/       4 files
│   └── [5 standalone files]     character-selector, session-dropdown, etc.
```

---

## Integration Points

### SillyTavern APIs

- `SillyTavern.getContext()` - Characters, thumbnails, popup API
- `SillyTavern.libs` - DOMPurify, morphdom, lodash, Fuse, hljs, moment

### Internal Layers

- `src/state/store.ts` - Observable store with sliced subscriptions
- `src/state/popup-state.ts` - Public state actions
- `src/data/settings/` - Persistent settings with migrations
- `src/data/sessions.ts` - IndexedDB session storage
- `src/domain/` - Business logic (pipeline, schema validation, generation)

---

## Refactoring Considerations

### Strengths to Preserve

1. Explicit cleanup pattern prevents memory leaks
2. Error boundaries isolate failures
3. Update coordinator prevents scattered refresh calls
4. Morphdom preserves user input state
5. Clean separation of render/update/bind

### Potential Improvements

1. **Component state** - Module-level state could be encapsulated better
2. **Type safety** - Some HTML strings could use tagged templates
3. **Testing** - More unit tests for individual components
4. **Code splitting** - Large components could lazy-load
5. **CSS architecture** - Consider CSS modules or scoped styles
6. **Template literals** - Could benefit from a lightweight template library

### Complexity Hotspots

1. `stage-config/` - Most complex component (7 files)
2. `preset-drawer/` - Complex drawer lifecycle (8 files)
3. `popup.ts` - Main orchestrator with many responsibilities
4. `results-panel/` - Multiple display modes and history navigation
