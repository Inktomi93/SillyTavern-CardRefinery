/**
 * Character Field Extraction Tests
 *
 * Tests for extracting and formatting character card fields.
 * Covers both V1 (top-level) and V2 (data.*) character formats.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared module to control CHARACTER_FIELDS
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

import { getPopulatedFields } from '../../src/domain/character/fields';
import type { Character } from '../../src/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createV2Character(overrides: Partial<Character> = {}): Character {
    return {
        name: 'Test Character',
        avatar: 'test.png',
        description: 'A brave warrior.',
        personality: 'Bold and courageous.',
        first_mes: 'Hello, traveler!',
        scenario: 'Medieval fantasy setting.',
        mes_example: '<START>\n{{user}}: Hi\n{{char}}: Greetings!',
        data: {
            system_prompt: 'You are a brave warrior.',
            post_history_instructions: 'Stay in character.',
            creator_notes: 'Created for testing.',
            alternate_greetings: ['Alt greeting 1', 'Alt greeting 2'],
            extensions: {
                depth_prompt: {
                    prompt: 'Deep context here.',
                    depth: 4,
                },
            },
            character_book: {
                entries: [{ keys: ['sword'], content: 'A legendary blade.' }],
            },
        },
        ...overrides,
    } as Character;
}

function createV1Character(overrides: Partial<Character> = {}): Character {
    // V1 format has fields at top level, not nested in data
    return {
        name: 'V1 Character',
        avatar: 'v1.png',
        description: 'Old format character.',
        personality: 'Classic style.',
        first_mes: 'Welcome!',
        scenario: '',
        mes_example: '',
        system_prompt: 'Top level system prompt.',
        post_history_instructions: '',
        creator_notes: 'V1 notes.',
        ...overrides,
    } as Character;
}

// =============================================================================
// TESTS
// =============================================================================

describe('getPopulatedFields', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('basic extraction', () => {
        it('returns empty array for null character', () => {
            const result = getPopulatedFields(null as unknown as Character);
            expect(result).toEqual([]);
        });

        it('extracts populated string fields', () => {
            const char = createV2Character();
            const fields = getPopulatedFields(char);

            const keys = fields.map((f) => f.key);
            expect(keys).toContain('description');
            expect(keys).toContain('personality');
            expect(keys).toContain('first_mes');
            expect(keys).toContain('scenario');
        });

        it('excludes empty string fields', () => {
            const char = createV2Character({ scenario: '' });
            const fields = getPopulatedFields(char);

            const scenarioField = fields.find((f) => f.key === 'scenario');
            expect(scenarioField).toBeUndefined();
        });

        it('excludes whitespace-only fields', () => {
            const char = createV2Character({ scenario: '   \n\t  ' });
            const fields = getPopulatedFields(char);

            const scenarioField = fields.find((f) => f.key === 'scenario');
            expect(scenarioField).toBeUndefined();
        });
    });

    describe('V2 nested data fields', () => {
        it('extracts data.system_prompt', () => {
            const char = createV2Character();
            const fields = getPopulatedFields(char);

            const sysPrompt = fields.find((f) => f.key === 'system_prompt');
            expect(sysPrompt).toBeDefined();
            expect(sysPrompt?.value).toContain('brave warrior');
        });

        it('extracts data.creator_notes', () => {
            const char = createV2Character();
            const fields = getPopulatedFields(char);

            const notes = fields.find((f) => f.key === 'creator_notes');
            expect(notes).toBeDefined();
            expect(notes?.value).toContain('testing');
        });
    });

    describe('V1 fallback', () => {
        it('extracts top-level system_prompt for V1 cards', () => {
            const char = createV1Character();
            const fields = getPopulatedFields(char);

            const sysPrompt = fields.find((f) => f.key === 'system_prompt');
            expect(sysPrompt).toBeDefined();
            expect(sysPrompt?.value).toContain('Top level');
        });
    });

    describe('array fields', () => {
        it('extracts alternate_greetings array', () => {
            const char = createV2Character();
            const fields = getPopulatedFields(char);

            const altGreetings = fields.find(
                (f) => f.key === 'alternate_greetings',
            );
            expect(altGreetings).toBeDefined();
            expect(altGreetings?.type).toBe('array');
        });

        it('excludes empty arrays', () => {
            const char = createV2Character();
            char.data!.alternate_greetings = [];
            const fields = getPopulatedFields(char);

            const altGreetings = fields.find(
                (f) => f.key === 'alternate_greetings',
            );
            expect(altGreetings).toBeUndefined();
        });
    });

    describe('object fields', () => {
        it('extracts depth_prompt with non-empty prompt', () => {
            const char = createV2Character();
            const fields = getPopulatedFields(char);

            const depthPrompt = fields.find((f) => f.key === 'depth_prompt');
            expect(depthPrompt).toBeDefined();
        });

        it('excludes depth_prompt with empty prompt', () => {
            const char = createV2Character();
            char.data!.extensions!.depth_prompt = {
                prompt: '',
                depth: 4,
                role: 'system',
            };
            const fields = getPopulatedFields(char);

            const depthPrompt = fields.find((f) => f.key === 'depth_prompt');
            expect(depthPrompt).toBeUndefined();
        });

        it('extracts character_book with entries', () => {
            const char = createV2Character();
            const fields = getPopulatedFields(char);

            const lorebook = fields.find((f) => f.key === 'character_book');
            expect(lorebook).toBeDefined();
        });

        it('excludes character_book with no entries', () => {
            const char = createV2Character();
            char.data!.character_book = { entries: [] };
            const fields = getPopulatedFields(char);

            const lorebook = fields.find((f) => f.key === 'character_book');
            expect(lorebook).toBeUndefined();
        });
    });

    describe('field metadata', () => {
        it('includes charCount for each field', () => {
            const char = createV2Character();
            const fields = getPopulatedFields(char);

            for (const field of fields) {
                expect(typeof field.charCount).toBe('number');
                expect(field.charCount).toBeGreaterThan(0);
            }
        });

        it('includes label for each field', () => {
            const char = createV2Character();
            const fields = getPopulatedFields(char);

            const desc = fields.find((f) => f.key === 'description');
            expect(desc?.label).toBe('Description');
        });
    });
});
