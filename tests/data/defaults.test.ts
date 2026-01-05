/**
 * Builtin Presets Validation Tests
 *
 * Tests that builtin prompt and schema presets are well-formed
 * and contain required placeholders for proper functionality.
 */

import { describe, it, expect } from 'vitest';
import {
    BUILTIN_PROMPT_PRESETS,
    BUILTIN_SCHEMA_PRESETS,
    DEFAULT_SETTINGS,
    BASE_SYSTEM_PROMPT,
    BASE_REFINEMENT_PROMPT,
} from '../../src/data/settings/defaults';
import { validateSchema } from '../../src/domain/schema';

// =============================================================================
// TESTS: Builtin Prompt Presets
// =============================================================================

describe('Builtin Prompt Presets', () => {
    it('has at least one preset for each stage', () => {
        const stages = ['score', 'rewrite', 'analyze'] as const;

        for (const stage of stages) {
            const presetsForStage = BUILTIN_PROMPT_PRESETS.filter((p) =>
                p.stages.includes(stage),
            );
            expect(
                presetsForStage.length,
                `Expected at least one preset for stage: ${stage}`,
            ).toBeGreaterThanOrEqual(1);
        }
    });

    it('all presets have required fields', () => {
        for (const preset of BUILTIN_PROMPT_PRESETS) {
            expect(preset.id, `Preset missing id`).toBeTruthy();
            expect(
                preset.name,
                `Preset ${preset.id} missing name`,
            ).toBeTruthy();
            expect(
                preset.prompt,
                `Preset ${preset.id} missing prompt`,
            ).toBeTruthy();
            expect(
                preset.stages.length,
                `Preset ${preset.id} has no stages`,
            ).toBeGreaterThan(0);
            expect(
                preset.isBuiltin,
                `Preset ${preset.id} should be builtin`,
            ).toBe(true);
        }
    });

    it('preset IDs are unique', () => {
        const ids = BUILTIN_PROMPT_PRESETS.map((p) => p.id);
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(ids.length);
    });

    it('preset IDs follow naming convention', () => {
        for (const preset of BUILTIN_PROMPT_PRESETS) {
            expect(
                preset.id.startsWith('builtin_'),
                `Preset ${preset.id} should start with 'builtin_'`,
            ).toBe(true);
        }
    });

    it('default score preset has actionable instructions', () => {
        const defaultScore = BUILTIN_PROMPT_PRESETS.find(
            (p) => p.id === 'builtin_score_default',
        );

        expect(defaultScore).toBeDefined();
        expect(defaultScore?.prompt).toContain('Score');
        expect(defaultScore?.prompt).toContain('Strength');
        expect(defaultScore?.prompt).toContain('Weakness');
    });

    it('default rewrite preset mentions preservation', () => {
        const defaultRewrite = BUILTIN_PROMPT_PRESETS.find(
            (p) => p.id === 'builtin_rewrite_default',
        );

        expect(defaultRewrite).toBeDefined();
        // Key instruction: preserve the character's identity
        expect(defaultRewrite?.prompt.toLowerCase()).toMatch(
            /preserve|maintain|keep/,
        );
    });

    it('default analyze preset has verdict options', () => {
        const defaultAnalyze = BUILTIN_PROMPT_PRESETS.find(
            (p) => p.id === 'builtin_analyze_default',
        );

        expect(defaultAnalyze).toBeDefined();
        expect(defaultAnalyze?.prompt).toContain('ACCEPT');
        expect(defaultAnalyze?.prompt).toContain('NEEDS_REFINEMENT');
        expect(defaultAnalyze?.prompt).toContain('REGRESSION');
    });
});

// =============================================================================
// TESTS: Builtin Schema Presets
// =============================================================================

describe('Builtin Schema Presets', () => {
    it('all schema presets pass validation', () => {
        for (const preset of BUILTIN_SCHEMA_PRESETS) {
            const result = validateSchema(preset.schema);

            expect(
                result.valid,
                `Schema ${preset.id} failed validation: ${result.error}`,
            ).toBe(true);
        }
    });

    it('all presets have required fields', () => {
        for (const preset of BUILTIN_SCHEMA_PRESETS) {
            expect(preset.id, `Schema preset missing id`).toBeTruthy();
            expect(
                preset.name,
                `Schema preset ${preset.id} missing name`,
            ).toBeTruthy();
            expect(
                preset.schema,
                `Schema preset ${preset.id} missing schema`,
            ).toBeDefined();
            expect(
                preset.stages.length,
                `Schema preset ${preset.id} has no stages`,
            ).toBeGreaterThan(0);
            expect(
                preset.isBuiltin,
                `Schema preset ${preset.id} should be builtin`,
            ).toBe(true);
        }
    });

    it('schema preset IDs are unique', () => {
        const ids = BUILTIN_SCHEMA_PRESETS.map((p) => p.id);
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(ids.length);
    });

    it('score schema has expected output fields', () => {
        const scoreSchema = BUILTIN_SCHEMA_PRESETS.find(
            (p) => p.id === 'builtin_schema_score',
        );

        expect(scoreSchema).toBeDefined();

        const props = scoreSchema?.schema.value.properties;
        expect(props).toHaveProperty('overallScore');
        expect(props).toHaveProperty('summary');
    });

    it('analyze schema has verdict enum', () => {
        const analyzeSchema = BUILTIN_SCHEMA_PRESETS.find(
            (p) => p.id === 'builtin_schema_analyze',
        );

        expect(analyzeSchema).toBeDefined();

        const verdict = analyzeSchema?.schema.value.properties?.verdict;
        expect(verdict?.enum).toContain('ACCEPT');
        expect(verdict?.enum).toContain('NEEDS_REFINEMENT');
        expect(verdict?.enum).toContain('REGRESSION');
    });
});

// =============================================================================
// TESTS: Default Settings Structure
// =============================================================================

describe('Default Settings', () => {
    it('has valid stage defaults for all stages', () => {
        const stages = ['score', 'rewrite', 'analyze'] as const;

        for (const stage of stages) {
            const defaults = DEFAULT_SETTINGS.stageDefaults[stage];

            expect(
                defaults,
                `Missing stage defaults for ${stage}`,
            ).toBeDefined();
            expect(defaults).toHaveProperty('promptPresetId');
            expect(defaults).toHaveProperty('customPrompt');
            expect(defaults).toHaveProperty('useStructuredOutput');
        }
    });

    it('default stage preset IDs reference existing presets', () => {
        const stages = ['score', 'rewrite', 'analyze'] as const;

        for (const stage of stages) {
            const presetId =
                DEFAULT_SETTINGS.stageDefaults[stage].promptPresetId;

            if (presetId) {
                const preset = BUILTIN_PROMPT_PRESETS.find(
                    (p) => p.id === presetId,
                );
                expect(
                    preset,
                    `Stage ${stage} references non-existent preset: ${presetId}`,
                ).toBeDefined();
            }
        }
    });
});

// =============================================================================
// TESTS: System Prompts
// =============================================================================

describe('System Prompts', () => {
    it('base system prompt establishes role', () => {
        expect(BASE_SYSTEM_PROMPT).toContain('character');
        expect(BASE_SYSTEM_PROMPT.length).toBeGreaterThan(50);
    });

    it('base refinement prompt mentions iteration', () => {
        expect(BASE_REFINEMENT_PROMPT.toLowerCase()).toMatch(
            /refin|iteration|previous|feedback/,
        );
    });
});
