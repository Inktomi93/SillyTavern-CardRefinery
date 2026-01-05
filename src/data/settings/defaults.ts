// src/data/settings/defaults.ts
// =============================================================================
// DEFAULT VALUES & BUILTIN PRESETS
// =============================================================================

import {
    PRESET_VERSION,
    SETTINGS_VERSION,
    STORAGE_VERSION,
} from '../../shared';
import type {
    Settings,
    StageConfig,
    PromptPreset,
    SchemaPreset,
    Session,
    StorageMeta,
} from '../../types';

// =============================================================================
// DEFAULT STAGE CONFIG
// =============================================================================

export const DEFAULT_STAGE_CONFIG: StageConfig = {
    promptPresetId: null,
    customPrompt: '',
    schemaPresetId: null,
    customSchema: '',
    useStructuredOutput: false,
};

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

export const BASE_SYSTEM_PROMPT = `You are a character card analyst and writer. You help improve roleplay character cards by providing specific, actionable feedback and high-quality rewrites.

Key principles:
- Preserve the character's core identity and unique traits
- Be specific - vague feedback is useless
- Quality over quantity - concise and impactful
- Maintain consistency across all fields`;

export const BASE_REFINEMENT_PROMPT = `You are refining a character card based on analysis feedback. Address identified issues while preserving what works.

Key principles:
- Fix specific problems from the analysis
- Keep improvements from previous iterations
- Maintain the character's essential identity
- Don't reintroduce previously fixed issues`;

// =============================================================================
// BUILTIN PROMPT PRESETS
// =============================================================================

export const BUILTIN_PROMPT_PRESETS: PromptPreset[] = [
    // ===== SCORE PRESETS =====
    {
        id: 'builtin_score_default',
        name: 'Default Score',
        stages: ['score'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        prompt: `Rate this character card on a scale of 1-10 for each field provided.

For each field:
1. **Score** (1-10)
2. **Strengths** - What works well
3. **Weaknesses** - What needs improvement
4. **Suggestions** - Concrete changes

Then provide:
- **Overall Score** (weighted average)
- **Top 3 Priority Improvements**
- **Summary**

Be critical but constructive. Specific, actionable feedback only.`,
    },
    {
        id: 'builtin_score_quick',
        name: 'Quick Score',
        stages: ['score'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        prompt: `Give a quick assessment:

1. Overall score (1-10)
2. Three biggest strengths
3. Three areas needing work
4. One-sentence summary

Keep it concise but useful.`,
    },

    // ===== REWRITE PRESETS =====
    {
        id: 'builtin_rewrite_default',
        name: 'Default Rewrite',
        stages: ['rewrite'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        prompt: `Rewrite this character card to address weaknesses while preserving strengths.

Guidelines:
- Maintain core personality and unique traits
- Improve weak areas from feedback
- Keep similar length unless noted
- Preserve distinctive voice/style
- Fix contradictions and fill gaps

Output the complete rewritten character with all fields.`,
    },
    {
        id: 'builtin_rewrite_conservative',
        name: 'Conservative Rewrite',
        stages: ['rewrite'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        prompt: `Make minimal, surgical improvements. Only change what's clearly broken or weak.

Rules:
- Change as little as possible
- Preserve the author's voice completely
- Only fix obvious issues (contradictions, grammar, clarity)
- Do NOT add new content unless filling a critical gap
- Do NOT change style or tone

Output only the fields you changed, with [ORIGINAL] and [REVISED] versions for comparison.`,
    },
    {
        id: 'builtin_rewrite_expansive',
        name: 'Expansive Rewrite',
        stages: ['rewrite'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        prompt: `Significantly expand and enhance this character card. Add depth, detail, and richness.

Goals:
- Flesh out underdeveloped areas
- Add sensory details and specific examples
- Deepen personality with quirks, contradictions, history
- Improve example messages with more variety
- Make the character feel more three-dimensional

Don't change the core concept, but make it shine. Output the complete expanded character card.`,
    },

    // ===== ANALYZE PRESETS =====
    {
        id: 'builtin_analyze_default',
        name: 'Default Analyze',
        stages: ['analyze'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        prompt: `Compare the original character card with the rewritten version.

## What Was Preserved
Core traits, distinctive elements, voice consistency

## What Was Lost
Diminished aspects, missing quirks, tone shifts

## What Was Gained
New depth, improvements, better clarity

## Soul Check
Does the rewrite still feel like the same character? Rate 1-10.

## Verdict
**ACCEPT** (ready), **NEEDS_REFINEMENT** (has issues), or **REGRESSION** (worse)

## Issues to Address
If NEEDS_REFINEMENT, list specific problems for next iteration.`,
    },
    {
        id: 'builtin_analyze_iteration',
        name: 'Iteration Analyze',
        stages: ['analyze'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        prompt: `Compare the current rewrite against the original.

## Progress Check
- What issues from previous analysis were addressed?
- What new issues (if any) were introduced?
- Is this version better, worse, or lateral move?

## Current State
- Preserved from Original
- Still Missing or Lost
- Successfully Improved
- New Problems

## Soul Preservation Score (1-10)

## Verdict
**ACCEPT** - Ready, no more iterations needed
**NEEDS_REFINEMENT** - Progress, but issues remain
**REGRESSION** - Made things worse

## Next Steps
If NEEDS_REFINEMENT: What to fix next.
If REGRESSION: What went wrong.`,
    },
    {
        id: 'builtin_analyze_quick',
        name: 'Quick Analyze',
        stages: ['analyze'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        prompt: `Quick comparison:

1. Soul preserved? (Yes/Partially/No)
2. Best improvement made
3. Biggest thing lost (if any)
4. Verdict: ACCEPT / NEEDS_REFINEMENT / REGRESSION`,
    },
];

// =============================================================================
// BUILTIN SCHEMA PRESETS
// =============================================================================

export const BUILTIN_SCHEMA_PRESETS: SchemaPreset[] = [
    {
        id: 'builtin_schema_score',
        name: 'Score Schema',
        stages: ['score'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        schema: {
            name: 'CharacterScore',
            strict: true,
            value: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    fieldScores: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                field: { type: 'string' },
                                score: { type: 'number' },
                                strengths: { type: 'string' },
                                weaknesses: { type: 'string' },
                                suggestions: { type: 'string' },
                            },
                            required: [
                                'field',
                                'score',
                                'strengths',
                                'weaknesses',
                                'suggestions',
                            ],
                        },
                    },
                    overallScore: { type: 'number' },
                    priorityImprovements: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                    summary: { type: 'string' },
                },
                required: [
                    'fieldScores',
                    'overallScore',
                    'priorityImprovements',
                    'summary',
                ],
            },
        },
    },
    {
        id: 'builtin_schema_quick_score',
        name: 'Quick Score Schema',
        stages: ['score'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        schema: {
            name: 'QuickScore',
            strict: true,
            value: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    overallScore: { type: 'number' },
                    strengths: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                    weaknesses: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                    summary: { type: 'string' },
                },
                required: [
                    'overallScore',
                    'strengths',
                    'weaknesses',
                    'summary',
                ],
            },
        },
    },
    {
        id: 'builtin_schema_analyze',
        name: 'Analyze Schema',
        stages: ['analyze'],
        isBuiltin: true,
        version: PRESET_VERSION,
        createdAt: 0,
        updatedAt: 0,
        schema: {
            name: 'CharacterAnalysis',
            strict: true,
            value: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    preserved: { type: 'array', items: { type: 'string' } },
                    lost: { type: 'array', items: { type: 'string' } },
                    gained: { type: 'array', items: { type: 'string' } },
                    soulScore: { type: 'number' },
                    soulAssessment: { type: 'string' },
                    verdict: {
                        type: 'string',
                        enum: ['ACCEPT', 'NEEDS_REFINEMENT', 'REGRESSION'],
                    },
                    issues: { type: 'array', items: { type: 'string' } },
                    recommendations: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
                required: [
                    'preserved',
                    'lost',
                    'gained',
                    'soulScore',
                    'soulAssessment',
                    'verdict',
                    'issues',
                    'recommendations',
                ],
            },
        },
    },
];

// =============================================================================
// DEFAULT SETTINGS
// =============================================================================

export const DEFAULT_SETTINGS: Settings = {
    version: SETTINGS_VERSION,

    baseSystemPrompt: BASE_SYSTEM_PROMPT,
    userSystemPrompt: '',
    stageSystemPrompts: {
        score: '',
        rewrite: '',
        analyze: '',
    },

    baseRefinementPrompt: BASE_REFINEMENT_PROMPT,
    userRefinementPrompt: '',

    stageDefaults: {
        score: {
            ...DEFAULT_STAGE_CONFIG,
            promptPresetId: 'builtin_score_default',
        },
        rewrite: {
            ...DEFAULT_STAGE_CONFIG,
            promptPresetId: 'builtin_rewrite_default',
        },
        analyze: {
            ...DEFAULT_STAGE_CONFIG,
            promptPresetId: 'builtin_analyze_default',
        },
    },

    promptPresets: [...BUILTIN_PROMPT_PRESETS],
    schemaPresets: [...BUILTIN_SCHEMA_PRESETS],

    generationMode: 'current',
    profileId: null,
    maxTokensOverride: null,
    debugMode: false,
};

// =============================================================================
// DEFAULT STORAGE META
// =============================================================================

export const DEFAULT_STORAGE_META: StorageMeta = {
    version: STORAGE_VERSION,
    lastMigration: Date.now(),
};

// =============================================================================
// SESSION FACTORY
// =============================================================================

export function createDefaultSession(
    id: string,
    characterId: string,
    characterName: string,
): Session {
    return {
        id,
        characterId,
        characterName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        stageFields: {
            base: {},
            linked: true,
            overrides: {},
        },
        originalData: {},
        configs: {
            score: { ...DEFAULT_STAGE_CONFIG },
            rewrite: { ...DEFAULT_STAGE_CONFIG },
            analyze: { ...DEFAULT_STAGE_CONFIG },
        },
        history: [],
        iterationCount: 0,
        status: 'active',
        version: STORAGE_VERSION,
    };
}
