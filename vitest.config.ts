/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        // Use happy-dom for fast, lightweight DOM simulation
        environment: 'happy-dom',

        // Global setup file - mocks SillyTavern APIs
        setupFiles: ['./tests/setup.ts'],

        // Test file patterns
        include: ['tests/**/*.test.ts'],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/types/**', 'src/**/*.d.ts', 'src/index.ts'],
        },

        // TypeScript handling
        typecheck: {
            enabled: false, // We already have npm run typecheck
            tsconfig: './tsconfig.test.json',
        },
    },

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
