/**
 * Template Processing Tests
 *
 * Tests for the custom template system that handles:
 * - Placeholder substitution ({{variable}})
 * - Conditional blocks ({{#if variable}}...{{/if}})
 * - ST macro escaping/unescaping (preventing {{user}} replacement)
 */

import { describe, it, expect, vi } from 'vitest';

// Mock shared module to avoid circular dependencies
vi.mock('../../src/shared', async () => {
    const actual = await vi.importActual('../../src/shared');
    return {
        ...actual,
        log: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    };
});

import {
    processTemplate,
    processConditionalBlocks,
    detectPlaceholders,
    detectConditionals,
    hasTemplateMarkers,
    escapeSTMacros,
    unescapeSTMacros,
    replaceCharMacro,
    getUnfilledPlaceholders,
    buildContext,
} from '../../src/shared/templates';

// =============================================================================
// TESTS: processTemplate
// =============================================================================

describe('processTemplate', () => {
    it('replaces simple placeholders', () => {
        const result = processTemplate(
            'Hello {{name}}, your score is {{score}}.',
            { name: 'Alice', score: '95' },
        );

        expect(result).toBe('Hello Alice, your score is 95.');
    });

    it('handles case-insensitive placeholders', () => {
        const result = processTemplate('{{NAME}} - {{Name}} - {{name}}', {
            name: 'Test',
        });

        expect(result).toBe('Test - Test - Test');
    });

    it('leaves undefined placeholders unchanged', () => {
        const result = processTemplate('Hello {{name}}, {{unknown}} here', {
            name: 'Alice',
        });

        expect(result).toBe('Hello Alice, {{unknown}} here');
    });

    it('respects passthrough option', () => {
        const result = processTemplate(
            '{{user}} said to {{char}}: Hello!',
            { user: 'REPLACED', char: 'REPLACED' },
            { passthrough: ['user'] },
        );

        expect(result).toBe('{{user}} said to REPLACED: Hello!');
    });

    it('processes conditional blocks before placeholders', () => {
        const template = `
{{#if score}}Score: {{score}}{{/if}}
{{#if notes}}Notes: {{notes}}{{/if}}
`;
        const result = processTemplate(template, { score: '95' });

        expect(result).toContain('Score: 95');
        expect(result).not.toContain('Notes:');
        expect(result).not.toContain('{{notes}}');
    });

    it('handles empty context', () => {
        const result = processTemplate('Hello {{name}}!', {});

        expect(result).toBe('Hello {{name}}!');
    });

    it('handles multiple occurrences of same placeholder', () => {
        const result = processTemplate(
            '{{char}} loves {{char}} because {{char}} is great',
            { char: 'Alice' },
        );

        expect(result).toBe('Alice loves Alice because Alice is great');
    });
});

// =============================================================================
// TESTS: processConditionalBlocks
// =============================================================================

describe('processConditionalBlocks', () => {
    it('includes block when variable has value', () => {
        const result = processConditionalBlocks(
            '{{#if name}}Hello {{name}}{{/if}}',
            { name: 'Alice' },
        );

        expect(result).toBe('Hello {{name}}');
    });

    it('excludes block when variable is missing', () => {
        const result = processConditionalBlocks(
            '{{#if missing}}Should not appear{{/if}}',
            {},
        );

        expect(result).toBe('');
    });

    it('excludes block when variable is empty string', () => {
        const result = processConditionalBlocks(
            '{{#if empty}}Should not appear{{/if}}',
            { empty: '' },
        );

        expect(result).toBe('');
    });

    it('excludes block when variable is whitespace only', () => {
        const result = processConditionalBlocks(
            '{{#if spaces}}Should not appear{{/if}}',
            { spaces: '   ' },
        );

        expect(result).toBe('');
    });

    it('handles multiple conditional blocks', () => {
        const template = `
{{#if a}}Block A{{/if}}
{{#if b}}Block B{{/if}}
{{#if c}}Block C{{/if}}
`;
        const result = processConditionalBlocks(template, {
            a: 'yes',
            c: 'yes',
        });

        expect(result).toContain('Block A');
        expect(result).not.toContain('Block B');
        expect(result).toContain('Block C');
    });

    it('handles multiline content in blocks', () => {
        const template = `{{#if content}}
Line 1
Line 2
Line 3
{{/if}}`;
        const result = processConditionalBlocks(template, { content: 'yes' });

        expect(result).toContain('Line 1');
        expect(result).toContain('Line 2');
        expect(result).toContain('Line 3');
    });

    it('handles case-insensitive variable names', () => {
        const result = processConditionalBlocks('{{#if NAME}}Has name{{/if}}', {
            name: 'yes',
        });

        expect(result).toBe('Has name');
    });
});

// =============================================================================
// TESTS: escapeSTMacros / unescapeSTMacros
// =============================================================================

describe('escapeSTMacros', () => {
    const ZWSP = '\u200B';

    it('escapes default macros (user, persona, original, input)', () => {
        const input = '{{user}} met {{persona}} using {{input}}';
        const result = escapeSTMacros(input);

        expect(result).toBe(
            `{{${ZWSP}user${ZWSP}}} met {{${ZWSP}persona${ZWSP}}} using {{${ZWSP}input${ZWSP}}}`,
        );
    });

    it('handles case-insensitive macro names', () => {
        const result = escapeSTMacros('{{USER}} and {{User}} and {{user}}');

        // All should be escaped
        expect(result).not.toContain('{{user}}');
        expect(result).not.toContain('{{USER}}');
        expect(result).not.toContain('{{User}}');
    });

    it('does not escape non-default macros', () => {
        const result = escapeSTMacros('{{char}} and {{custom}}');

        expect(result).toBe('{{char}} and {{custom}}');
    });

    it('escapes custom macro list when provided', () => {
        const result = escapeSTMacros('{{char}} and {{user}}', ['char']);

        expect(result).toBe(`{{${ZWSP}char${ZWSP}}} and {{user}}`);
    });

    it('handles empty string', () => {
        expect(escapeSTMacros('')).toBe('');
    });

    it('handles null/undefined gracefully', () => {
        expect(escapeSTMacros(null as unknown as string)).toBe(null);
        expect(escapeSTMacros(undefined as unknown as string)).toBe(undefined);
    });

    it('escaped text does not match ST macro pattern', () => {
        // This is the CRITICAL test - escaped macros should NOT match ST's pattern
        const ST_MACRO_REGEX = /\{\{(\w+)\}\}/g;

        const escaped = escapeSTMacros('{{user}} said hello');
        const matches = escaped.match(ST_MACRO_REGEX);

        // ZWSP is not a word character, so \w+ won't match
        expect(matches).toBeNull();
    });
});

describe('unescapeSTMacros', () => {
    const ZWSP = '\u200B';

    it('removes ZWSP from escaped macros', () => {
        const escaped = `{{${ZWSP}user${ZWSP}}} met {{${ZWSP}char${ZWSP}}}`;
        const result = unescapeSTMacros(escaped);

        expect(result).toBe('{{user}} met {{char}}');
    });

    it('handles empty string', () => {
        expect(unescapeSTMacros('')).toBe('');
    });

    it('handles null/undefined gracefully', () => {
        expect(unescapeSTMacros(null as unknown as string)).toBe(null);
        expect(unescapeSTMacros(undefined as unknown as string)).toBe(
            undefined,
        );
    });

    it('does not affect unescaped macros', () => {
        const result = unescapeSTMacros('{{user}} stays {{user}}');

        expect(result).toBe('{{user}} stays {{user}}');
    });
});

describe('escapeSTMacros / unescapeSTMacros roundtrip', () => {
    it('roundtrip preserves original text', () => {
        const original = '{{user}} met {{persona}} and said {{input}}';
        const escaped = escapeSTMacros(original);
        const unescaped = unescapeSTMacros(escaped);

        expect(unescaped).toBe(original);
    });

    it('roundtrip works with mixed content', () => {
        const original = `
Character description with {{user}} placeholder.
Also mentions {{persona}} but not {{char}}.
Some plain text without macros.
{{input}} at the end.
`;
        const escaped = escapeSTMacros(original);
        const unescaped = unescapeSTMacros(escaped);

        expect(unescaped).toBe(original);
    });

    it('double-escape then double-unescape returns to original', () => {
        const original = '{{user}} test';
        const doubleEscaped = escapeSTMacros(escapeSTMacros(original));
        const doubleUnescaped = unescapeSTMacros(
            unescapeSTMacros(doubleEscaped),
        );

        expect(doubleUnescaped).toBe(original);
    });
});

// =============================================================================
// TESTS: Detection Utilities
// =============================================================================

describe('detectPlaceholders', () => {
    it('finds all placeholders', () => {
        const result = detectPlaceholders('{{name}} - {{score}} - {{level}}');

        expect(result).toContain('name');
        expect(result).toContain('score');
        expect(result).toContain('level');
    });

    it('returns unique placeholders only', () => {
        const result = detectPlaceholders('{{name}} {{name}} {{name}}');

        expect(result).toHaveLength(1);
        expect(result[0]).toBe('name');
    });

    it('normalizes to lowercase', () => {
        const result = detectPlaceholders('{{NAME}} {{Name}} {{name}}');

        expect(result).toHaveLength(1);
        expect(result[0]).toBe('name');
    });

    it('returns empty array for no placeholders', () => {
        const result = detectPlaceholders('Plain text without placeholders');

        expect(result).toEqual([]);
    });

    it('does not detect conditional syntax as placeholder', () => {
        const result = detectPlaceholders('{{#if foo}}content{{/if}}');

        // The regex only matches {{word}} pattern, not {{#if word}}
        // So #if, /if, and even foo (inside conditional) are not detected
        expect(result).not.toContain('#if');
        expect(result).not.toContain('/if');
        expect(result).not.toContain('foo');
        expect(result).toEqual([]);
    });

    it('detects placeholders inside conditional content', () => {
        const result = detectPlaceholders('{{#if show}}Hello {{name}}{{/if}}');

        // Only {{name}} is a placeholder, not the conditional variable
        expect(result).toContain('name');
        expect(result).not.toContain('show');
    });
});

describe('detectConditionals', () => {
    it('finds conditional block variables', () => {
        const result = detectConditionals(
            '{{#if a}}A{{/if}} {{#if b}}B{{/if}}',
        );

        expect(result).toContain('a');
        expect(result).toContain('b');
    });

    it('returns unique conditionals only', () => {
        const result = detectConditionals(
            '{{#if x}}First{{/if}} {{#if x}}Second{{/if}}',
        );

        expect(result).toHaveLength(1);
    });

    it('normalizes to lowercase', () => {
        const result = detectConditionals('{{#if NAME}}content{{/if}}');

        expect(result[0]).toBe('name');
    });
});

describe('hasTemplateMarkers', () => {
    it('returns true for placeholders', () => {
        expect(hasTemplateMarkers('{{name}}')).toBe(true);
    });

    it('returns true for conditionals', () => {
        expect(hasTemplateMarkers('{{#if x}}content{{/if}}')).toBe(true);
    });

    it('returns false for plain text', () => {
        expect(hasTemplateMarkers('Just plain text')).toBe(false);
    });

    it('returns false for similar but invalid syntax', () => {
        expect(hasTemplateMarkers('{ {notvalid} }')).toBe(false);
        expect(hasTemplateMarkers('{{ }}')).toBe(false);
    });
});

// =============================================================================
// TESTS: replaceCharMacro
// =============================================================================

describe('replaceCharMacro', () => {
    it('replaces {{char}} with character name', () => {
        const result = replaceCharMacro('{{char}} says hello', 'Alice');

        expect(result).toBe('Alice says hello');
    });

    it('handles case-insensitive replacement', () => {
        const result = replaceCharMacro(
            '{{CHAR}} and {{Char}} and {{char}}',
            'Bob',
        );

        expect(result).toBe('Bob and Bob and Bob');
    });

    it('handles empty text', () => {
        expect(replaceCharMacro('', 'Name')).toBe('');
    });

    it('handles empty character name', () => {
        expect(replaceCharMacro('{{char}}', '')).toBe('{{char}}');
    });

    it('leaves other macros unchanged', () => {
        const result = replaceCharMacro('{{user}} meets {{char}}', 'Alice');

        expect(result).toBe('{{user}} meets Alice');
    });
});

// =============================================================================
// TESTS: getUnfilledPlaceholders
// =============================================================================

describe('getUnfilledPlaceholders', () => {
    it('returns placeholders without values', () => {
        const result = getUnfilledPlaceholders(
            '{{name}} - {{missing}} - {{also_missing}}',
            { name: 'Alice' },
        );

        expect(result).toContain('missing');
        expect(result).toContain('also_missing');
        expect(result).not.toContain('name');
    });

    it('treats empty string as unfilled', () => {
        const result = getUnfilledPlaceholders('{{empty}}', { empty: '' });

        expect(result).toContain('empty');
    });

    it('treats whitespace-only as unfilled', () => {
        const result = getUnfilledPlaceholders('{{spaces}}', { spaces: '   ' });

        expect(result).toContain('spaces');
    });

    it('returns empty array when all filled', () => {
        const result = getUnfilledPlaceholders('{{a}} {{b}}', {
            a: 'value1',
            b: 'value2',
        });

        expect(result).toEqual([]);
    });
});

// =============================================================================
// TESTS: buildContext
// =============================================================================

describe('buildContext', () => {
    it('converts strings directly', () => {
        const result = buildContext({ name: 'Alice' });

        expect(result.name).toBe('Alice');
    });

    it('converts numbers to strings', () => {
        const result = buildContext({ score: 95, level: 3.14 });

        expect(result.score).toBe('95');
        expect(result.level).toBe('3.14');
    });

    it('converts booleans to strings', () => {
        const result = buildContext({ active: true, deleted: false });

        expect(result.active).toBe('true');
        expect(result.deleted).toBe('false');
    });

    it('converts null/undefined to empty string', () => {
        const result = buildContext({
            nullVal: null,
            undefinedVal: undefined,
        } as Record<string, unknown>);

        expect(result.nullVal).toBe('');
        expect(result.undefinedVal).toBe('');
    });

    it('converts objects to JSON strings', () => {
        const result = buildContext({ data: { x: 1, y: 2 } });

        expect(result.data).toBe('{"x":1,"y":2}');
    });

    it('converts arrays to JSON strings', () => {
        const result = buildContext({ items: [1, 2, 3] });

        expect(result.items).toBe('[1,2,3]');
    });
});
