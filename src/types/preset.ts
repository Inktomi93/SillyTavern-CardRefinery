// src/types/preset.ts
// =============================================================================
// PRESET TYPE DEFINITIONS
// =============================================================================

import type { StageName } from './stage';

/**
 * Unique identifier for a preset.
 */
export type PresetId = string;

/**
 * A saved prompt template.
 */
export interface PromptPreset {
    id: PresetId;
    name: string;
    stages: StageName[]; // empty = all stages
    prompt: string;
    isBuiltin: boolean;
    version: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * A saved structured output schema.
 */
export interface SchemaPreset {
    id: PresetId;
    name: string;
    stages: StageName[];
    schema: StructuredOutputSchema;
    isBuiltin: boolean;
    version: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * Schema for structured LLM output.
 */
export interface StructuredOutputSchema {
    name: string;
    strict?: boolean;
    value: JsonSchemaValue;
}

/**
 * JSON Schema value definition (subset we actually use).
 */
export interface JsonSchemaValue {
    type?: string | string[];
    properties?: Record<string, JsonSchemaValue>;
    additionalProperties?: boolean;
    required?: string[];
    items?: JsonSchemaValue;
    anyOf?: JsonSchemaValue[];
    allOf?: JsonSchemaValue[];
    enum?: unknown[];
    const?: unknown;
    description?: string;
    $ref?: string;
    $defs?: Record<string, JsonSchemaValue>;
    [key: string]: unknown;
}
