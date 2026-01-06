// src/domain/schema/auto-fix.ts
// =============================================================================
// SCHEMA AUTO-FIX UTILITIES
// =============================================================================

import type { JsonSchemaValue, StructuredOutputSchema } from '../../shared';
import { IGNORED_CONSTRAINTS } from './constants';

/**
 * Auto-fix common schema issues:
 * 1. Add additionalProperties: false to all objects
 * 2. Set strict: true if not set
 * 3. Move unsupported constraints to description
 *
 * @param schema - Schema to fix
 * @returns Fixed schema (cloned, original not modified)
 */
export function autoFixSchema(
    schema: StructuredOutputSchema,
): StructuredOutputSchema {
    const fixed = structuredClone(schema);

    // Ensure strict mode
    if (fixed.strict === undefined) {
        fixed.strict = true;
    }

    // Fix the value recursively
    fixSchemaNode(fixed.value);

    return fixed;
}

function fixSchemaNode(node: JsonSchemaValue): void {
    // Fix objects
    if (node.type === 'object') {
        node.additionalProperties = false;

        if (node.properties && typeof node.properties === 'object') {
            for (const prop of Object.values(node.properties)) {
                if (prop && typeof prop === 'object') {
                    fixSchemaNode(prop as JsonSchemaValue);
                }
            }
        }
    }

    // Fix arrays
    if (node.type === 'array' && node.items && typeof node.items === 'object') {
        if (!Array.isArray(node.items)) {
            fixSchemaNode(node.items as JsonSchemaValue);
        } else {
            node.items.forEach((item) => {
                if (item && typeof item === 'object') {
                    fixSchemaNode(item as JsonSchemaValue);
                }
            });
        }
    }

    // Fix anyOf
    if (node.anyOf && Array.isArray(node.anyOf)) {
        node.anyOf.forEach((variant) => {
            if (variant && typeof variant === 'object') {
                fixSchemaNode(variant as JsonSchemaValue);
            }
        });
    }

    // Fix allOf
    if (node.allOf && Array.isArray(node.allOf)) {
        node.allOf.forEach((variant) => {
            if (variant && typeof variant === 'object') {
                fixSchemaNode(variant as JsonSchemaValue);
            }
        });
    }

    // Move unsupported constraints to description
    const constraints: string[] = [];

    for (const key of IGNORED_CONSTRAINTS.numeric) {
        if (node[key] !== undefined) {
            constraints.push(`${key}: ${node[key]}`);
            delete node[key];
        }
    }

    for (const key of IGNORED_CONSTRAINTS.string) {
        if (node[key] !== undefined) {
            constraints.push(`${key}: ${node[key]}`);
            delete node[key];
        }
    }

    for (const key of IGNORED_CONSTRAINTS.array) {
        if (node[key] !== undefined) {
            constraints.push(`${key}: ${node[key]}`);
            delete node[key];
        }
    }

    // Fix minItems if invalid
    if (node.minItems !== undefined && node.minItems !== null) {
        const minItems = node.minItems as number;
        if (minItems !== 0 && minItems !== 1) {
            constraints.push(`minItems: ${minItems}`);
            node.minItems = minItems > 0 ? 1 : 0;
        }
    }

    // Append constraints to description
    if (constraints.length > 0) {
        const constraintNote = `[Constraints: ${constraints.join(', ')}]`;
        if (node.description) {
            node.description = `${node.description} ${constraintNote}`;
        } else {
            node.description = constraintNote;
        }
    }
}
