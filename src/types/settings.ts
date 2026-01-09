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

    /** Disable extended thinking for Anthropic models */
    disableThinking: boolean;

    /** Enable assistant message prefill */
    useAssistantPrefill: boolean;
    /** Assistant prefill text (inserted as assistant message after user content) */
    assistantPrefill: string;

    // Processing
    /** Replace {{user}} macro with current persona name in character fields */
    replaceUserMacro: boolean;

    // UI
    debugMode: boolean;
}
