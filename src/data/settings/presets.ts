// src/data/settings/presets.ts
// =============================================================================
// PRESET CRUD (LEGACY API)
// =============================================================================
//
// This module provides backwards-compatible exports for preset operations.
// New code should use the PresetRegistry directly from './registry'.
//
// For validation, use validatePromptPreset/validateSchemaPreset from domain.
//
// =============================================================================

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
