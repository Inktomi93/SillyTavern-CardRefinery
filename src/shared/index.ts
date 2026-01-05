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
    MAX_HISTORY_ENTRIES,
} from './constants';

// =============================================================================
// SILLYTAVERN API WRAPPERS (only things that add value)
// =============================================================================

export {
    // Namespaced utilities (avoid window shadowing)
    popup,
    toast,
    loader,

    // Factory functions (return managed objects)
    createSettingsManager,
    createEventManager,
    createChatMetadataManager,

    // Storage helpers (error handling around localforage)
    storeLargeData,
    loadLargeData,
    removeLargeData,
} from './st';

// Types from st.ts
export type {
    STContext,
    STCharacter,
    STMessage,
    STEventTypes,
    SettingsManager,
    EventManager,
    ChatMetadataManager,
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
    isDebugMode,
    setDebugMode,

    // Log access
    getLogEntries,
    getLogEntriesByLevel,
    clearLogEntries,

    // Diagnostics
    collectDiagnostics,
    exportDiagnostics,
    generateDebugReport,
} from './debug';

export type { LogLevel, LogEntry, DiagnosticInfo } from './debug';

// =============================================================================
// API STATUS & CONNECTION PROFILES
// =============================================================================

export {
    // Profile discovery
    hasCMRS,
    getAvailableProfiles,
    getProfile,
    isProfileValid,

    // API status (SINGLE SOURCE OF TRUTH)
    getApiStatus,
    isApiReady,

    // Sampler settings
    getSamplerSettings,

    // Token estimation
    estimateTokens,
    promptFitsContext,
} from './profiles';

export type {
    ProfileInfo,
    ApiStatus,
    SamplerSettings,
    TokenEstimate,
} from './profiles';

// =============================================================================
// TOKEN COUNTING (Advanced - with caching & debouncing)
// =============================================================================

export {
    // Callback API (for UI with debounce)
    countTokensDebounced,
    cancelTokenCount,
    cancelAllTokenCounts,

    // Promise API
    getTokenCount,
    getTokenCountBatch,
    getTokenCountsKeyed,

    // Cache management
    clearTokenCache,
    getCachedTokenCount,
    setCachedTokenCount,

    // Debug
    isTokenCountPending,
    getTokenCacheSize,
    getTokenPendingCount,
} from './tokens';

export type { KeyedTokenResult } from './tokens';

// =============================================================================
// TEMPLATE PROCESSING
// =============================================================================

export {
    processTemplate,
    processConditionalBlocks,
    detectPlaceholders,
    detectConditionals,
    hasTemplateMarkers,
    escapeSTMacros,
    unescapeSTMacros,
    replaceCharMacro,
    getUnfilledPlaceholders,
    buildContext,
} from './templates';

export type { TemplateContext, TemplateConfig } from './templates';

// =============================================================================
// GENERAL UTILITIES
// =============================================================================

export {
    // Hashing
    hashString,
    getCharacterKey,

    // String utilities
    hasContent,
    countWords,

    // Async utilities
    retry,

    // Validation
    assert,
    assertDefined,

    // Timing
    createTimer,
    formatDuration,

    // JSON utilities
    parseJSON,
    isValidJSON,
} from './utils';
