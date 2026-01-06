// src/domain/index.ts
// =============================================================================
// DOMAIN LAYER EXPORTS
// =============================================================================
//
// The domain layer contains pure business logic with no UI or persistence
// concerns. It receives dependencies through injection (see pipeline/prompt.ts
// PromptDependencies interface for the pattern).
//
// For API status functions (getApiStatus, isApiReady, estimateTokens),
// import directly from '../shared' - they are infrastructure, not domain.
//
// =============================================================================

// Character domain
export * from './character';

// Pipeline domain
export * from './pipeline';

// Schema validation (Anthropic/OpenAI structured output constraints)
export * from './schema';

// Preset validation (business rules for prompt/schema presets)
export * from './preset-validation';

// Generation utilities (error handling, retries)
export * from './generation';
