// src/domain/schema/types.ts
// =============================================================================
// SCHEMA VALIDATION TYPES
// =============================================================================

import type { JsonSchemaValue, StructuredOutputSchema } from '../../shared';

export interface SchemaValidationResult {
    /** Whether the schema is valid */
    valid: boolean;
    /** Parsed schema if valid */
    schema?: StructuredOutputSchema;
    /** Error message if invalid */
    error?: string;
    /** Warnings (schema works but has issues) */
    warnings?: string[];
    /** Informational messages */
    info?: string[];
}

export interface ValidationContext {
    errors: string[];
    warnings: string[];
    info: string[];
    stats: {
        defCount: number;
        anyOfCount: number;
        totalAnyOfVariants: number;
        maxDepth: number;
        propertyCount: number;
        optionalFieldCount: number;
        enumCount: number;
    };
    currentDepth: number;
    seenRefs: Set<string>;
    defs: Record<string, JsonSchemaValue>;
}
