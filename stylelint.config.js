/** @type {import('stylelint').Config} */
export default {
    extends: ['stylelint-config-standard'],
    customSyntax: 'postcss-syntax',
    rules: {
        // Allow PostCSS nested syntax
        'selector-nested-pattern': null,

        // Allow CSS custom properties (design tokens)
        'custom-property-pattern': null,

        // Allow BEM-style class naming (cr-block__element--modifier)
        // Also allow: sr-only, menu_button variants, and ST's underscore conventions
        'selector-class-pattern': [
            '^(sr-only|menu_button[_a-z0-9-]*|[a-z][a-z0-9]*(_[a-z0-9]+)*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?)$',
            {
                message:
                    'Expected class selector to be BEM format or ST utility class',
            },
        ],

        // Allow empty source files (partial imports)
        'no-empty-source': null,

        // Relax for PostCSS nesting
        'no-descending-specificity': null,

        // Allow @import at-rules (PostCSS-import handles these)
        'import-notation': null,

        // Allow custom media queries
        'media-query-no-invalid': null,

        // Allow SillyTavern's CSS variable conventions
        'value-keyword-case': [
            'lower',
            {
                ignoreKeywords: ['currentColor'],
                ignoreFunctions: ['var'],
            },
        ],

        // Consistent spacing
        'declaration-block-single-line-max-declarations': 1,

        // Allow vendor prefixes (autoprefixer adds these)
        'property-no-vendor-prefix': null,
        'value-no-vendor-prefix': null,

        // Allow utility class groupings without empty lines
        'rule-empty-line-before': [
            'always',
            {
                except: ['first-nested'],
                ignore: ['after-comment', 'inside-block'],
            },
        ],

        // Allow rgba() syntax (broader compatibility)
        'color-function-notation': null,
        'color-function-alias-notation': null,

        // Allow decimal alpha values (0.3 vs 30%)
        'alpha-value-notation': null,

        // Allow either media feature notation
        'media-feature-range-notation': null,

        // Allow `clip` property (still widely used for screen readers)
        'property-no-deprecated': null,

        // Allow `break-word` keyword (deprecated but still widely needed)
        'declaration-property-value-keyword-no-deprecated': null,

        // Don't flag CSS custom properties in selectors
        'selector-type-no-unknown': [
            true,
            {
                ignore: ['custom-elements'],
                ignoreTypes: [/^--/], // CSS custom properties
            },
        ],
    },
    ignoreFiles: ['dist/**', 'node_modules/**'],
};
