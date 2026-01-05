// src/types/settings.ts
// =============================================================================
// SETTINGS TYPE DEFINITIONS
// =============================================================================

import type { StageName, StageConfig } from './stage';
import type { PromptPreset, SchemaPreset } from './preset';

/**
 * Extension settings stored in ST's extensionSettings.
 */
export interface Settings {
    version: number;

    // System prompts
    baseSystemPrompt: string;
    userSystemPrompt: string;
    stageSystemPrompts: Record<StageName, string>;

    // Refinement prompts
    baseRefinementPrompt: string;
    userRefinementPrompt: string;

    // Stage defaults
    stageDefaults: Record<StageName, StageConfig>;

    // Presets (stored in settings, not localforage - they're not that big)
    promptPresets: PromptPreset[];
    schemaPresets: SchemaPreset[];

    // Generation
    generationMode: 'current' | 'profile';
    profileId: string | null;
    maxTokensOverride: number | null;

    // UI
    debugMode: boolean;
}
