// src/domain/schema/index.ts
// =============================================================================
// SCHEMA MODULE EXPORTS
//
// Provides JSON schema validation, auto-fixing, and generation utilities
// for Anthropic/OpenAI structured output compatibility.
// =============================================================================

// Types
export type { SchemaValidationResult, ValidationContext } from './types';

// Constants (rarely needed externally, but available)
export {
    ANTHROPIC_LIMITS,
    IGNORED_CONSTRAINTS,
    UNSUPPORTED_FEATURES,
} from './constants';

// Validation
export { validateSchema } from './validate';

// Auto-fix
export { autoFixSchema } from './auto-fix';

// Parsing & formatting
export { formatSchema, parseStructuredResponse } from './parse';

// LLM generation
export { generateSchemaFromDescription } from './generate';
