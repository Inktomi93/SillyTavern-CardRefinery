// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', '*.config.*', '*.d.ts'],
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
];
