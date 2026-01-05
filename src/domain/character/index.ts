// src/domain/character/index.ts
// =============================================================================
// CHARACTER DOMAIN EXPORTS
// =============================================================================

// Field extraction & validation
export {
    getPopulatedFields,
    getPopulatedFieldsAsync,
    ensureUnshallowed,
    isShallow,
    formatValue,
    hasPopulatedFields,
    getTotalCharCount,
    validateCharacter,
    getFieldPreview,
} from './fields';

// Summary building
export {
    buildCharacterSummary,
    buildOriginalData,
    getDefaultSelection,
} from './summary';

// NOTE: For character access, use SillyTavern.getContext().characters directly
// The search.ts file was removed as it was just trivial wrappers.
