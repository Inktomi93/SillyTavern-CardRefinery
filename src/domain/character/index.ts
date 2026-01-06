// src/domain/character/index.ts
// =============================================================================
// CHARACTER DOMAIN EXPORTS
// =============================================================================

// Field extraction
export { getPopulatedFields, ensureUnshallowed } from './fields';

// Summary building
export { buildCharacterSummary, buildOriginalData } from './summary';

// NOTE: For character access, use SillyTavern.getContext().characters directly
// The search.ts file was removed as it was just trivial wrappers.
