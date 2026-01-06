// src/data/settings/index.ts
// =============================================================================
// SETTINGS MODULE EXPORTS
// =============================================================================

// Core settings
export {
    getSettings,
    save,
    resetSettings,
    getStageDefaults,
    setStageDefaults,
    getSystemPrompt,
    getRefinementPrompt,
} from './settings';

// Preset Registry (new centralized API)
export { presetRegistry } from './registry';

// Preset CRUD (legacy API - delegates to registry)
// For validation, use validatePromptPreset/validateSchemaPreset from domain
export {
    getPromptPresetsForStage,
    getPromptPreset,
    savePromptPreset,
    updatePromptPreset,
    deletePromptPreset,
    getSchemaPresetsForStage,
    getSchemaPreset,
    saveSchemaPreset,
    updateSchemaPreset,
    deleteSchemaPreset,
} from './presets';

// Defaults
export {
    DEFAULT_SETTINGS,
    DEFAULT_STAGE_CONFIG,
    BUILTIN_PROMPT_PRESETS,
    BUILTIN_SCHEMA_PRESETS,
    BASE_SYSTEM_PROMPT,
    BASE_REFINEMENT_PROMPT,
    createDefaultSession,
} from './defaults';
