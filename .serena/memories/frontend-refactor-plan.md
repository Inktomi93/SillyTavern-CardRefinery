# Frontend Refactor Plan: Leverage ST Native Capabilities

## Executive Summary

Refactor CardRefinery's UI layer to leverage SillyTavern's native capabilities, eliminating custom implementations that duplicate ST functionality. Target: ~1,500 LOC reduction (14%) while preserving all features.

## User Decisions

1. **Formatter**: Simplify to showdown - drop smart score detection, hero sections, JSON card rendering
2. **Drawers**: Keep custom slideout drawers (superior to ST's inline-drawer), but deduplicate shared code
3. **Templates**: Static HTML → `/templates/*.html` via `renderExtensionTemplateAsync`; Dynamic → Handlebars

---

## Phase 1: Formatter Simplification

**Goal**: Replace 1,168 LOC custom formatter with ~150 LOC using showdown

### Critical Files

- `src/ui/formatter/index.ts` - Keep, simplify to showdown wrapper
- `src/ui/formatter/markdown-parser.ts` - DELETE (365 LOC)
- `src/ui/formatter/json-renderer.ts` - DELETE (382 LOC)
- `src/ui/formatter/section-renderer.ts` - DELETE (209 LOC)
- `src/ui/formatter/helpers.ts` - DELETE (89 LOC)
- `src/ui/formatter/types.ts` - DELETE (26 LOC)

### New Implementation

```typescript
// src/ui/formatter/index.ts (~150 LOC)
import type showdown from 'showdown';

let converter: showdown.Converter | null = null;

function getConverter(): showdown.Converter {
    if (!converter) {
        const Showdown = SillyTavern.libs.showdown;
        converter = new Showdown.Converter({
            tables: true,
            strikethrough: true,
            tasklists: true,
            ghCodeBlocks: true,
            simpleLineBreaks: true,
        });
    }
    return converter;
}

export function formatResponse(response: string): string {
    const html = getConverter().makeHtml(response);
    return sanitizeWithHighlighting(html);
}

export function formatStructuredResponse(data: unknown): string {
    if (typeof data === 'string') return formatResponse(data);
    return formatResponse(JSON.stringify(data, null, 2));
}

function sanitizeWithHighlighting(html: string): string {
    const { DOMPurify, hljs } = SillyTavern.libs;

    // Apply syntax highlighting to code blocks
    const container = document.createElement('div');
    container.innerHTML = html;
    container.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
    });

    // Sanitize while preserving hljs classes
    return DOMPurify.sanitize(container.innerHTML, {
        ALLOWED_TAGS: [
            'p',
            'br',
            'strong',
            'em',
            'code',
            'pre',
            'ul',
            'ol',
            'li',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'blockquote',
            'a',
            'span',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'hr',
            'del',
            'input',
        ],
        ALLOWED_ATTR: [
            'class',
            'href',
            'target',
            'rel',
            'type',
            'checked',
            'disabled',
        ],
    });
}
```

### Impact

- **Before**: 6 files, 1,168 LOC
- **After**: 1 file, ~150 LOC
- **Savings**: ~1,018 LOC (87% reduction)

---

## Phase 2: Drawer Consolidation

**Goal**: Extract shared drawer base, deduplicate 39% of drawer code

### Critical Files

- `src/ui/components/preset-drawer/drawer-core.ts` (417 LOC) - Extract shared patterns
- `src/ui/components/settings-drawer/lifecycle.ts` (139 LOC) - Extract shared patterns
- NEW: `src/ui/components/drawer-base/index.ts` (~180 LOC)

### Shared Drawer Base

```typescript
// src/ui/components/drawer-base/index.ts
export interface DrawerConfig {
    id: string;
    title: string;
    width?: string;
    onOpen?: () => void;
    onClose?: () => void;
    renderContent: () => string;
    bindEvents: (drawer: HTMLElement) => Array<() => void>;
}

export interface DrawerInstance {
    open: () => void;
    close: () => void;
    destroy: () => void;
    isOpen: () => boolean;
    getElement: () => HTMLElement | null;
}

export function createDrawer(config: DrawerConfig): DrawerInstance {
    let element: HTMLElement | null = null;
    let cleanupFns: Array<() => void> = [];
    let isOpen = false;

    function init(): void {
        if (element) return;
        element = document.createElement('div');
        element.id = config.id;
        element.className = 'cr-drawer';
        element.innerHTML = `
            <div class="cr-drawer__backdrop"></div>
            <div class="cr-drawer__panel" style="width: ${config.width || '400px'}">
                <div class="cr-drawer__header">
                    <h3>${config.title}</h3>
                    <button class="cr-drawer__close" aria-label="Close">&times;</button>
                </div>
                <div class="cr-drawer__content">${config.renderContent()}</div>
            </div>
        `;
        document.body.appendChild(element);

        // Bind shared events (backdrop click, ESC key, close button)
        bindSharedEvents();
        // Bind custom events
        cleanupFns.push(...config.bindEvents(element));
    }

    function bindSharedEvents(): void {
        const backdrop = element?.querySelector('.cr-drawer__backdrop');
        const closeBtn = element?.querySelector('.cr-drawer__close');

        if (backdrop) cleanupFns.push(on(backdrop, 'click', close));
        if (closeBtn) cleanupFns.push(on(closeBtn, 'click', close));

        const escHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) close();
        };
        document.addEventListener('keydown', escHandler);
        cleanupFns.push(() =>
            document.removeEventListener('keydown', escHandler),
        );
    }

    function open(): void {
        if (!element) init();
        element?.classList.add('cr-drawer--open');
        isOpen = true;
        config.onOpen?.();
    }

    function close(): void {
        element?.classList.remove('cr-drawer--open');
        isOpen = false;
        config.onClose?.();
    }

    function destroy(): void {
        cleanupFns.forEach((fn) => fn());
        cleanupFns = [];
        element?.remove();
        element = null;
    }

    return {
        open,
        close,
        destroy,
        isOpen: () => isOpen,
        getElement: () => element,
    };
}
```

### Refactored Preset Drawer

```typescript
// src/ui/components/preset-drawer/index.ts
import { createDrawer, DrawerInstance } from '../drawer-base';
import { renderPresetList } from './list-view';
import { bindPresetEvents } from './events';

let drawer: DrawerInstance | null = null;

export function initPresetDrawer(): void {
    drawer = createDrawer({
        id: 'cr-preset-drawer',
        title: 'Prompt Presets',
        width: '450px',
        renderContent: renderPresetList,
        bindEvents: bindPresetEvents,
        onOpen: () => refreshPresetList(),
    });
}

export function openPresetDrawer(): void {
    drawer?.open();
}
export function closePresetDrawer(): void {
    drawer?.close();
}
export function destroyPresetDrawer(): void {
    drawer?.destroy();
    drawer = null;
}
```

### Impact

- **Before**: preset-drawer (1,787 LOC) + settings-drawer (1,067 LOC) = 2,854 LOC
- **After**: drawer-base (180 LOC) + preset-drawer (1,100 LOC) + settings-drawer (660 LOC) = 1,940 LOC
- **Savings**: ~914 LOC (32% reduction)

---

## Phase 3: Template Migration

**Goal**: Move static HTML to template files, use Handlebars for dynamic content

### Template Structure

```
templates/
├── popup.html              # Main popup shell
├── drawer-shell.html       # Shared drawer container
├── settings/
│   ├── general.html        # General settings section
│   ├── pipeline.html       # Pipeline settings section
│   └── api-status.html     # API status banner
├── preset/
│   ├── list-item.html      # Single preset item
│   └── form.html           # Preset edit form
├── results/
│   ├── panel.html          # Results panel shell
│   └── item.html           # Single result item
└── partials/
    ├── field-checkbox.html # Reusable field checkbox
    ├── token-counter.html  # Token count display
    └── loading-spinner.html
```

### Template Infrastructure

```typescript
// src/ui/templates/index.ts
const compiledTemplates = new Map<string, Handlebars.TemplateDelegate>();

export async function loadTemplate(name: string): Promise<string> {
    const context = SillyTavern.getContext();
    return context.renderExtensionTemplateAsync(
        'third-party/SillyTavern-CardRefinery',
        name,
        {},
    );
}

export function compileTemplate(
    name: string,
    html: string,
): Handlebars.TemplateDelegate {
    if (!compiledTemplates.has(name)) {
        const { Handlebars } = SillyTavern.libs;
        compiledTemplates.set(name, Handlebars.compile(html));
    }
    return compiledTemplates.get(name)!;
}

export function renderTemplate(name: string, data: object): string {
    const template = compiledTemplates.get(name);
    if (!template) throw new Error(`Template not compiled: ${name}`);
    return template(data);
}

// Register common helpers
export function registerHelpers(): void {
    const { Handlebars, DOMPurify } = SillyTavern.libs;

    Handlebars.registerHelper(
        'sanitize',
        (value: string) => new Handlebars.SafeString(DOMPurify.sanitize(value)),
    );

    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    Handlebars.registerHelper('truncate', (value: string, length: number) =>
        value.length > length ? value.slice(0, length) + '...' : value,
    );

    Handlebars.registerHelper('formatTokens', (count: number) =>
        count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count),
    );
}
```

### Example Template Usage

```html
<!-- templates/preset/list-item.html -->
<div class="cr-preset-item" data-id="{{id}}">
    <div class="cr-preset-item__info">
        <span class="cr-preset-item__name">{{sanitize name}}</span>
        <span class="cr-preset-item__stage">{{stage}}</span>
    </div>
    <div class="cr-preset-item__actions">
        {{#if isDefault}}
        <span class="cr-preset-item__badge">Default</span>
        {{else}}
        <button class="cr-preset-item__edit" title="Edit">Edit</button>
        <button class="cr-preset-item__delete" title="Delete">Delete</button>
        {{/if}}
    </div>
</div>
```

```typescript
// Usage in component
const html = renderTemplate('preset/list-item', {
    id: preset.id,
    name: preset.name,
    stage: preset.stage,
    isDefault: preset.isDefault,
});
```

### Impact

- Cleaner separation of concerns
- Easier i18n support via ST's template system
- Reduced inline HTML strings in TypeScript

---

## Phase 4: Component Cleanup

### 4.1 Fix DOMPurify/hljs Bug (Critical)

**Problem**: DOMPurify strips hljs classes, breaking syntax highlighting

**Files**: All files using `DOMPurify.sanitize()` without config

**Solution**: Create centralized sanitization utility

```typescript
// src/shared/sanitize.ts
export function sanitize(html: string): string {
    const { DOMPurify } = SillyTavern.libs;
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'p',
            'br',
            'strong',
            'em',
            'b',
            'i',
            'u',
            'code',
            'pre',
            'ul',
            'ol',
            'li',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'blockquote',
            'a',
            'span',
            'div',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'hr',
            'del',
            'input',
            'label',
        ],
        ALLOWED_ATTR: [
            'class',
            'href',
            'target',
            'rel',
            'type',
            'checked',
            'disabled',
            'id',
            'for',
        ],
    });
}

export function sanitizeStrict(html: string): string {
    const { DOMPurify } = SillyTavern.libs;
    return DOMPurify.sanitize(html); // No config = strip all
}
```

### 4.2 Evaluate Base Utilities

**Decision Point**: Keep or remove `$`/`$$` helpers from `base.ts`

- **Keep**: They're thin wrappers, useful for consistency
- Consider renaming for clarity: `select()` / `selectAll()`

---

## Implementation Order

1. **Phase 1 (Formatter)** - Lowest risk, immediate LOC savings
2. **Phase 4.1 (DOMPurify fix)** - Critical bug fix
3. **Phase 2 (Drawers)** - Medium complexity, good savings
4. **Phase 3 (Templates)** - Highest complexity, do incrementally

---

## Risk Assessment

| Phase     | Risk                           | Mitigation                       |
| --------- | ------------------------------ | -------------------------------- |
| Formatter | Medium - Changes output format | Test all stage outputs visually  |
| Drawers   | Low - Internal refactor        | Keep existing API surface        |
| Templates | Medium - New async loading     | Fallback to inline if load fails |
| Cleanup   | Low - Bug fix                  | Unit test sanitization           |

---

## Testing Strategy

1. **Visual regression**: Compare formatted outputs before/after
2. **Unit tests**: Sanitization, template rendering
3. **Integration**: Full pipeline execution
4. **Manual**: All drawer interactions, keyboard navigation

---

## Files Summary

### Delete (6 files, ~1,071 LOC)

- `src/ui/formatter/markdown-parser.ts`
- `src/ui/formatter/json-renderer.ts`
- `src/ui/formatter/section-renderer.ts`
- `src/ui/formatter/helpers.ts`
- `src/ui/formatter/types.ts`

### Create (4 files, ~450 LOC)

- `src/ui/components/drawer-base/index.ts`
- `src/ui/templates/index.ts`
- `src/shared/sanitize.ts`
- `templates/*.html` (multiple)

### Modify (8 files)

- `src/ui/formatter/index.ts` - Simplify to showdown
- `src/ui/components/preset-drawer/*` - Use drawer-base
- `src/ui/components/settings-drawer/*` - Use drawer-base
- `src/ui/popup.ts` - Load templates async

---

## Total Impact

- **LOC Removed**: ~2,000
- **LOC Added**: ~600
- **Net Savings**: ~1,400 LOC (13% of UI layer)
- **Complexity Reduction**: Significant - leveraging battle-tested ST libs
