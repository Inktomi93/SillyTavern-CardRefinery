/**
 * PostCSS Configuration
 *
 * Plugins:
 * - postcss-import: Resolves @import statements, enabling modular CSS architecture
 * - postcss-nested: Enables Sass-like nesting (cleaner BEM syntax)
 * - postcss-custom-media: Custom media query variables for consistent breakpoints
 * - autoprefixer: Adds vendor prefixes based on browserslist
 * - postcss-prefix-selector: Available for CSS scoping/isolation if needed
 * - cssnano: Production minification (conditional)
 *
 * CSS Prefix System:
 * - All classes use 'cr-' prefix (CardRefinery)
 * - Defined in src/shared/constants.ts as CSS_PREFIX
 * - To change: update constant + find-replace in src/styles/ and src/ui/
 */
module.exports = (ctx) => ({
    plugins: {
        'postcss-import': {},
        'postcss-nested': {},
        'postcss-custom-media': {},
        autoprefixer: {},
        // postcss-prefix-selector is available for CSS isolation if needed:
        // 'postcss-prefix-selector': {
        //     prefix: '.cardrefinery-scope',
        //     transform: (prefix, selector) => {
        //         // Don't prefix :root or already-scoped selectors
        //         if (selector.startsWith(':root') || selector.includes(prefix)) {
        //             return selector;
        //         }
        //         return `${prefix} ${selector}`;
        //     },
        // },
        ...(ctx.env === 'production'
            ? {
                  cssnano: {
                      preset: [
                          'default',
                          {
                              // Preserve CSS custom properties (ST theming)
                              cssDeclarationSorter: false,
                              calc: false,
                          },
                      ],
                  },
              }
            : {}),
    },
});
