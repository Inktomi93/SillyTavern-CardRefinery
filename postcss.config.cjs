/**
 * PostCSS Configuration
 *
 * Plugins:
 * - postcss-import: Resolves @import statements, enabling modular CSS architecture
 * - postcss-nested: Enables Sass-like nesting (cleaner BEM syntax)
 * - postcss-custom-media: Custom media query variables for consistent breakpoints
 * - autoprefixer: Adds vendor prefixes based on browserslist
 * - cssnano: Production minification (conditional)
 */
module.exports = (ctx) => ({
    plugins: {
        'postcss-import': {},
        'postcss-nested': {},
        'postcss-custom-media': {},
        autoprefixer: {},
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
