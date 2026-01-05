/**
 * PostCSS Configuration
 *
 * Plugins:
 * - postcss-import: Resolves @import statements, enabling modular CSS architecture
 * - postcss-nested: Enables Sass-like nesting (cleaner BEM syntax)
 * - postcss-custom-media: Custom media query variables for consistent breakpoints
 * - autoprefixer: Adds vendor prefixes based on browserslist
 * - purgecss: Removes unused CSS classes (production only)
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

        // PurgeCSS - remove unused CSS classes in production
        // Uses custom extractor to handle template literals correctly
        ...(ctx.env === 'production'
            ? {
                  '@fullhuman/postcss-purgecss': {
                      // Scan TypeScript source files for class usage
                      content: ['./src/**/*.ts'],

                      // Custom extractor: avoids the backtick bug in default extractor
                      // See: https://github.com/FullHuman/purgecss/issues/83
                      defaultExtractor: (content) => {
                          // Match word characters, hyphens, underscores (common in class names)
                          // Excludes backticks which break the default [A-Za-z] regex
                          return content.match(/[a-zA-Z0-9_-]+/g) || [];
                      },

                      // Safelist: classes we use but don't define (from SillyTavern or libraries)
                      safelist: {
                          // Exact matches
                          standard: [
                              // SillyTavern layout classes
                              'flex-container',
                              'flexFlowColumn',
                              'text_pole',
                              'down',
                              // Highlight.js
                              'hljs',
                              'language-json',
                          ],
                          // Regex patterns
                          deep: [
                              // SillyTavern menu buttons (menu_button, menu_button--sm, etc.)
                              /^menu_button/,
                              // SillyTavern drawer components
                              /^inline-drawer/,
                              // Font Awesome icons
                              /^fa-/,
                              // Dynamic state classes (--active, --disabled, --loading, etc.)
                              /--active$/,
                              /--disabled$/,
                              /--loading$/,
                              /--expanded$/,
                              /--collapsed$/,
                              /--selected$/,
                              /--error$/,
                              /--success$/,
                              /--warning$/,
                          ],
                      },

                      // Uncomment to debug: logs rejected selectors
                      // rejected: true,
                  },
              }
            : {}),

        // cssnano - minification (after PurgeCSS in production)
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
