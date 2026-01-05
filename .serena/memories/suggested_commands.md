# Suggested Commands

## Development Workflow
```bash
npm run dev           # Watch mode - rebuilds on file changes
npm run build         # Production build (minified)
npm run clean         # Remove dist/ folder
npm run rebuild       # Clean + build in sequence
```

## Code Quality - Quick Commands
```bash
npm run check         # Run ALL checks (typecheck + lint + format:check)
npm run fix           # Run ALL auto-fixes (lint:fix + format)
```

## Code Quality - Individual Commands
```bash
npm run typecheck     # TypeScript type checking (no emit)
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier format (writes files)
npm run format:check  # Prettier check (read-only)
```

## Testing
After running `npm run build`, reload SillyTavern to test changes.
The build outputs to `dist/index.js`.

## Related Memories

| Memory | Contents |
|--------|----------|
| `project-overview` | Project architecture and patterns |
| `css-conventions` | CSS design system |
| `st-context-api-map` | SillyTavern API reference |
| `st-bundled-libs` | Available bundled libraries |
| `st-modules-reference` | Core ST modules reference |
