// src/domain/schema/constants.ts
// =============================================================================
// PROVIDER LIMITS AND CONSTRAINTS
// =============================================================================

/**
 * Anthropic API limits for structured output schemas.
 * Design schemas within these constraints for maximum compatibility.
 */
export const ANTHROPIC_LIMITS = {
    /** Maximum variants in an anyOf block */
    MAX_ANYOF_VARIANTS: 8,
    /** Maximum number of $defs/definitions */
    MAX_DEFS: 100,
    /** Maximum nesting depth */
    MAX_NESTING_DEPTH: 10,
    /** Maximum properties per object */
    MAX_PROPERTIES_PER_OBJECT: 100,
    /** Maximum enum values */
    MAX_ENUM_VALUES: 500,
    /** Supported string formats */
    SUPPORTED_STRING_FORMATS: [
        'date-time',
        'time',
        'date',
        'duration',
        'email',
        'hostname',
        'uri',
        'ipv4',
        'ipv6',
        'uuid',
    ] as const,
    /** Supported minItems values (only 0 or 1) */
    SUPPORTED_MIN_ITEMS: [0, 1] as const,
} as const;

/**
 * Constraints that are silently ignored (won't error, but won't work).
 */
export const IGNORED_CONSTRAINTS = {
    numeric: [
        'minimum',
        'maximum',
        'exclusiveMinimum',
        'exclusiveMaximum',
        'multipleOf',
    ],
    string: ['minLength', 'maxLength'],
    array: [
        'maxItems',
        'uniqueItems',
        'contains',
        'minContains',
        'maxContains',
    ],
    object: [
        'minProperties',
        'maxProperties',
        'propertyNames',
        'patternProperties',
    ],
} as const;

/**
 * Completely unsupported features that will cause errors.
 */
export const UNSUPPORTED_FEATURES = [
    'if',
    'then',
    'else', // Conditional schemas
    'not', // Negation
    'oneOf', // Use anyOf instead
    'dependentRequired',
    'dependentSchemas',
    'unevaluatedProperties', // OpenAPI 3.1
    'unevaluatedItems',
    '$dynamicRef',
    '$dynamicAnchor',
] as const;

/**
 * Unsupported regex features.
 */
export const UNSUPPORTED_REGEX_FEATURES = [
    { pattern: /\(\?[=!<]/, name: 'lookahead/lookbehind assertions' },
    { pattern: /\\[1-9]/, name: 'backreferences' },
    { pattern: /\\[bB]/, name: 'word boundaries' },
] as const;
