/**
 * Settings & Migration Tests
 *
 * Tests for settings initialization, version migration,
 * stage defaults, and system prompts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock shared module
vi.mock('../../src/shared', async () => {
    const actual = await vi.importActual('../../src/shared');
    return {
        ...actual,
        MODULE_NAME: 'cardrefinery',
        SETTINGS_VERSION: 2,
        log: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    };
});

// We need to mock the defaults module separately
vi.mock('../../src/data/settings/defaults', () => ({
    DEFAULT_SETTINGS: {
        version: 2,
        promptPresets: [],
        schemaPresets: [],
        stageDefaults: {
            score: {
                promptPresetId: null,
                customPrompt: '',
                schemaPresetId: null,
                customSchema: '',
                useStructuredOutput: false,
            },
            rewrite: {
                promptPresetId: null,
                customPrompt: '',
                schemaPresetId: null,
                customSchema: '',
                useStructuredOutput: false,
            },
            analyze: {
                promptPresetId: null,
                customPrompt: '',
                schemaPresetId: null,
                customSchema: '',
                useStructuredOutput: false,
            },
        },
        baseSystemPrompt: 'Base system prompt.',
        userSystemPrompt: '',
        stageSystemPrompts: {
            score: 'Score stage prompt.',
            rewrite: 'Rewrite stage prompt.',
            analyze: 'Analyze stage prompt.',
        },
        baseRefinementPrompt: 'Base refinement prompt.',
        userRefinementPrompt: '',
        generationMode: 'current',
        profileId: null,
        maxTokensOverride: null,
        replaceUserMacro: false,
        debugMode: false,
    },
    BUILTIN_PROMPT_PRESETS: [
        {
            id: 'builtin-prompt-1',
            name: 'Default Scorer',
            stages: ['score'],
            prompt: 'Evaluate the character.',
            isBuiltin: true,
            version: 1,
            createdAt: 0,
            updatedAt: 0,
        },
    ],
    BUILTIN_SCHEMA_PRESETS: [
        {
            id: 'builtin-schema-1',
            name: 'Score Output',
            stages: ['score'],
            schema: { name: 'ScoreOutput', value: { type: 'object' } },
            isBuiltin: true,
            version: 1,
            createdAt: 0,
            updatedAt: 0,
        },
    ],
}));

// Mock SillyTavern context
const mockExtensionSettings: Record<string, unknown> = {};
const mockSaveSettingsDebounced = vi.fn();

// Reset SillyTavern mock before imports
Object.assign(globalThis, {
    SillyTavern: {
        getContext: () => ({
            extensionSettings: mockExtensionSettings,
            saveSettingsDebounced: mockSaveSettingsDebounced,
        }),
        libs: {
            lodash: {
                cloneDeep: <T>(obj: T): T => JSON.parse(JSON.stringify(obj)),
                merge: <T extends object>(
                    target: T,
                    ...sources: Partial<T>[]
                ): T => Object.assign({}, target, ...sources),
            },
        },
    },
});

import {
    getSettings,
    save,
    resetSettings,
    getStageDefaults,
    setStageDefaults,
    getSystemPrompt,
    getRefinementPrompt,
} from '../../src/data/settings/settings';

// =============================================================================
// TESTS: Settings Initialization
// =============================================================================

describe('Settings Initialization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear all extension settings
        Object.keys(mockExtensionSettings).forEach(
            (key) => delete mockExtensionSettings[key],
        );
    });

    describe('getSettings', () => {
        it('initializes with defaults when no existing settings', () => {
            const settings = getSettings();

            expect(settings).toBeDefined();
            expect(settings.version).toBe(2);
            expect(settings.stageDefaults).toBeDefined();
            expect(settings.stageDefaults.score).toBeDefined();
        });

        it('saves settings on first initialization', () => {
            getSettings();
            expect(mockSaveSettingsDebounced).toHaveBeenCalled();
        });

        it('returns existing settings if present and current version', () => {
            mockExtensionSettings['cardrefinery'] = {
                version: 2,
                promptPresets: [
                    { id: 'custom', name: 'Custom' },
                    // Include builtin so syncBuiltinPresets doesn't add another
                    {
                        id: 'builtin-prompt-1',
                        name: 'Default Scorer',
                        isBuiltin: true,
                        version: 1,
                    },
                ],
                schemaPresets: [
                    {
                        id: 'builtin-schema-1',
                        name: 'Score Output',
                        isBuiltin: true,
                        version: 1,
                    },
                ],
                stageDefaults: {
                    score: { customPrompt: 'Custom score prompt' },
                    rewrite: {},
                    analyze: {},
                },
                baseSystemPrompt: 'Custom base',
                stageSystemPrompts: { score: '', rewrite: '', analyze: '' },
            };

            const settings = getSettings();

            // Should have custom preset + builtin
            expect(settings.promptPresets).toHaveLength(2);
            expect(
                settings.promptPresets.find((p) => p.name === 'Custom'),
            ).toBeDefined();
        });

        it('ensures preset arrays exist', () => {
            mockExtensionSettings['cardrefinery'] = {
                version: 2,
                // Missing promptPresets and schemaPresets
                stageDefaults: {
                    score: {},
                    rewrite: {},
                    analyze: {},
                },
            };

            const settings = getSettings();

            expect(Array.isArray(settings.promptPresets)).toBe(true);
            expect(Array.isArray(settings.schemaPresets)).toBe(true);
        });
    });

    describe('save', () => {
        it('calls saveSettingsDebounced', () => {
            save();
            expect(mockSaveSettingsDebounced).toHaveBeenCalled();
        });
    });

    describe('resetSettings', () => {
        it('replaces settings with defaults', () => {
            mockExtensionSettings['cardrefinery'] = {
                version: 2,
                promptPresets: [{ id: 'custom' }],
                schemaPresets: [],
            };

            const settings = resetSettings();

            expect(settings.promptPresets).toHaveLength(0);
        });

        it('saves after reset', () => {
            resetSettings();
            expect(mockSaveSettingsDebounced).toHaveBeenCalled();
        });
    });
});

// =============================================================================
// TESTS: Version Migration
// =============================================================================

describe('Version Migration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockExtensionSettings).forEach(
            (key) => delete mockExtensionSettings[key],
        );
    });

    it('migrates from older version', () => {
        mockExtensionSettings['cardrefinery'] = {
            version: 1,
            promptPresets: [],
            schemaPresets: [],
            stageDefaults: {
                score: {},
                rewrite: {},
                analyze: {},
            },
        };

        const settings = getSettings();

        // Should be updated to current version
        expect(settings.version).toBe(2);
    });

    it('preserves user data during migration', () => {
        mockExtensionSettings['cardrefinery'] = {
            version: 1,
            promptPresets: [
                { id: 'user-1', name: 'My Prompt', isBuiltin: false },
            ],
            schemaPresets: [],
            stageDefaults: {
                score: { customPrompt: 'My custom prompt' },
                rewrite: {},
                analyze: {},
            },
        };

        const settings = getSettings();

        expect(
            settings.promptPresets.find((p) => p.id === 'user-1'),
        ).toBeDefined();
    });

    it('syncs builtin presets after migration', () => {
        mockExtensionSettings['cardrefinery'] = {
            version: 1,
            promptPresets: [],
            schemaPresets: [],
            stageDefaults: {
                score: {},
                rewrite: {},
                analyze: {},
            },
        };

        const settings = getSettings();

        // Should have builtin presets added
        const builtin = settings.promptPresets.find(
            (p) => p.id === 'builtin-prompt-1',
        );
        expect(builtin).toBeDefined();
    });

    it('updates outdated builtin presets', () => {
        mockExtensionSettings['cardrefinery'] = {
            version: 2,
            promptPresets: [
                {
                    id: 'builtin-prompt-1',
                    name: 'Old Name',
                    version: 0, // Outdated
                    isBuiltin: true,
                },
            ],
            schemaPresets: [],
            stageDefaults: {
                score: {},
                rewrite: {},
                analyze: {},
            },
        };

        const settings = getSettings();

        const builtin = settings.promptPresets.find(
            (p) => p.id === 'builtin-prompt-1',
        );
        expect(builtin?.name).toBe('Default Scorer');
        expect(builtin?.version).toBe(1);
    });

    it('preserves all user customizations during migration', () => {
        // Simulate a user who has customized everything
        mockExtensionSettings['cardrefinery'] = {
            version: 1, // Old version triggers migration
            promptPresets: [
                {
                    id: 'user-custom-scorer',
                    name: 'My Waifu Scorer',
                    stages: ['score'],
                    prompt: 'Rate this waifu on cuteness...',
                    isBuiltin: false,
                    version: 1,
                    createdAt: 1234567890,
                    updatedAt: 1234567890,
                },
                {
                    id: 'user-rewriter',
                    name: 'Personality Enhancer',
                    stages: ['rewrite'],
                    prompt: 'Make this character more kawaii...',
                    isBuiltin: false,
                    version: 1,
                    createdAt: 1234567891,
                    updatedAt: 1234567891,
                },
            ],
            schemaPresets: [],
            stageDefaults: {
                score: {
                    promptPresetId: 'user-custom-scorer',
                    customPrompt: 'Additional scoring notes...',
                    useStructuredOutput: true,
                },
                rewrite: {
                    promptPresetId: 'user-rewriter',
                },
                analyze: {},
            },
            baseSystemPrompt: 'You are a kawaii character analyst.',
            userSystemPrompt: 'Always use anime terminology.',
            stageSystemPrompts: {
                score: 'Focus on moe factors.',
                rewrite: 'Preserve tsundere traits.',
                analyze: '',
            },
            baseRefinementPrompt: 'Custom refinement prompt.',
            userRefinementPrompt: 'Be extra cute.',
        };

        const settings = getSettings();

        // Version should be updated
        expect(settings.version).toBe(2);

        // User presets preserved
        expect(
            settings.promptPresets.find((p) => p.id === 'user-custom-scorer'),
        ).toBeDefined();
        expect(
            settings.promptPresets.find((p) => p.id === 'user-rewriter'),
        ).toBeDefined();
        expect(
            settings.promptPresets.find((p) => p.name === 'My Waifu Scorer')
                ?.prompt,
        ).toContain('cuteness');

        // Stage defaults preserved
        expect(settings.stageDefaults.score.promptPresetId).toBe(
            'user-custom-scorer',
        );
        expect(settings.stageDefaults.score.customPrompt).toContain(
            'Additional scoring',
        );
        // Note: useStructuredOutput is forcibly disabled in migration v2 for score/analyze stages
        expect(settings.stageDefaults.score.useStructuredOutput).toBe(false);

        // System prompts preserved
        expect(settings.baseSystemPrompt).toContain('kawaii');
        expect(settings.userSystemPrompt).toContain('anime');
        expect(settings.stageSystemPrompts.score).toContain('moe');

        // Refinement prompts preserved
        expect(settings.userRefinementPrompt).toContain('cute');
    });
});

// =============================================================================
// TESTS: Stage Defaults
// =============================================================================

describe('Stage Defaults', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockExtensionSettings).forEach(
            (key) => delete mockExtensionSettings[key],
        );
    });

    describe('getStageDefaults', () => {
        it('returns defaults for stage', () => {
            const defaults = getStageDefaults('score');

            expect(defaults).toBeDefined();
            expect(defaults.promptPresetId).toBeNull();
            expect(defaults.useStructuredOutput).toBe(false);
        });

        it('returns deep clone (not reference)', () => {
            const defaults1 = getStageDefaults('score');
            const defaults2 = getStageDefaults('score');

            defaults1.customPrompt = 'Modified';

            expect(defaults2.customPrompt).toBe('');
        });
    });

    describe('setStageDefaults', () => {
        it('updates stage defaults', () => {
            getSettings(); // Initialize

            setStageDefaults('score', {
                promptPresetId: 'preset-1',
                customPrompt: 'Custom',
                schemaPresetId: null,
                customSchema: '',
                useStructuredOutput: true,
            });

            const updated = getStageDefaults('score');

            expect(updated.promptPresetId).toBe('preset-1');
            expect(updated.useStructuredOutput).toBe(true);
        });

        it('saves after update', () => {
            getSettings();
            vi.clearAllMocks();

            setStageDefaults('rewrite', {
                promptPresetId: null,
                customPrompt: 'Test',
                schemaPresetId: null,
                customSchema: '',
                useStructuredOutput: false,
            });

            expect(mockSaveSettingsDebounced).toHaveBeenCalled();
        });
    });
});

// =============================================================================
// TESTS: System Prompts
// =============================================================================

describe('System Prompts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockExtensionSettings).forEach(
            (key) => delete mockExtensionSettings[key],
        );
    });

    describe('getSystemPrompt', () => {
        it('combines base, user, and stage prompts', () => {
            mockExtensionSettings['cardrefinery'] = {
                version: 2,
                promptPresets: [],
                schemaPresets: [],
                stageDefaults: { score: {}, rewrite: {}, analyze: {} },
                baseSystemPrompt: 'Base prompt.',
                userSystemPrompt: 'User additions.',
                stageSystemPrompts: {
                    score: 'Score specific.',
                    rewrite: '',
                    analyze: '',
                },
            };

            const prompt = getSystemPrompt('score');

            expect(prompt).toContain('Base prompt.');
            expect(prompt).toContain('User additions.');
            expect(prompt).toContain('Score specific.');
        });

        it('filters out empty parts', () => {
            mockExtensionSettings['cardrefinery'] = {
                version: 2,
                promptPresets: [],
                schemaPresets: [],
                stageDefaults: { score: {}, rewrite: {}, analyze: {} },
                baseSystemPrompt: 'Base only.',
                userSystemPrompt: '',
                stageSystemPrompts: {
                    score: '',
                    rewrite: '',
                    analyze: '',
                },
            };

            const prompt = getSystemPrompt('score');

            expect(prompt).toBe('Base only.');
            // Should not have extra newlines from empty parts
            expect(prompt).not.toContain('\n\n\n');
        });
    });

    describe('getRefinementPrompt', () => {
        it('combines base and user refinement prompts', () => {
            mockExtensionSettings['cardrefinery'] = {
                version: 2,
                promptPresets: [],
                schemaPresets: [],
                stageDefaults: { score: {}, rewrite: {}, analyze: {} },
                baseRefinementPrompt: 'Base refinement.',
                userRefinementPrompt: 'User refinement.',
            };

            const prompt = getRefinementPrompt();

            expect(prompt).toContain('Base refinement.');
            expect(prompt).toContain('User refinement.');
        });

        it('handles empty user refinement', () => {
            mockExtensionSettings['cardrefinery'] = {
                version: 2,
                promptPresets: [],
                schemaPresets: [],
                stageDefaults: { score: {}, rewrite: {}, analyze: {} },
                baseRefinementPrompt: 'Base only.',
                userRefinementPrompt: '',
            };

            const prompt = getRefinementPrompt();

            expect(prompt).toBe('Base only.');
        });
    });
});
