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
npm run check         # Run ALL checks (typecheck + lint + lint:css + format:check)
npm run fix           # Run ALL auto-fixes (lint:fix + lint:css:fix + format)
```

## Code Quality - Individual Commands

```bash
npm run typecheck     # TypeScript type checking (no emit)
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run lint:css      # Stylelint check
npm run lint:css:fix  # Stylelint auto-fix
npm run format        # Prettier format (writes files)
npm run format:check  # Prettier check (read-only)
```

## Testing

```bash
npm run test          # Run all tests with Vitest
npm run test:watch    # Watch mode for tests
npm run test:coverage # Run tests with coverage report
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

1. Runs all checks (typecheck, lint, lint:css, format:check)
2. Runs tests
3. Syncs versions from package.json
4. Runs production build
5. Stages dist/, manifest.json, and constants.ts

## Local Development

After running `npm run build`, reload SillyTavern to test changes.
The build outputs to `dist/index.js`.

## Release Workflow

1. Work on `dev` branch
2. Run `npm run git:status` to see pending commits
3. Run `npm run git:promote` to merge into main
4. Go to GitHub Actions → Release → Choose bump type (patch/minor/major)

## Common Workflows

### Starting a new feature

```bash
git checkout dev
npm run git:sync      # Ensure dev is up to date with main
# Make changes...
npm run check         # Verify before commit
git add .
git commit -m "feat: description"
```

### Fixing a bug

```bash
git checkout dev
# Make fix...
npm run test          # Ensure tests pass
npm run check         # Verify code quality
git add .
git commit -m "fix: description"
```

### Reviewing before release

```bash
npm run git:status    # See what will be released
npm run test:coverage # Ensure test coverage
npm run git:promote   # Merge to main and push
```

## Related Memories

| Memory                 | Contents                          |
| ---------------------- | --------------------------------- |
| `project-overview`     | Project architecture and patterns |
| `css-conventions`      | CSS design system with cr- prefix |
| `st-context-api-map`   | SillyTavern API reference         |
| `st-bundled-libs`      | Available bundled libraries       |
| `st-modules-reference` | Core ST modules reference         |
