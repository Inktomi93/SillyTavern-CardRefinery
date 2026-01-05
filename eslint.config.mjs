// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import html from '@html-eslint/eslint-plugin';
import globals from 'globals';

export default [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**',
            '*.config.*',
            '*.d.ts',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettierRecommended,
    {
        languageOptions: {
            globals: {
                /* browser globals if needed */
            },
        },
    },
    // Node.js scripts
    {
        files: ['scripts/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    // Test files
    {
        files: ['tests/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        rules: {
            'prefer-const': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
            'no-control-regex': 'off',
            'no-constant-condition': ['error', { checkLoops: false }],
            'require-yield': 'off',
            'no-unused-expressions': [
                'error',
                { allowShortCircuit: true, allowTernary: true },
            ],
            'no-cond-assign': 'error',
            'no-unneeded-ternary': 'error',
        },
    },
    // HTML linting for standalone HTML files
    {
        files: ['**/*.html'],
        plugins: { html },
        language: 'html/html',
        rules: {
            ...html.configs.recommended.rules,
            'html/require-img-alt': 'error',
            'html/no-duplicate-class': 'error',
            'html/require-closing-tags': 'error',
            'html/no-duplicate-id': 'error',
        },
    },
    // HTML linting for template literals in TypeScript files
    // Detects html`...` tagged templates and /* html */ `...` comments
    {
        files: ['src/**/*.ts'],
        plugins: { html },
        rules: {
            // =================================================================
            // Accessibility (a11y) - comprehensive ruleset
            // =================================================================
            'html/require-img-alt': 'error', // Images must have alt text
            'html/require-button-type': 'error', // Buttons must specify type
            'html/require-frame-title': 'error', // iframes must have title
            'html/no-abstract-roles': 'error', // No abstract ARIA roles
            'html/no-accesskey-attrs': 'error', // accesskey causes a11y issues
            'html/no-aria-hidden-on-focusable': 'error', // Don't hide focusable elements
            'html/no-positive-tabindex': 'error', // tabindex > 0 breaks tab order
            'html/no-skip-heading-levels': 'warn', // h1 -> h3 skips h2
            'html/no-invalid-role': 'error', // Only valid ARIA roles

            // =================================================================
            // Best practices
            // =================================================================
            'html/no-duplicate-id': 'error',
            'html/no-duplicate-class': 'warn',
            'html/require-closing-tags': ['error', { selfClosing: 'always' }],
            'html/no-extra-spacing-attrs': 'warn',

            // Disabled: these conflict with our template fragment patterns
            // 'html/require-doctype': 'off',
            // 'html/require-title': 'off',
        },
    },
];
