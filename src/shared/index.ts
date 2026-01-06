// src/shared/index.ts
// =============================================================================
// SHARED MODULE EXPORTS
// =============================================================================
//
// This module re-exports utilities that add value beyond raw ST APIs.
// For direct ST access, use SillyTavern.getContext() and SillyTavern.libs.
//
// =============================================================================

// =============================================================================
// CONSTANTS
// =============================================================================

export {
    MODULE_NAME,
    DISPLAY_NAME,
    VERSION,
    DEBUG,
    SETTINGS_VERSION,
    STORAGE_VERSION,
    PRESET_VERSION,
    STAGES,
    STAGE_LABELS,
    STAGE_ICONS,
    CHARACTER_FIELDS,
    STORAGE_KEYS,
    DEBOUNCE,
    MAX_SESSIONS_PER_CHARACTER,
} from './constants';

// =============================================================================
// SILLYTAVERN API WRAPPERS (only things that add value)
// =============================================================================

export {
    // Namespaced utilities (avoid window shadowing)
    popup,
    toast,

    // Storage helpers (error handling around localforage)
    storeLargeData,
    loadLargeData,

    // Character API
    editCharacterAttribute,
    getCharacterJson,
} from './st';

// Types from st.ts
export type {
    STContext,
    STCharacter,
    STMessage,
    STEventTypes,
    SettingsManager,
    EventManager,
    StructuredOutputSchema,
    JsonSchemaValue,
} from './st';

// =============================================================================
// LOGGING & DIAGNOSTICS
// =============================================================================

export {
    // Main logger
    log,

    // Debug mode control
    setDebugMode,
} from './debug';

export type { LogLevel, LogEntry, DiagnosticInfo } from './debug';

// =============================================================================
// API STATUS & CONNECTION PROFILES
// =============================================================================

export {
    // Profile discovery
    hasCMRS,
    getAvailableProfiles,

    // API status (SINGLE SOURCE OF TRUTH)
    getApiStatus,
    isApiReady,
} from './profiles';

export type { ProfileInfo, ApiStatus } from './profiles';

// =============================================================================
// TOKEN COUNTING (Advanced - with caching & debouncing)
// =============================================================================

export {
    // Promise API
    getTokenCount,
    getTokenCountsKeyed,
} from './tokens';

export type { KeyedTokenResult } from './tokens';

// =============================================================================
// TEMPLATE PROCESSING
// =============================================================================

export type { TemplateContext, TemplateConfig } from './templates';

// =============================================================================
// GENERAL UTILITIES
// =============================================================================

export {
    // String utilities
    generateUniqueName,
} from './utils';
