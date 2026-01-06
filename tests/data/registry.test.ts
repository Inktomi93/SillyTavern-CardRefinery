/**
 * Preset Registry Tests
 *
 * Tests for CRUD operations on prompt and schema presets,
 * filtering, event subscriptions, and name uniqueness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock shared module
vi.mock('../../src/shared', async () => {
    const actual = await vi.importActual('../../src/shared');
    return {
        ...actual,
        PRESET_VERSION: 1,
        log: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    };
});

// Mock settings module - we need to control the settings state
const mockSettings = {
    promptPresets: [] as unknown[],
    schemaPresets: [] as unknown[],
};

vi.mock('../../src/data/settings/settings', () => ({
    getSettings: vi.fn(() => mockSettings),
    save: vi.fn(),
}));

import {
    presetRegistry,
    getPromptPresets,
    getPromptPreset,
    getSchemaPreset,
    registerPromptPreset,
    registerSchemaPreset,
    updatePromptPreset,
    updateSchemaPreset,
    deletePromptPreset,
    deleteSchemaPreset,
    duplicatePromptPreset,
    duplicateSchemaPreset,
    isNameUnique,
    generateUniquePresetName,
    getDisplayName,
    subscribe,
} from '../../src/data/settings/registry';
import type { PromptPreset } from '../../src/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockPromptPreset(
    overrides: Partial<PromptPreset> = {},
): PromptPreset {
    return {
        id: crypto.randomUUID(),
        name: 'Test Prompt',
        stages: ['score'],
        prompt: 'Test prompt content',
        isBuiltin: false,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
    };
}

// =============================================================================
// TESTS: Prompt Preset CRUD
// =============================================================================

describe('Prompt Preset CRUD', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSettings.promptPresets = [];
        mockSettings.schemaPresets = [];
    });

    describe('registerPromptPreset', () => {
        it('creates a new prompt preset with generated ID', () => {
            const preset = registerPromptPreset({
                name: 'My Prompt',
                stages: ['score', 'rewrite'],
                prompt: 'Evaluate the character.',
            });

            expect(preset.id).toBeDefined();
            expect(preset.name).toBe('My Prompt');
            expect(preset.stages).toEqual(['score', 'rewrite']);
            expect(preset.isBuiltin).toBe(false);
            expect(preset.version).toBe(1);
        });

        it('adds preset to settings array', () => {
            registerPromptPreset({
                name: 'New Preset',
                stages: [],
                prompt: 'Content',
            });

            expect(mockSettings.promptPresets).toHaveLength(1);
        });

        it('sets timestamps on creation', () => {
            const before = Date.now();
            const preset = registerPromptPreset({
                name: 'Timed',
                stages: [],
                prompt: 'Test',
            });
            const after = Date.now();

            expect(preset.createdAt).toBeGreaterThanOrEqual(before);
            expect(preset.createdAt).toBeLessThanOrEqual(after);
            expect(preset.updatedAt).toBe(preset.createdAt);
        });
    });

    describe('getPromptPreset', () => {
        it('returns preset by ID', () => {
            const created = registerPromptPreset({
                name: 'Find Me',
                stages: [],
                prompt: 'Content',
            });

            const found = getPromptPreset(created.id);

            expect(found).not.toBeNull();
            expect(found?.name).toBe('Find Me');
        });

        it('returns null for non-existent ID', () => {
            const found = getPromptPreset('non-existent-id');
            expect(found).toBeNull();
        });
    });

    describe('getPromptPresets', () => {
        it('returns all presets when no filter', () => {
            registerPromptPreset({ name: 'One', stages: [], prompt: 'A' });
            registerPromptPreset({ name: 'Two', stages: [], prompt: 'B' });

            const all = getPromptPresets();

            expect(all).toHaveLength(2);
        });

        it('filters by stage', () => {
            registerPromptPreset({
                name: 'Score',
                stages: ['score'],
                prompt: 'A',
            });
            registerPromptPreset({
                name: 'Rewrite',
                stages: ['rewrite'],
                prompt: 'B',
            });
            registerPromptPreset({ name: 'All', stages: [], prompt: 'C' });

            const scorePresets = getPromptPresets({ stage: 'score' });

            // Should include 'Score' (explicit) and 'All' (empty = all stages)
            expect(scorePresets).toHaveLength(2);
            expect(scorePresets.map((p) => p.name)).toContain('Score');
            expect(scorePresets.map((p) => p.name)).toContain('All');
        });

        it('filters by builtin status', () => {
            mockSettings.promptPresets.push(
                createMockPromptPreset({ name: 'Builtin', isBuiltin: true }),
            );
            registerPromptPreset({ name: 'User', stages: [], prompt: 'A' });

            const builtins = getPromptPresets({ builtinOnly: true });
            const userOnly = getPromptPresets({ userOnly: true });

            expect(builtins).toHaveLength(1);
            expect(builtins[0].name).toBe('Builtin');
            expect(userOnly).toHaveLength(1);
            expect(userOnly[0].name).toBe('User');
        });
    });

    describe('updatePromptPreset', () => {
        it('updates user preset successfully', () => {
            const preset = registerPromptPreset({
                name: 'Original',
                stages: [],
                prompt: 'Old',
            });

            const result = updatePromptPreset(preset.id, {
                name: 'Updated',
                prompt: 'New content',
            });

            expect(result).toBe(true);
            const updated = getPromptPreset(preset.id);
            expect(updated?.name).toBe('Updated');
            expect(updated?.prompt).toBe('New content');
        });

        it('updates updatedAt timestamp', () => {
            const preset = registerPromptPreset({
                name: 'Test',
                stages: [],
                prompt: 'A',
            });
            const originalUpdatedAt = preset.updatedAt;

            updatePromptPreset(preset.id, { name: 'Changed' });

            const updated = getPromptPreset(preset.id);
            // updatedAt should be >= original (same or later)
            expect(updated?.updatedAt).toBeGreaterThanOrEqual(
                originalUpdatedAt,
            );
        });

        it('returns false for builtin preset', () => {
            mockSettings.promptPresets.push(
                createMockPromptPreset({ id: 'builtin-1', isBuiltin: true }),
            );

            const result = updatePromptPreset('builtin-1', { name: 'Hacked' });

            expect(result).toBe(false);
        });

        it('returns false for non-existent preset', () => {
            const result = updatePromptPreset('fake-id', { name: 'Nothing' });
            expect(result).toBe(false);
        });
    });

    describe('deletePromptPreset', () => {
        it('deletes user preset successfully', () => {
            const preset = registerPromptPreset({
                name: 'Delete Me',
                stages: [],
                prompt: 'A',
            });

            const result = deletePromptPreset(preset.id);

            expect(result).toBe(true);
            expect(getPromptPreset(preset.id)).toBeNull();
            expect(mockSettings.promptPresets).toHaveLength(0);
        });

        it('returns false for builtin preset', () => {
            mockSettings.promptPresets.push(
                createMockPromptPreset({ id: 'builtin-1', isBuiltin: true }),
            );

            const result = deletePromptPreset('builtin-1');

            expect(result).toBe(false);
            expect(mockSettings.promptPresets).toHaveLength(1);
        });

        it('returns false for non-existent preset', () => {
            const result = deletePromptPreset('fake-id');
            expect(result).toBe(false);
        });
    });

    describe('duplicatePromptPreset', () => {
        it('creates copy of user preset', () => {
            const original = registerPromptPreset({
                name: 'Original',
                stages: ['score'],
                prompt: 'Content',
            });

            const copy = duplicatePromptPreset(original.id);

            expect(copy).not.toBeNull();
            expect(copy?.id).not.toBe(original.id);
            expect(copy?.name).toBe('Original (Copy)');
            expect(copy?.prompt).toBe('Content');
            expect(copy?.isBuiltin).toBe(false);
        });

        it('creates copy of builtin preset', () => {
            mockSettings.promptPresets.push(
                createMockPromptPreset({
                    id: 'builtin-1',
                    name: 'Builtin',
                    isBuiltin: true,
                }),
            );

            const copy = duplicatePromptPreset('builtin-1');

            expect(copy).not.toBeNull();
            expect(copy?.isBuiltin).toBe(false);
        });

        it('uses custom name when provided', () => {
            const original = registerPromptPreset({
                name: 'Original',
                stages: [],
                prompt: 'A',
            });

            const copy = duplicatePromptPreset(original.id, 'Custom Name');

            expect(copy?.name).toBe('Custom Name');
        });

        it('returns null for non-existent preset', () => {
            const copy = duplicatePromptPreset('fake-id');
            expect(copy).toBeNull();
        });
    });
});

// =============================================================================
// TESTS: Schema Preset CRUD
// =============================================================================

describe('Schema Preset CRUD', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSettings.promptPresets = [];
        mockSettings.schemaPresets = [];
    });

    describe('registerSchemaPreset', () => {
        it('creates a new schema preset', () => {
            const preset = registerSchemaPreset({
                name: 'My Schema',
                stages: ['score'],
                schema: { name: 'Test', value: { type: 'object' } },
            });

            expect(preset.id).toBeDefined();
            expect(preset.name).toBe('My Schema');
            expect(preset.schema.name).toBe('Test');
        });
    });

    describe('getSchemaPreset', () => {
        it('returns schema by ID', () => {
            const created = registerSchemaPreset({
                name: 'Find Me',
                stages: [],
                schema: { name: 'S', value: {} },
            });

            const found = getSchemaPreset(created.id);

            expect(found?.name).toBe('Find Me');
        });
    });

    describe('updateSchemaPreset', () => {
        it('updates user schema preset', () => {
            const preset = registerSchemaPreset({
                name: 'Original',
                stages: [],
                schema: { name: 'Old', value: {} },
            });

            updateSchemaPreset(preset.id, {
                schema: { name: 'New', value: { type: 'string' } },
            });

            const updated = getSchemaPreset(preset.id);
            expect(updated?.schema.name).toBe('New');
        });
    });

    describe('deleteSchemaPreset', () => {
        it('deletes user schema preset', () => {
            const preset = registerSchemaPreset({
                name: 'Delete',
                stages: [],
                schema: { name: 'S', value: {} },
            });

            const result = deleteSchemaPreset(preset.id);

            expect(result).toBe(true);
            expect(getSchemaPreset(preset.id)).toBeNull();
        });
    });

    describe('duplicateSchemaPreset', () => {
        it('deep clones schema object', () => {
            const original = registerSchemaPreset({
                name: 'Original',
                stages: [],
                schema: {
                    name: 'Test',
                    value: {
                        type: 'object',
                        properties: { name: { type: 'string' } },
                    },
                },
            });

            const copy = duplicateSchemaPreset(original.id);

            // Modify original schema
            original.schema.value = { type: 'string' };

            // Copy should be unaffected
            expect(copy?.schema.value).toHaveProperty('properties');
        });
    });
});

// =============================================================================
// TESTS: Event Subscriptions
// =============================================================================

describe('Event Subscriptions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSettings.promptPresets = [];
        mockSettings.schemaPresets = [];
    });

    it('notifies on preset add', () => {
        const listener = vi.fn();
        const unsubscribe = subscribe(listener);

        registerPromptPreset({ name: 'New', stages: [], prompt: 'A' });

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'add',
                presetType: 'prompt',
            }),
        );

        unsubscribe();
    });

    it('notifies on preset update', () => {
        const preset = registerPromptPreset({
            name: 'Original',
            stages: [],
            prompt: 'A',
        });

        const listener = vi.fn();
        const unsubscribe = subscribe(listener);

        updatePromptPreset(preset.id, { name: 'Updated' });

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'update',
                presetType: 'prompt',
                previousValue: expect.objectContaining({ name: 'Original' }),
            }),
        );

        unsubscribe();
    });

    it('notifies on preset delete', () => {
        const preset = registerPromptPreset({
            name: 'Delete Me',
            stages: [],
            prompt: 'A',
        });

        const listener = vi.fn();
        const unsubscribe = subscribe(listener);

        deletePromptPreset(preset.id);

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'delete',
                presetType: 'prompt',
            }),
        );

        unsubscribe();
    });

    it('unsubscribe removes listener', () => {
        const listener = vi.fn();
        const unsubscribe = subscribe(listener);

        unsubscribe();

        registerPromptPreset({ name: 'New', stages: [], prompt: 'A' });

        expect(listener).not.toHaveBeenCalled();
    });

    it('handles listener errors gracefully', () => {
        const errorListener = vi.fn(() => {
            throw new Error('Listener error');
        });
        const goodListener = vi.fn();

        subscribe(errorListener);
        subscribe(goodListener);

        // Should not throw
        expect(() => {
            registerPromptPreset({ name: 'Test', stages: [], prompt: 'A' });
        }).not.toThrow();

        // Good listener still called
        expect(goodListener).toHaveBeenCalled();
    });
});

// =============================================================================
// TESTS: Utility Functions
// =============================================================================

describe('Utility Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSettings.promptPresets = [];
        mockSettings.schemaPresets = [];
    });

    describe('isNameUnique', () => {
        it('returns true for unique name', () => {
            registerPromptPreset({ name: 'Existing', stages: [], prompt: 'A' });

            expect(isNameUnique('prompt', 'New Name')).toBe(true);
        });

        it('returns false for duplicate name (case insensitive)', () => {
            registerPromptPreset({ name: 'Existing', stages: [], prompt: 'A' });

            expect(isNameUnique('prompt', 'existing')).toBe(false);
            expect(isNameUnique('prompt', 'EXISTING')).toBe(false);
        });

        it('excludes specified ID from check', () => {
            const preset = registerPromptPreset({
                name: 'My Name',
                stages: [],
                prompt: 'A',
            });

            // Same name is OK if it's the same preset
            expect(isNameUnique('prompt', 'My Name', preset.id)).toBe(true);
        });
    });

    describe('generateUniquePresetName', () => {
        it('returns base name if unique', () => {
            const name = generateUniquePresetName('prompt', 'My Preset');
            expect(name).toBe('My Preset');
        });

        it('appends counter for duplicates', () => {
            registerPromptPreset({ name: 'Test', stages: [], prompt: 'A' });
            registerPromptPreset({ name: 'Test (2)', stages: [], prompt: 'B' });

            const name = generateUniquePresetName('prompt', 'Test');

            expect(name).toBe('Test (3)');
        });
    });

    describe('getDisplayName', () => {
        it('returns "Custom" for null ID', () => {
            expect(getDisplayName('prompt', null)).toBe('Custom');
        });

        it('returns "Unknown" for non-existent ID', () => {
            expect(getDisplayName('prompt', 'fake-id')).toBe('Unknown');
        });

        it('returns name for user preset', () => {
            const preset = registerPromptPreset({
                name: 'My Preset',
                stages: [],
                prompt: 'A',
            });

            expect(getDisplayName('prompt', preset.id)).toBe('My Preset');
        });

        it('returns name with (builtin) suffix for builtin', () => {
            mockSettings.promptPresets.push(
                createMockPromptPreset({
                    id: 'builtin-1',
                    name: 'Default',
                    isBuiltin: true,
                }),
            );

            expect(getDisplayName('prompt', 'builtin-1')).toBe(
                'Default (builtin)',
            );
        });
    });

    describe('presetRegistry.exists', () => {
        it('returns true for existing preset', () => {
            const preset = registerPromptPreset({
                name: 'Exists',
                stages: [],
                prompt: 'A',
            });

            expect(presetRegistry.exists('prompt', preset.id)).toBe(true);
        });

        it('returns false for non-existent preset', () => {
            expect(presetRegistry.exists('prompt', 'fake')).toBe(false);
        });
    });

    describe('presetRegistry.isBuiltin', () => {
        it('returns true for builtin preset', () => {
            mockSettings.promptPresets.push(
                createMockPromptPreset({ id: 'b1', isBuiltin: true }),
            );

            expect(presetRegistry.isBuiltin('prompt', 'b1')).toBe(true);
        });

        it('returns false for user preset', () => {
            const preset = registerPromptPreset({
                name: 'User',
                stages: [],
                prompt: 'A',
            });

            expect(presetRegistry.isBuiltin('prompt', preset.id)).toBe(false);
        });
    });

    describe('presetRegistry.getPresetsForStage', () => {
        it('returns presets matching stage', () => {
            registerPromptPreset({
                name: 'Score',
                stages: ['score'],
                prompt: 'A',
            });
            registerPromptPreset({ name: 'All', stages: [], prompt: 'B' });

            const result = presetRegistry.getPresetsForStage('prompt', 'score');

            expect(result).toHaveLength(2);
        });
    });
});
