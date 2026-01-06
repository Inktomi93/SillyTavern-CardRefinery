/**
 * Shared Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { generateUniqueName } from '../../src/shared';
import { hasContent, hashString } from '../../src/shared/utils';

describe('generateUniqueName', () => {
    it('returns base name if unique', () => {
        const result = generateUniqueName('My Preset', ['Score', 'Rewrite']);
        expect(result).toBe('My Preset');
    });

    it('returns base name for empty list', () => {
        const result = generateUniqueName('Test', []);
        expect(result).toBe('Test');
    });

    it('appends (2) for first duplicate', () => {
        const result = generateUniqueName('Test', ['Test']);
        expect(result).toBe('Test (2)');
    });

    it('increments counter for multiple duplicates', () => {
        const result = generateUniqueName('Test', [
            'Test',
            'Test (2)',
            'Test (3)',
        ]);
        expect(result).toBe('Test (4)');
    });

    it('handles gaps in counter sequence', () => {
        // If "Test (2)" doesn't exist, it should use (2)
        const result = generateUniqueName('Test', ['Test', 'Test (3)']);
        expect(result).toBe('Test (2)');
    });

    it('is case-insensitive', () => {
        const result = generateUniqueName('test', ['TEST', 'Test (2)']);
        expect(result).toBe('test (3)');
    });

    it('handles mixed case duplicates', () => {
        const result = generateUniqueName('Score', ['score', 'SCORE (2)']);
        expect(result).toBe('Score (3)');
    });
});

describe('hasContent', () => {
    it('returns true for non-empty string', () => {
        expect(hasContent('hello')).toBe(true);
    });

    it('returns false for empty string', () => {
        expect(hasContent('')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
        expect(hasContent('   ')).toBe(false);
    });

    it('returns false for null', () => {
        expect(hasContent(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(hasContent(undefined)).toBe(false);
    });
});

describe('hashString', () => {
    it('returns consistent hash for same input', () => {
        const hash1 = hashString('test');
        const hash2 = hashString('test');
        expect(hash1).toBe(hash2);
    });

    it('returns different hash for different input', () => {
        const hash1 = hashString('test1');
        const hash2 = hashString('test2');
        expect(hash1).not.toBe(hash2);
    });

    it('returns non-empty string', () => {
        const hash = hashString('anything');
        expect(hash.length).toBeGreaterThan(0);
    });
});
