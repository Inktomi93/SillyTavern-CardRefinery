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

## Version Management
```bash
npm run version:sync        # Sync version across package.json, manifest.json, constants.ts
npm run version:check       # Verify all versions match
npm run version:sync 2.0.0  # Set specific version everywhere
```

## Branch Management
```bash
npm run git:status    # Show branch status and pending commits
npm run git:switch    # Toggle between main and dev branches
npm run git:sync      # Rebase dev on main (keeps dev up to date)
npm run git:promote   # Merge dev into main (local + push)
```

## Pre-commit Hook (automatic)
On every `git commit`, the pre-commit hook automatically:
1. Syncs versions from package.json
2. Runs production build
3. Stages dist/, manifest.json, and constants.ts

## Testing
After running `npm run build`, reload SillyTavern to test changes.
The build outputs to `dist/index.js`.

## Release Workflow
1. Work on `dev` branch
2. Run `npm run git:status` to see pending commits
3. Run `npm run git:promote` to merge into main
4. Go to GitHub Actions → Release → Choose bump type (patch/minor/major)

## Related Memories

| Memory | Contents |
|--------|----------|
| `project-overview` | Project architecture and patterns |
| `css-conventions` | CSS design system with cr- prefix |
| `st-context-api-map` | SillyTavern API reference |
| `st-bundled-libs` | Available bundled libraries |
| `st-modules-reference` | Core ST modules reference |
