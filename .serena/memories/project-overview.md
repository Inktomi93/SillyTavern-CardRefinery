# CardRefinery - Project Overview

## Purpose
A SillyTavern extension for AI-powered character card scoring, rewriting, and refinement. Provides an iterative pipeline (Score → Rewrite → Analyze) that evaluates and improves character cards while preserving their "soul" (essential character identity).

## Tech Stack
- TypeScript (ES6 target, ESNext modules)
- Webpack for bundling
- ESLint + Prettier for code quality
- No external UI frameworks - vanilla TS with custom CSS

## Architecture
```
src/
├── index.ts          # Entry point, bootstraps on APP_READY
├── styles/           # CSS design system (BEM with cr- prefix)
├── shared/           # Constants, logging, ST API utilities
├── types/            # TypeScript interfaces
├── data/             # Persistence (settings, presets, IndexedDB storage)
├── state/            # Runtime popup state management
├── domain/           # Business logic (pipeline execution, generation)
└── ui/               # Presentation (popup, panel, components)
```

## Key Patterns
- BEM CSS with `cr-` prefix (CardRefinery), inheriting SillyTavern SmartTheme variables
- CSS_PREFIX constant in src/shared/constants.ts for easy prefix changes
- Components follow render/update/bind pattern
- Arrow functions for methods in classes (preserves `this` when destructured)
- Uses ST's bundled libs: DOMPurify, lodash, Fuse

## Related Memories

For SillyTavern API documentation, see these memories (source of truth):

| Memory | Contents |
|--------|----------|
| `st-context-api-map` | Complete `SillyTavern.getContext()` API reference (~100+ methods) |
| `st-bundled-libs` | Bundled libraries via `SillyTavern.libs` (lodash, Fuse, DOMPurify, etc.) |
| `st-modules-reference` | Core ST modules (events, popup, extensions, tokenizers, slash commands, etc.) |
| `css-conventions` | CSS design system and SmartTheme integration |
