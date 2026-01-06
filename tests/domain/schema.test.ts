/**
 * Schema Validation Tests
 *
 * Tests for JSON schema validation and complexity estimation.
 * These are pure functions with no ST dependencies - ideal for unit testing.
 */

import { describe, it, expect } from 'vitest';
import { validateSchema, autoFixSchema } from '../../src/domain/schema';

describe('validateSchema', () => {
    describe('input handling', () => {
        it('returns valid for empty string input', () => {
            const result = validateSchema('');
            expect(result.valid).toBe(true);
            expect(result.schema).toBeUndefined();
        });

        it('returns valid for whitespace-only input', () => {
            const result = validateSchema('   \n\t  ');
            expect(result.valid).toBe(true);
            expect(result.schema).toBeUndefined();
        });

        it('returns error for invalid JSON', () => {
            const result = validateSchema('{ invalid json }');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('JSON syntax error');
        });

        it('returns error for JSON array', () => {
            const result = validateSchema('[]');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be a JSON object');
        });

        it('returns error for JSON primitive', () => {
            const result = validateSchema('"just a string"');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be a JSON object');
        });
    });

    describe('wrapper validation', () => {
        it('requires name property', () => {
            const result = validateSchema('{ "value": { "type": "object" } }');
            expect(result.valid).toBe(false);
            expect(result.error).toContain("Missing required 'name'");
        });

        it('rejects empty name', () => {
            const result = validateSchema(
                '{ "name": "", "value": { "type": "object" } }',
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain("'name' cannot be empty");
        });

        it('rejects invalid identifier names', () => {
            const result = validateSchema(
                '{ "name": "123-invalid", "value": { "type": "object" } }',
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be a valid identifier');
        });

        it('accepts valid identifier names', () => {
            const validNames = [
                'mySchema',
                '_private',
                'Schema123',
                'MY_SCHEMA',
            ];
            for (const name of validNames) {
                const result = validateSchema({
                    name,
                    value: { type: 'object', properties: {}, required: [] },
                });
                expect(result.valid).toBe(true);
            }
        });

        it('requires value property', () => {
            const result = validateSchema('{ "name": "test" }');
            expect(result.valid).toBe(false);
            expect(result.error).toContain("Missing or invalid 'value'");
        });

        it('rejects invalid strict value', () => {
            const result = validateSchema({
                name: 'test',
                strict: 'yes' as unknown as boolean,
                value: { type: 'object', properties: {}, required: [] },
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain("'strict' must be a boolean");
        });
    });

    describe('valid schemas', () => {
        it('validates minimal object schema', () => {
            const schema = {
                name: 'TestSchema',
                value: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                    },
                    required: ['id'],
                },
            };

            const result = validateSchema(schema);
            expect(result.valid).toBe(true);
            expect(result.schema).toBeDefined();
            expect(result.schema?.name).toBe('TestSchema');
            expect(result.schema?.strict).toBe(true); // Default
        });

        it('validates schema with strict: false', () => {
            const schema = {
                name: 'FlexibleSchema',
                strict: false,
                value: {
                    type: 'object',
                    properties: {},
                    required: [],
                },
            };

            const result = validateSchema(schema);
            expect(result.valid).toBe(true);
            expect(result.schema?.strict).toBe(false);
        });

        it('validates nested object schema', () => {
            const schema = {
                name: 'NestedSchema',
                value: {
                    type: 'object',
                    properties: {
                        user: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                age: { type: 'integer' },
                            },
                            required: ['name'],
                        },
                    },
                    required: ['user'],
                },
            };

            const result = validateSchema(schema);
            expect(result.valid).toBe(true);
        });

        it('validates array schema', () => {
            const schema = {
                name: 'ArraySchema',
                value: {
                    type: 'object',
                    properties: {
                        items: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                    },
                    required: ['items'],
                },
            };

            const result = validateSchema(schema);
            expect(result.valid).toBe(true);
        });

        it('validates enum schema', () => {
            const schema = {
                name: 'EnumSchema',
                value: {
                    type: 'object',
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['active', 'inactive', 'pending'],
                        },
                    },
                    required: ['status'],
                },
            };

            const result = validateSchema(schema);
            expect(result.valid).toBe(true);
        });

        it('accepts schema as JSON string', () => {
            const jsonString = JSON.stringify({
                name: 'StringSchema',
                value: {
                    type: 'object',
                    properties: { foo: { type: 'string' } },
                    required: ['foo'],
                },
            });

            const result = validateSchema(jsonString);
            expect(result.valid).toBe(true);
            expect(result.schema?.name).toBe('StringSchema');
        });
    });

    describe('schema info and warnings', () => {
        it('provides schema stats in info', () => {
            const schema = {
                name: 'InfoTest',
                value: {
                    type: 'object',
                    properties: {
                        a: { type: 'string' },
                        b: { type: 'number' },
                        c: { type: 'boolean' },
                    },
                    required: ['a', 'b', 'c'],
                },
            };

            const result = validateSchema(schema);
            expect(result.valid).toBe(true);
            expect(result.info).toBeDefined();
            expect(result.info?.[0]).toContain('Schema stats');
        });
    });
});

// =============================================================================
// TESTS: Malformed LLM Response Handling
// =============================================================================

describe('validateSchema - malformed LLM responses', () => {
    it('handles markdown-wrapped JSON (```json ... ```)', () => {
        const wrapped =
            '```json\n{ "name": "Test", "value": { "type": "object", "properties": {}, "required": [] } }\n```';
        const result = validateSchema(wrapped);

        // Should fail - validateSchema expects clean JSON, not markdown
        // This documents the current behavior for regression testing
        expect(result.valid).toBe(false);
        expect(result.error).toContain('JSON syntax error');
    });

    it('handles partial/truncated JSON', () => {
        const truncated = '{ "name": "Test", "value": { "type": "object"';
        const result = validateSchema(truncated);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('JSON syntax error');
    });

    it('handles JSON with trailing comma (common LLM mistake)', () => {
        const trailingComma =
            '{ "name": "Test", "value": { "type": "object", "properties": {}, "required": [], } }';
        const result = validateSchema(trailingComma);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('JSON syntax error');
    });

    it('handles JSON with comments (invalid but LLMs sometimes add them)', () => {
        const withComments = `{
            "name": "Test", // schema name
            "value": { "type": "object", "properties": {}, "required": [] }
        }`;
        const result = validateSchema(withComments);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('JSON syntax error');
    });

    it('handles completely non-JSON response', () => {
        const narrative =
            'Here is a schema for you:\nThe schema should have a name field...';
        const result = validateSchema(narrative);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('JSON syntax error');
    });

    it('handles valid JSON with wrong structure', () => {
        // Valid JSON but wrong schema wrapper structure
        const wrongStructure = '{ "schema_name": "Test", "definition": {} }';
        const result = validateSchema(wrongStructure);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Missing required 'name'");
    });

    it('handles null value in schema', () => {
        const withNull = { name: 'Test', value: null };
        const result = validateSchema(withNull);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Missing or invalid 'value'");
    });
});

describe('autoFixSchema', () => {
    it('returns schema with additionalProperties added', () => {
        const schema = {
            name: 'NeedsAdditionalProps',
            strict: true,
            value: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id'],
                // Missing additionalProperties - autoFix adds it
            },
        };

        const result = autoFixSchema(schema);
        expect(result).not.toBeNull();
        expect(result?.value.additionalProperties).toBe(false);
    });

    it('preserves existing additionalProperties: false', () => {
        const schema = {
            name: 'AlreadyHasAdditionalProps',
            strict: true,
            value: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id'],
                additionalProperties: false,
            },
        };

        const result = autoFixSchema(schema);
        // May return same schema or null depending on implementation
        if (result) {
            expect(result.value.additionalProperties).toBe(false);
        }
    });
});
