# CardRefinery

AI-powered character card refinement for SillyTavern. Pipeline: Score → Rewrite → Analyze.

## Architecture

```
src/
├── index.ts      # Entry point (APP_READY)
├── styles/       # CSS (BEM with cr- prefix)
├── shared/       # ST API, logging, utilities
├── types/        # TypeScript interfaces
├── data/         # Settings, sessions, presets
├── state/        # Observable store, actions
├── domain/       # Generation, schema, pipeline
└── ui/           # Popup, components
```

For ST API types: `globals.d.ts`. For patterns: `CLAUDE.md`.

## Commands

```bash
# Development
npm run dev           # Watch mode
npm run build         # Production build

# Quality
npm run check         # ALL checks (typecheck + lint + format)
npm run fix           # ALL auto-fixes
npm run test          # Run tests

# Git
npm run git:status    # Branch status
npm run git:promote   # Merge dev → main

# Version
npm run version:sync  # Sync across files
```

Pre-commit hook runs: checks → tests → version sync → build → stage artifacts.
