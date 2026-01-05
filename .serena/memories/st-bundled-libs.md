# SillyTavern Bundled Libraries

> **Source of Truth** for `SillyTavern.libs` bundled libraries.
> See also: `st-context-api-map` (context API), `st-modules-reference` (core modules)

Reference for libraries bundled and exposed by SillyTavern via `/public/lib.js`.

## Access Pattern

```typescript
// Preferred: Access via SillyTavern.libs
const { lodash, DOMPurify, Fuse, localforage } = SillyTavern.libs;

// Legacy: Window globals (for old extensions)
window.Fuse, window.DOMPurify, window.hljs, etc.
```

## Available Libraries

### Data Manipulation

| Library  | Export Name | Description            | Docs                                          |
| -------- | ----------- | ---------------------- | --------------------------------------------- |
| `lodash` | `lodash`    | Utility library (v4.x) | [lodash.com](https://lodash.com)              |
| `yaml`   | `yaml`      | YAML parser/serializer | [eemeli/yaml](https://github.com/eemeli/yaml) |

### Search & Fuzzy Matching

| Library   | Export Name | Description          |
| --------- | ----------- | -------------------- |
| `fuse.js` | `Fuse`      | Fuzzy search library |

**Usage:**

```typescript
const fuse = new Fuse(items, { keys: ['name', 'description'], threshold: 0.3 });
const results = fuse.search(query);
```

### DOM & HTML

| Library              | Export Name   | Description                    |
| -------------------- | ------------- | ------------------------------ |
| `dompurify`          | `DOMPurify`   | HTML sanitization              |
| `morphdom`           | `morphdom`    | Efficient DOM diffing/patching |
| `@iconfu/svg-inject` | `SVGInject`   | Inline SVG injection           |
| `slidetoggle`        | `slideToggle` | CSS slide toggle animation     |

**DOMPurify Usage:**

```typescript
const clean = DOMPurify.sanitize(dirtyHtml, { USE_PROFILES: { html: true } });
```

**morphdom Usage:**

```typescript
morphdom(existingNode, newNode, {
    onBeforeElUpdated: (fromEl, toEl) => true, // return false to skip
});
```

### Code & Syntax

| Library        | Export Name  | Description                |
| -------------- | ------------ | -------------------------- |
| `highlight.js` | `hljs`       | Syntax highlighting        |
| `showdown`     | `showdown`   | Markdown to HTML converter |
| `handlebars`   | `Handlebars` | Template engine            |

### Date & Time

| Library  | Export Name | Description       |
| -------- | ----------- | ----------------- |
| `moment` | `moment`    | Date manipulation |

### Storage

| Library       | Export Name   | Description                           |
| ------------- | ------------- | ------------------------------------- |
| `localforage` | `localforage` | IndexedDB/WebSQL/localStorage wrapper |

**Usage:**

```typescript
await localforage.setItem('key', value);
const data = await localforage.getItem('key');
```

### CSS Tools

| Library            | Export Name | Description              |
| ------------------ | ----------- | ------------------------ |
| `@adobe/css-tools` | `css`       | CSS parsing/stringifying |

### Browser Detection

| Library  | Export Name | Description          |
| -------- | ----------- | -------------------- |
| `bowser` | `Bowser`    | Browser/OS detection |

**Usage:**

```typescript
const browser = Bowser.getParser(window.navigator.userAgent);
const isChrome = browser.satisfies({ chrome: '>90' });
```

### Text Processing

| Library                | Export Name                           | Description           |
| ---------------------- | ------------------------------------- | --------------------- |
| `diff-match-patch`     | `DiffMatchPatch`                      | Text diff/match/patch |
| `@mozilla/readability` | `Readability`, `isProbablyReaderable` | Article extraction    |

### Random & Math

| Library      | Export Name  | Description                    |
| ------------ | ------------ | ------------------------------ |
| `seedrandom` | `seedrandom` | Seeded random number generator |
| `droll`      | `droll`      | Dice rolling (D&D style)       |

**seedrandom Usage:**

```typescript
const rng = seedrandom('my-seed');
const randomValue = rng(); // 0-1, deterministic based on seed
```

**droll Usage:**

```typescript
const result = droll.roll('2d6+3'); // { total: 10, rolls: [4, 3] }
```

### UI Positioning

| Library          | Export Name | Description                 |
| ---------------- | ----------- | --------------------------- |
| `@popperjs/core` | `Popper`    | Tooltip/popover positioning |

### Parsing

| Library      | Export Name  | Description             |
| ------------ | ------------ | ----------------------- |
| `chevrotain` | `chevrotain` | Parser building toolkit |

### Styling

| Library | Export Name | Description             |
| ------- | ----------- | ----------------------- |
| `chalk` | `chalk`     | Terminal string styling |

## Window Globals (Legacy)

These are shimmed onto `window` for backward compatibility:

- `window.Fuse`
- `window.DOMPurify`
- `window.hljs`
- `window.localforage`
- `window.Handlebars`
- `window.diff_match_patch`
- `window.SVGInject`
- `window.showdown`
- `window.moment`
- `window.Popper`
- `window.droll`

## Commonly Used in Extensions

### Essential

1. **DOMPurify** - Always sanitize user/external HTML
2. **lodash** - Utility functions (debounce, throttle, cloneDeep, etc.)
3. **Fuse** - Fuzzy search for character/preset selection
4. **localforage** - Persistent storage (used by our session storage)

### UI Enhancement

5. **morphdom** - Efficient DOM updates without full re-render
6. **showdown** - Render markdown content
7. **hljs** - Syntax highlighting for code blocks

### Formatting

8. **moment** - Date/time formatting and manipulation
9. **yaml** - Parse/stringify YAML (for lorebook, etc.)

## Type Declarations

For TypeScript, you may need to add type declarations. Example in `globals.d.ts`:

```typescript
declare namespace SillyTavern {
    const libs: {
        lodash: typeof import('lodash');
        Fuse: typeof import('fuse.js');
        DOMPurify: typeof import('dompurify');
        hljs: typeof import('highlight.js');
        localforage: typeof import('localforage');
        Handlebars: typeof import('handlebars');
        css: typeof import('@adobe/css-tools');
        Bowser: typeof import('bowser');
        DiffMatchPatch: typeof import('diff-match-patch');
        Readability: (typeof import('@mozilla/readability'))['Readability'];
        isProbablyReaderable: (typeof import('@mozilla/readability'))['isProbablyReaderable'];
        SVGInject: typeof import('@iconfu/svg-inject');
        showdown: typeof import('showdown');
        moment: typeof import('moment');
        seedrandom: typeof import('seedrandom');
        Popper: typeof import('@popperjs/core');
        droll: typeof import('droll');
        morphdom: typeof import('morphdom');
        slideToggle: Function;
        chalk: typeof import('chalk');
        yaml: typeof import('yaml');
        chevrotain: typeof import('chevrotain');
    };
}
```
