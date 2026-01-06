// src/data/settings/presets.ts
// =============================================================================
// PRESET CRUD & VALIDATION (LEGACY API)
// =============================================================================
//
// This module provides backwards-compatible exports for preset operations.
// New code should use the PresetRegistry directly from './registry'.
//
// =============================================================================

import { validateSchema } from '../../domain/schema';
import type { PromptPreset, SchemaPreset, StageName } from '../../types';
import {
    getPromptPresets as registryGetPromptPresets,
    getSchemaPresets as registryGetSchemaPresets,
    getPromptPreset as registryGetPromptPreset,
    getSchemaPreset as registryGetSchemaPreset,
    registerPromptPreset,
    registerSchemaPreset,
    updatePromptPreset as registryUpdatePromptPreset,
    updateSchemaPreset as registryUpdateSchemaPreset,
    deletePromptPreset as registryDeletePromptPreset,
    deleteSchemaPreset as registryDeleteSchemaPreset,
} from './registry';

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface PresetValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// =============================================================================
// PROMPT PRESETS (Legacy API)
// =============================================================================

/**
 * Get all prompt presets for a stage.
 */
export function getPromptPresetsForStage(stage: StageName): PromptPreset[] {
    return registryGetPromptPresets({ stage });
}

/**
 * Get a prompt preset by ID.
 */
export function getPromptPreset(id: string): PromptPreset | null {
    return registryGetPromptPreset(id);
}

/**
 * Save a new prompt preset.
 */
export function savePromptPreset(
    preset: Omit<
        PromptPreset,
        'id' | 'version' | 'createdAt' | 'updatedAt' | 'isBuiltin'
    >,
): PromptPreset {
    return registerPromptPreset(preset);
}

/**
 * Update an existing prompt preset.
 */
export function updatePromptPreset(
    id: string,
    updates: Partial<PromptPreset>,
): boolean {
    return registryUpdatePromptPreset(id, updates);
}

/**
 * Delete a prompt preset.
 */
export function deletePromptPreset(id: string): boolean {
    return registryDeletePromptPreset(id);
}

// =============================================================================
// SCHEMA PRESETS (Legacy API)
// =============================================================================

/**
 * Get all schema presets for a stage.
 */
export function getSchemaPresetsForStage(stage: StageName): SchemaPreset[] {
    return registryGetSchemaPresets({ stage });
}

/**
 * Get a schema preset by ID.
 */
export function getSchemaPreset(id: string): SchemaPreset | null {
    return registryGetSchemaPreset(id);
}

/**
 * Save a new schema preset.
 */
export function saveSchemaPreset(
    preset: Omit<
        SchemaPreset,
        'id' | 'version' | 'createdAt' | 'updatedAt' | 'isBuiltin'
    >,
): SchemaPreset {
    return registerSchemaPreset(preset);
}

/**
 * Update an existing schema preset.
 */
export function updateSchemaPreset(
    id: string,
    updates: Partial<SchemaPreset>,
): boolean {
    return registryUpdateSchemaPreset(id, updates);
}

/**
 * Delete a schema preset.
 */
export function deleteSchemaPreset(id: string): boolean {
    return registryDeleteSchemaPreset(id);
}

// =============================================================================
// PRESET VALIDATION
// =============================================================================

/**
 * Validate a prompt preset before saving.
 */
export function validatePromptPreset(
    preset: Partial<PromptPreset>,
): PresetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Name validation
    if (!preset.name?.trim()) {
        errors.push('Name is required');
    } else if (preset.name.length > 100) {
        errors.push('Name must be 100 characters or less');
    }

    // Prompt validation
    if (!preset.prompt?.trim()) {
        errors.push('Prompt is required');
    } else if (preset.prompt.length > 50000) {
        errors.push('Prompt is too long (max 50,000 characters)');
    }

    // Check for common issues
    if (preset.prompt) {
        // Warn about {{user}} since we don't replace it
        if (/\{\{user\}\}/i.test(preset.prompt)) {
            warnings.push(
                '{{user}} is not replaced - user persona is not relevant to card analysis',
            );
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Validate a schema preset before saving.
 */
export function validateSchemaPreset(
    preset: Partial<SchemaPreset>,
): PresetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Name validation
    if (!preset.name?.trim()) {
        errors.push('Name is required');
    } else if (preset.name.length > 100) {
        errors.push('Name must be 100 characters or less');
    }

    // Schema validation
    if (!preset.schema) {
        errors.push('Schema is required');
    } else {
        const schemaJson =
            typeof preset.schema === 'string'
                ? preset.schema
                : JSON.stringify(preset.schema);

        const result = validateSchema(schemaJson);
        if (!result.valid) {
            errors.push(result.error || 'Invalid schema');
        }
        if (result.warnings) {
            warnings.push(...result.warnings);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
