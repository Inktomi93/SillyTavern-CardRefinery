# CSS Conventions

## Architecture Overview

The CSS uses a **PostCSS-powered modular architecture** with the following structure:

```
src/styles/
├── index.css              # Main entry point with @import statements
├── _variables.css         # Design tokens (scoped under .cr-popup, etc.)
├── _base.css              # Base reset & typography
├── _utilities.css         # Layout primitives & utility classes
├── _responsive.css        # Responsive & accessibility overrides
└── components/
    ├── _popup.css         # Main popup container
    ├── _header.css        # Header with character selector
    ├── _toolbar.css       # Toolbar with stage tabs
    ├── _stage-tabs.css    # Stage navigation tabs
    ├── _dropdown.css      # Character/session dropdowns
    ├── _character-option.css
    ├── _session-option.css
    ├── _layout.css        # Body, panels, sections, cards
    ├── _tabs.css          # Generic tabs
    ├── _list.css          # List items and empty states
    ├── _field-list.css    # Field checkboxes
    ├── _forms.css         # Form controls
    ├── _buttons.css       # Button variants
    ├── _results-panel.css # Results display
    ├── _compare-view.css  # Diff comparison
    ├── _json-render.css   # Structured output rendering
    ├── _alerts.css        # Alert messages
    ├── _badges.css        # Badge variants
    ├── _loading.css       # Loading indicators
    ├── _history.css       # History panel
    ├── _preview.css       # Preview content
    ├── _api-status.css    # API status badge
    ├── _drawer.css        # Slideout drawer
    ├── _settings-modal.css  # Settings components (used in drawer)
    ├── _form-shared.css   # Shared form elements
    └── _panel.css         # Extension panel
```

## PostCSS Features Used

1. **postcss-import** - Module bundling via `@import`
2. **postcss-nested** - Sass-like nesting for cleaner BEM syntax
3. **postcss-custom-media** - Custom media query variables (`--mobile`, `--desktop`)
4. **autoprefixer** - Vendor prefix automation
5. **cssnano** - Production minification (preserves CSS variables)

## Custom Media Queries

Defined in `_variables.css`:

```css
@custom-media --mobile (max-width: 768px);
@custom-media --tablet (max-width: 900px);
@custom-media --desktop (min-width: 769px);
@custom-media --reduced-motion (prefers-reduced-motion: reduce);
@custom-media --high-contrast (prefers-contrast: high);
```

## PostCSS Nested Syntax

Use nested selectors for BEM:

```css
.cr-dropdown {
    /* Base styles */

    &--open {
        /* Modifier */
    }
    &__trigger {
        /* Element */
    }

    &:hover {
        /* Pseudo-class */
    }
}
```

## Design System Architecture

1. Design Tokens (CSS Variables) - Inherit from ST SmartTheme
2. Base Reset & Typography
3. Layout Primitives - `.cr-stack`, `.cr-row`, `.cr-grid`
4. Component Styles - BEM-namespaced with `cr-` prefix
5. Responsive Overrides - Mobile-first with 768px breakpoint

## Naming Convention

- All classes prefixed with `cr-` (CardRefinery)
- BEM naming: `.cr-component`, `.cr-component__element`, `.cr-component--modifier`
- Utility classes: `.cr-text-muted`, `.cr-flex-1`, etc.
- CSS_PREFIX constant defined in `src/shared/constants.ts` for easy updates

## Button Pattern

Button modifiers extend ST's `.menu_button` using `:is()` for consolidated selectors:

```css
:is(.cr-popup, .cr-drawer) .menu_button {
    /* Base normalization */
}
```

Available modifiers:

- `.menu_button--primary` - Accent colored action button
- `.menu_button--danger` - Red/danger button
- `.menu_button--icon` - Icon-only square button
- `.menu_button--sm` / `--lg` - Size variants
- `.menu_button--full` - Full width
- `.menu_button--ghost` - Transparent background
- `.cr-active` - Active/toggle state
