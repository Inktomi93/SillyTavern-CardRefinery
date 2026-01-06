// src/domain/schema/validate.ts
// =============================================================================
// JSON SCHEMA VALIDATION FOR STRUCTURED OUTPUT
//
// Validates schemas against Anthropic/OpenAI structured output constraints.
// Use this to validate user-provided schemas before sending to the LLM.
// =============================================================================

import type { JsonSchemaValue, StructuredOutputSchema } from '../../shared';
import {
    ANTHROPIC_LIMITS,
    IGNORED_CONSTRAINTS,
    UNSUPPORTED_FEATURES,
    UNSUPPORTED_REGEX_FEATURES,
} from './constants';
import type { SchemaValidationResult, ValidationContext } from './types';

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate a JSON schema for structured output compatibility.
 *
 * Checks:
 * - JSON syntax validity
 * - Required wrapper structure (name, value)
 * - Anthropic-specific limits (anyOf variants, nesting depth, etc.)
 * - Required additionalProperties: false on all objects
 * - Unsupported JSON Schema features
 * - Regex pattern compatibility
 *
 * @param input - JSON string or StructuredOutputSchema object
 * @returns Validation result with parsed schema or errors
 *
 * @example
 * ```ts
 * const result = validateSchema(userInput);
 * if (!result.valid) {
 *     toast.error(result.error);
 *     return;
 * }
 * // Use result.schema
 * ```
 */
export function validateSchema(
    input: string | StructuredOutputSchema,
): SchemaValidationResult {
    // Handle empty input
    if (typeof input === 'string' && !input.trim()) {
        return { valid: true, schema: undefined };
    }

    // Parse JSON if string
    let parsed: unknown;
    if (typeof input === 'string') {
        try {
            parsed = JSON.parse(input);
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Invalid JSON';
            const match = error.match(/position (\d+)/);
            const position = match ? ` (character ${match[1]})` : '';
            return {
                valid: false,
                error: `JSON syntax error${position}: ${error}`,
            };
        }
    } else {
        parsed = input;
    }

    // Must be an object
    if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
    ) {
        return {
            valid: false,
            error:
                'Schema must be a JSON object, not ' +
                (Array.isArray(parsed) ? 'array' : typeof parsed),
        };
    }

    const obj = parsed as Record<string, unknown>;

    // ========== WRAPPER VALIDATION ==========

    // Required: name (string, non-empty, valid identifier)
    if (typeof obj.name !== 'string') {
        return {
            valid: false,
            error: "Missing required 'name' property (string)",
        };
    }
    if (!obj.name.trim()) {
        return { valid: false, error: "'name' cannot be empty" };
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(obj.name)) {
        return {
            valid: false,
            error: `'name' must be a valid identifier (got '${obj.name}'). Use letters, numbers, underscores; start with letter or underscore.`,
        };
    }

    // Required: value (object with type)
    if (
        typeof obj.value !== 'object' ||
        obj.value === null ||
        Array.isArray(obj.value)
    ) {
        return {
            valid: false,
            error: "Missing or invalid 'value' property (must be object)",
        };
    }

    const value = obj.value as JsonSchemaValue;

    if (
        typeof value.type !== 'string' &&
        !value.anyOf &&
        !value.allOf &&
        !value.$ref
    ) {
        return {
            valid: false,
            error: "'value' must have a 'type', 'anyOf', 'allOf', or '$ref'",
        };
    }

    // Optional: strict (boolean)
    if (obj.strict !== undefined && typeof obj.strict !== 'boolean') {
        return {
            valid: false,
            error: "'strict' must be a boolean if provided",
        };
    }

    // ========== DEEP SCHEMA VALIDATION ==========

    const ctx: ValidationContext = {
        errors: [],
        warnings: [],
        info: [],
        stats: {
            defCount: 0,
            anyOfCount: 0,
            totalAnyOfVariants: 0,
            maxDepth: 0,
            propertyCount: 0,
            optionalFieldCount: 0,
            enumCount: 0,
        },
        currentDepth: 0,
        seenRefs: new Set(),
        defs: {},
    };

    // Extract $defs/definitions
    if (value.$defs && typeof value.$defs === 'object') {
        ctx.defs = value.$defs as Record<string, JsonSchemaValue>;
        ctx.stats.defCount = Object.keys(ctx.defs).length;
    } else if (value.definitions && typeof value.definitions === 'object') {
        ctx.defs = value.definitions as Record<string, JsonSchemaValue>;
        ctx.stats.defCount = Object.keys(ctx.defs).length;
    }

    if (ctx.stats.defCount > ANTHROPIC_LIMITS.MAX_DEFS) {
        ctx.errors.push(
            `Too many definitions: ${ctx.stats.defCount} (limit: ${ANTHROPIC_LIMITS.MAX_DEFS})`,
        );
    }

    // Validate the schema tree
    validateSchemaNode(value, 'value', ctx);

    // Check optional field explosion
    if (ctx.stats.optionalFieldCount > 0) {
        const implicitAnyOfs = ctx.stats.optionalFieldCount;
        const totalAnyOfs = ctx.stats.totalAnyOfVariants + implicitAnyOfs * 2;

        if (implicitAnyOfs > 10) {
            ctx.warnings.push(
                `${implicitAnyOfs} optional fields detected. Each spawns an implicit anyOf with null. Consider making fields required or reducing optionals.`,
            );
        }

        if (totalAnyOfs > 50) {
            ctx.warnings.push(
                `High anyOf count (~${totalAnyOfs} including implicit nullables). May cause slow schema compilation or errors.`,
            );
        }
    }

    // ========== BUILD RESULT ==========

    if (ctx.errors.length > 0) {
        return {
            valid: false,
            error: ctx.errors.join('\n'),
            warnings: ctx.warnings.length > 0 ? ctx.warnings : undefined,
        };
    }

    const schema: StructuredOutputSchema = {
        name: obj.name,
        strict: (obj.strict as boolean | undefined) ?? true,
        value: value,
    };

    // Add stats as info
    ctx.info.push(
        `Schema stats: ${ctx.stats.propertyCount} properties, ` +
            `${ctx.stats.defCount} definitions, ` +
            `${ctx.stats.anyOfCount} anyOf blocks, ` +
            `${ctx.stats.optionalFieldCount} optional fields, ` +
            `max depth ${ctx.stats.maxDepth}`,
    );

    return {
        valid: true,
        schema,
        warnings: ctx.warnings.length > 0 ? ctx.warnings : undefined,
        info: ctx.info.length > 0 ? ctx.info : undefined,
    };
}

// =============================================================================
// RECURSIVE NODE VALIDATION
// =============================================================================

function validateSchemaNode(
    node: JsonSchemaValue,
    path: string,
    ctx: ValidationContext,
): void {
    ctx.currentDepth++;
    ctx.stats.maxDepth = Math.max(ctx.stats.maxDepth, ctx.currentDepth);

    // Check nesting depth
    if (ctx.currentDepth > ANTHROPIC_LIMITS.MAX_NESTING_DEPTH) {
        ctx.errors.push(
            `${path}: Exceeds maximum nesting depth of ${ANTHROPIC_LIMITS.MAX_NESTING_DEPTH}`,
        );
        ctx.currentDepth--;
        return;
    }

    // Check for completely unsupported features
    for (const feature of UNSUPPORTED_FEATURES) {
        if (node[feature] !== undefined) {
            ctx.errors.push(`${path}: '${feature}' is not supported`);
        }
    }

    // Check for ignored constraints (warn, don't error)
    for (const key of IGNORED_CONSTRAINTS.numeric) {
        if (node[key] !== undefined) {
            ctx.warnings.push(
                `${path}: '${key}' will be ignored (not supported)`,
            );
        }
    }
    for (const key of IGNORED_CONSTRAINTS.string) {
        if (node[key] !== undefined) {
            ctx.warnings.push(
                `${path}: '${key}' will be ignored (not supported)`,
            );
        }
    }
    for (const key of IGNORED_CONSTRAINTS.array) {
        if (node[key] !== undefined) {
            ctx.warnings.push(
                `${path}: '${key}' will be ignored (not supported)`,
            );
        }
    }
    for (const key of IGNORED_CONSTRAINTS.object) {
        if (node[key] !== undefined) {
            ctx.warnings.push(
                `${path}: '${key}' will be ignored (not supported)`,
            );
        }
    }

    // Handle $ref
    if (node.$ref && typeof node.$ref === 'string') {
        validateRef(node.$ref, path, ctx);
        ctx.currentDepth--;
        return;
    }

    // Handle type-specific validation
    const types = Array.isArray(node.type) ? node.type : [node.type];

    for (const type of types) {
        switch (type) {
            case 'object':
                validateObjectNode(node, path, ctx);
                break;
            case 'array':
                validateArrayNode(node, path, ctx);
                break;
            case 'string':
                validateStringNode(node, path, ctx);
                break;
            case 'number':
            case 'integer':
            case 'boolean':
            case 'null':
                // No special validation needed
                break;
            default:
                if (type && !node.anyOf && !node.allOf) {
                    ctx.warnings.push(`${path}: Unknown type '${type}'`);
                }
        }
    }

    // Handle anyOf
    if (node.anyOf && Array.isArray(node.anyOf)) {
        validateAnyOf(node.anyOf, path, ctx);
    }

    // Handle allOf
    if (node.allOf && Array.isArray(node.allOf)) {
        validateAllOf(node.allOf, path, ctx);
    }

    // Handle enum
    if (node.enum && Array.isArray(node.enum)) {
        validateEnum(node.enum, path, ctx);
    }

    // Handle const
    if (node.const !== undefined) {
        validateConst(node.const, path, ctx);
    }

    ctx.currentDepth--;
}

// =============================================================================
// TYPE-SPECIFIC VALIDATORS
// =============================================================================

function validateObjectNode(
    node: JsonSchemaValue,
    path: string,
    ctx: ValidationContext,
): void {
    // CRITICAL: additionalProperties must be false
    if (node.additionalProperties !== false) {
        ctx.warnings.push(
            `${path}: Missing 'additionalProperties: false' (REQUIRED for Anthropic)`,
        );
    }

    // Validate properties
    if (node.properties && typeof node.properties === 'object') {
        const props = node.properties as Record<string, JsonSchemaValue>;
        const propCount = Object.keys(props).length;
        ctx.stats.propertyCount += propCount;

        if (propCount > ANTHROPIC_LIMITS.MAX_PROPERTIES_PER_OBJECT) {
            ctx.warnings.push(
                `${path}: ${propCount} properties (may be slow, consider splitting)`,
            );
        }

        // Track optional fields
        const required = (node.required as string[]) || [];
        for (const [key, prop] of Object.entries(props)) {
            if (!required.includes(key)) {
                ctx.stats.optionalFieldCount++;
            }

            if (prop && typeof prop === 'object') {
                validateSchemaNode(prop, `${path}.${key}`, ctx);
            }
        }
    }
}

function validateArrayNode(
    node: JsonSchemaValue,
    path: string,
    ctx: ValidationContext,
): void {
    // minItems only supports 0 or 1
    if (node.minItems !== undefined) {
        const allowed =
            ANTHROPIC_LIMITS.SUPPORTED_MIN_ITEMS as readonly number[];
        if (!allowed.includes(node.minItems as number)) {
            ctx.warnings.push(
                `${path}: 'minItems: ${node.minItems}' not supported (only 0 or 1 allowed)`,
            );
        }
    }

    // Validate items schema
    if (node.items) {
        if (typeof node.items === 'object' && !Array.isArray(node.items)) {
            validateSchemaNode(
                node.items as JsonSchemaValue,
                `${path}.items`,
                ctx,
            );
        } else if (Array.isArray(node.items)) {
            node.items.forEach((item, i) => {
                if (item && typeof item === 'object') {
                    validateSchemaNode(
                        item as JsonSchemaValue,
                        `${path}.items[${i}]`,
                        ctx,
                    );
                }
            });
        }
    }

    // prefixItems (JSON Schema draft 2020-12)
    if (node.prefixItems && Array.isArray(node.prefixItems)) {
        node.prefixItems.forEach((item, i) => {
            if (item && typeof item === 'object') {
                validateSchemaNode(
                    item as JsonSchemaValue,
                    `${path}.prefixItems[${i}]`,
                    ctx,
                );
            }
        });
    }
}

function validateStringNode(
    node: JsonSchemaValue,
    path: string,
    ctx: ValidationContext,
): void {
    // Check format
    if (node.format && typeof node.format === 'string') {
        const supported =
            ANTHROPIC_LIMITS.SUPPORTED_STRING_FORMATS as readonly string[];
        if (!supported.includes(node.format)) {
            ctx.warnings.push(
                `${path}: format '${node.format}' may not be supported. Supported: ${supported.join(', ')}`,
            );
        }
    }

    // Check pattern (regex)
    if (node.pattern && typeof node.pattern === 'string') {
        validateRegexPattern(node.pattern, path, ctx);
    }
}

function validateRef(ref: string, path: string, ctx: ValidationContext): void {
    // External refs not supported
    if (ref.startsWith('http://') || ref.startsWith('https://')) {
        ctx.errors.push(`${path}: External $ref not supported ('${ref}')`);
        return;
    }

    // Check for circular refs
    if (ctx.seenRefs.has(ref)) {
        ctx.info.push(`${path}: Circular reference to '${ref}'`);
        return;
    }

    ctx.seenRefs.add(ref);

    // Validate the referenced definition exists
    const refPath = ref.replace(/^#\/(\$defs|definitions)\//, '');
    if (!ctx.defs[refPath]) {
        ctx.errors.push(`${path}: Reference '${ref}' not found in definitions`);
    }
}

function validateAnyOf(
    variants: unknown[],
    path: string,
    ctx: ValidationContext,
): void {
    ctx.stats.anyOfCount++;
    ctx.stats.totalAnyOfVariants += variants.length;

    if (variants.length > ANTHROPIC_LIMITS.MAX_ANYOF_VARIANTS) {
        ctx.errors.push(
            `${path}: anyOf has ${variants.length} variants (max: ${ANTHROPIC_LIMITS.MAX_ANYOF_VARIANTS})`,
        );
    }

    if (variants.length === 0) {
        ctx.errors.push(`${path}: anyOf cannot be empty`);
        return;
    }

    variants.forEach((variant, i) => {
        if (variant && typeof variant === 'object') {
            validateSchemaNode(
                variant as JsonSchemaValue,
                `${path}.anyOf[${i}]`,
                ctx,
            );
        }
    });
}

function validateAllOf(
    variants: unknown[],
    path: string,
    ctx: ValidationContext,
): void {
    if (variants.length === 0) {
        ctx.errors.push(`${path}: allOf cannot be empty`);
        return;
    }

    variants.forEach((variant, i) => {
        if (variant && typeof variant === 'object') {
            const v = variant as Record<string, unknown>;

            // allOf with $ref not supported
            if (v.$ref) {
                ctx.errors.push(
                    `${path}.allOf[${i}]: allOf with $ref not supported`,
                );
            }

            validateSchemaNode(
                v as JsonSchemaValue,
                `${path}.allOf[${i}]`,
                ctx,
            );
        }
    });
}

function validateEnum(
    values: unknown[],
    path: string,
    ctx: ValidationContext,
): void {
    ctx.stats.enumCount++;

    if (values.length === 0) {
        ctx.errors.push(`${path}: enum cannot be empty`);
        return;
    }

    if (values.length > ANTHROPIC_LIMITS.MAX_ENUM_VALUES) {
        ctx.warnings.push(
            `${path}: enum has ${values.length} values (may be slow)`,
        );
    }

    // Check for complex types (not allowed)
    for (let i = 0; i < values.length; i++) {
        const val = values[i];
        const t = typeof val;

        if (
            t !== 'string' &&
            t !== 'number' &&
            t !== 'boolean' &&
            val !== null
        ) {
            ctx.errors.push(
                `${path}.enum[${i}]: Complex type not allowed in enum (got ${t}). Only string, number, boolean, null permitted.`,
            );
            break;
        }
    }

    // Check for duplicates
    const seen = new Set();
    for (const val of values) {
        const key = JSON.stringify(val);
        if (seen.has(key)) {
            ctx.warnings.push(`${path}: Duplicate value in enum: ${key}`);
            break;
        }
        seen.add(key);
    }
}

function validateConst(
    value: unknown,
    path: string,
    ctx: ValidationContext,
): void {
    const t = typeof value;
    if (t !== 'string' && t !== 'number' && t !== 'boolean' && value !== null) {
        ctx.errors.push(
            `${path}: const must be string, number, boolean, or null (got ${t})`,
        );
    }
}

function validateRegexPattern(
    pattern: string,
    path: string,
    ctx: ValidationContext,
): void {
    // Check for unsupported regex features
    for (const { pattern: check, name } of UNSUPPORTED_REGEX_FEATURES) {
        if (check.test(pattern)) {
            ctx.errors.push(
                `${path}: Regex pattern uses unsupported feature: ${name}`,
            );
        }
    }

    // Try to compile the regex to catch syntax errors
    try {
        new RegExp(pattern);
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid regex';
        ctx.errors.push(`${path}: Invalid regex pattern: ${msg}`);
    }

    // Warn about complex quantifiers
    const complexQuantifier = /\{(\d+),(\d+)\}/g;
    let match;
    while ((match = complexQuantifier.exec(pattern)) !== null) {
        const min = parseInt(match[1], 10);
        const max = parseInt(match[2], 10);
        if (max - min > 100) {
            ctx.warnings.push(
                `${path}: Large quantifier range {${min},${max}} may cause issues`,
            );
        }
    }
}
