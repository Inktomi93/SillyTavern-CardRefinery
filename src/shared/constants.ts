// src/shared/constants.ts
// =============================================================================
// EXTENSION CONSTANTS
// =============================================================================

import type { CharacterField } from '../types';

// =============================================================================
// EXTENSION IDENTITY
// =============================================================================

/** Extension identifier - matches folder name */
export const MODULE_NAME = 'SillyTavern-CardRefinery' as const;

/** Display name for UI */
export const DISPLAY_NAME = 'CardRefinery' as const;

/** Current version */
export const VERSION = '1.0.0' as const;

/** Enable debug logging */
export const DEBUG = true as const;

// =============================================================================
// VERSIONING
// =============================================================================

/** Settings schema version - bump when Settings shape changes */
export const SETTINGS_VERSION = 1 as const;

/** Storage schema version - bump when Session/Index shape changes */
export const STORAGE_VERSION = 2 as const;

/** Preset schema version - bump when PromptPreset/SchemaPreset shape changes */
export const PRESET_VERSION = 1 as const;

// =============================================================================
// STAGES
// =============================================================================

export const STAGES = ['score', 'rewrite', 'analyze'] as const;

export const STAGE_LABELS = {
    score: 'Score',
    rewrite: 'Rewrite',
    analyze: 'Analyze',
} as const;

export const STAGE_ICONS = {
    score: 'fa-star-half-stroke',
    rewrite: 'fa-pen-fancy',
    analyze: 'fa-magnifying-glass-chart',
} as const;

// =============================================================================
// CHARACTER FIELDS
// =============================================================================

export const CHARACTER_FIELDS: readonly CharacterField[] = [
    { key: 'description', label: 'Description', path: 'description' },
    { key: 'personality', label: 'Personality', path: 'personality' },
    { key: 'first_mes', label: 'First Message', path: 'first_mes' },
    { key: 'scenario', label: 'Scenario', path: 'scenario' },
    { key: 'mes_example', label: 'Example Messages', path: 'mes_example' },
    {
        key: 'system_prompt',
        label: 'System Prompt',
        path: 'data.system_prompt',
    },
    {
        key: 'post_history_instructions',
        label: 'Post-History Instructions',
        path: 'data.post_history_instructions',
    },
    {
        key: 'creator_notes',
        label: 'Creator Notes',
        path: 'data.creator_notes',
    },
    {
        key: 'alternate_greetings',
        label: 'Alternate Greetings',
        path: 'data.alternate_greetings',
        type: 'array',
    },
    {
        key: 'depth_prompt',
        label: 'Depth Prompt',
        path: 'data.extensions.depth_prompt',
        type: 'object',
    },
    {
        key: 'character_book',
        label: 'Character Lorebook',
        path: 'data.character_book',
        type: 'object',
    },
] as const;

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = {
    SESSIONS: `${MODULE_NAME}_sessions`,
    SESSION_INDEX: `${MODULE_NAME}_session_index`,
    STORAGE_META: `${MODULE_NAME}_storage_meta`,
} as const;

// =============================================================================
// CSS PREFIX
// =============================================================================

/**
 * CSS class prefix for all CardRefinery components.
 *
 * To change the prefix:
 * 1. Update this constant
 * 2. Run find-replace in src/styles/ and src/ui/: old prefix → new prefix
 * 3. Update _variables.css root selectors (.cr-popup, .cr-drawer, .cr-apply-dialog)
 */
export const CSS_PREFIX = 'cr' as const;

// =============================================================================
// UI CONSTANTS
// =============================================================================

export const DEBOUNCE = {
    SEARCH: 150,
    SAVE: 1000,
    VALIDATE: 300,
} as const;

export const MAX_SESSIONS_PER_CHARACTER = 50 as const;
export const MAX_HISTORY_ENTRIES = 100 as const;
