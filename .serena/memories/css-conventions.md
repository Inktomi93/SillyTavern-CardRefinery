# CSS Conventions

## Architecture Overview

The CSS uses a **PostCSS-powered modular architecture** with the following structure:

```
src/styles/
├── index.css                 # Main entry point with @import statements
├── _variables.css            # Design tokens (scoped under .cr-popup, etc.)
├── _base.css                 # Base reset & typography
├── _utilities.css            # Layout primitives & utility classes
├── _responsive.css           # Responsive & accessibility overrides
└── components/               # 25+ BEM-namespaced component styles
    ├── _popup.css            # Main popup container
    ├── _header.css           # Header with character selector
    ├── _toolbar.css          # Toolbar with stage tabs
    ├── _stage-tabs.css       # Stage navigation tabs
    ├── _dropdown.css         # Generic dropdowns
    ├── _character-option.css # Character list items
    ├── _session-option.css   # Session list items
    ├── _layout.css           # Body, panels, sections, cards
    ├── _tabs.css             # Generic tabs
    ├── _list.css             # List items and empty states
    ├── _field-list.css       # Field checkboxes
    ├── _forms.css            # Form controls
    ├── _form-shared.css      # Shared form elements
    ├── _buttons.css          # Button variants
    ├── _results-panel.css    # Results display
    ├── _compare-view.css     # Diff comparison
    ├── _json-render.css      # Structured output rendering
    ├── _alerts.css           # Alert messages
    ├── _badges.css           # Badge variants
    ├── _loading.css          # Loading indicators
    ├── _history.css          # History panel
    ├── _preview.css          # Preview content
    ├── _api-status.css       # API status badge
    ├── _drawer.css           # Slideout drawer base
    ├── _settings-modal.css   # Settings components (used in drawer)
    ├── _apply-dialog.css     # Apply suggestions dialog
    └── _panel.css            # Extension panel
```

## PostCSS Features Used

1. **postcss-import** - Module bundling via `@import`
2. **postcss-nested** - Sass-like nesting for cleaner BEM syntax
3. **postcss-custom-media** - Custom media query variables
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

Usage:

```css
@media (--mobile) {
    .cr-popup {
        width: 100%;
    }
}
```

## PostCSS Nested Syntax

Use nested selectors for BEM:

```css
.cr-dropdown {
    /* Base styles */

    &--open {
        /* Modifier: .cr-dropdown--open */
    }

    &__trigger {
        /* Element: .cr-dropdown__trigger */
    }

    &:hover {
        /* Pseudo-class */
    }

    @media (--mobile) {
        /* Responsive override */
    }
}
```

## Design System Architecture

1. **Design Tokens** (CSS Variables) - Inherit from ST SmartTheme
2. **Base Reset & Typography** - Normalize and defaults
3. **Layout Primitives** - `.cr-stack`, `.cr-row`, `.cr-grid`
4. **Component Styles** - BEM-namespaced with `cr-` prefix
5. **Responsive Overrides** - Mobile-first with 768px breakpoint

## Naming Convention

- All classes prefixed with `cr-` (CardRefinery)
- BEM naming: `.cr-component`, `.cr-component__element`, `.cr-component--modifier`
- Utility classes: `.cr-text-muted`, `.cr-flex-1`, `.cr-gap-2`, etc.
- CSS_PREFIX constant defined in `src/shared/constants.ts` for easy updates

## Design Tokens

Tokens are scoped to CardRefinery containers and inherit from SmartTheme:

```css
:is(.cr-popup, .cr-drawer, .cr-panel) {
    /* Colors */
    --cr-bg-primary: var(--SmartThemeBotMesBlurTintColor);
    --cr-bg-secondary: var(--SmartThemeBlurTintColor);
    --cr-border: var(--SmartThemeBorderColor);
    --cr-text: var(--SmartThemeBodyColor);
    --cr-text-muted: color-mix(in srgb, var(--cr-text) 60%, transparent);
    --cr-accent: var(--SmartThemeQuoteColor);

    /* Spacing */
    --cr-space-xs: 4px;
    --cr-space-sm: 8px;
    --cr-space-md: 12px;
    --cr-space-lg: 16px;
    --cr-space-xl: 24px;

    /* Borders */
    --cr-radius-sm: 4px;
    --cr-radius-md: 8px;
    --cr-radius-lg: 12px;
}
```

## Button Pattern

Button modifiers extend ST's `.menu_button` using `:is()` for consolidated selectors:

```css
:is(.cr-popup, .cr-drawer) .menu_button {
    /* Base normalization */
    display: inline-flex;
    align-items: center;
    gap: var(--cr-space-xs);
}
```

### Available Modifiers

| Modifier                | Purpose                      |
| ----------------------- | ---------------------------- |
| `.menu_button--primary` | Accent colored action button |
| `.menu_button--danger`  | Red/danger button            |
| `.menu_button--icon`    | Icon-only square button      |
| `.menu_button--sm`      | Small size variant           |
| `.menu_button--lg`      | Large size variant           |
| `.menu_button--full`    | Full width button            |
| `.menu_button--ghost`   | Transparent background       |
| `.cr-active`            | Active/toggle state          |

## Layout Primitives

```css
/* Vertical stack with gap */
.cr-stack {
    display: flex;
    flex-direction: column;
    gap: var(--cr-space-md);
}

/* Horizontal row with gap */
.cr-row {
    display: flex;
    gap: var(--cr-space-sm);
    align-items: center;
}

/* CSS Grid with auto columns */
.cr-grid {
    display: grid;
    gap: var(--cr-space-md);
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
```

## Common Utilities

```css
.cr-text-muted {
    color: var(--cr-text-muted);
}
.cr-text-sm {
    font-size: 0.875rem;
}
.cr-flex-1 {
    flex: 1;
}
.cr-gap-2 {
    gap: var(--cr-space-sm);
}
.cr-mt-2 {
    margin-top: var(--cr-space-sm);
}
.cr-hidden {
    display: none !important;
}
.cr-truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
```

## Accessibility

- Reduced motion support via `--reduced-motion` media query
- High contrast mode via `--high-contrast` media query
- Focus indicators inherit from SmartTheme
- Semantic color usage for states

## To Change the CSS Prefix

1. Update `CSS_PREFIX` in `src/shared/constants.ts`
2. Find-replace in `src/styles/` and `src/ui/`: `cr-` → new prefix
3. Update `_variables.css` root selectors
