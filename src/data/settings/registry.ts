// src/data/settings/registry.ts
// =============================================================================
// PRESET REGISTRY - CENTRALIZED PRESET MANAGEMENT
// =============================================================================
//
// The registry provides a unified interface for preset operations with:
// - Type-safe registration and lookup
// - Event-based change notifications
// - Builtin vs user preset distinction
// - Migration support through versioning
//
// =============================================================================

import { PRESET_VERSION } from '../../shared';
import type {
    PresetId,
    PromptPreset,
    SchemaPreset,
    StageName,
} from '../../types';
import { getSettings, save } from './settings';

// =============================================================================
// TYPES
// =============================================================================

export type PresetType = 'prompt' | 'schema';
export type AnyPreset = PromptPreset | SchemaPreset;

export interface RegistryEvent<T extends AnyPreset = AnyPreset> {
    type: 'add' | 'update' | 'delete';
    presetType: PresetType;
    preset: T;
    previousValue?: T;
}

export type RegistryListener<T extends AnyPreset = AnyPreset> = (
    event: RegistryEvent<T>,
) => void;

export interface PresetFilter {
    stage?: StageName;
    builtinOnly?: boolean;
    userOnly?: boolean;
}

// =============================================================================
// PRESET REGISTRY CLASS
// =============================================================================

class PresetRegistry {
    private listeners: Set<RegistryListener> = new Set();

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

    /**
     * Get all prompt presets, optionally filtered.
     */
    getPromptPresets = (filter?: PresetFilter): PromptPreset[] => {
        const settings = getSettings();
        return this.applyFilter(settings.promptPresets, filter);
    };

    /**
     * Get all schema presets, optionally filtered.
     */
    getSchemaPresets = (filter?: PresetFilter): SchemaPreset[] => {
        const settings = getSettings();
        return this.applyFilter(settings.schemaPresets, filter);
    };

    /**
     * Get a prompt preset by ID.
     */
    getPromptPreset = (id: PresetId): PromptPreset | null => {
        const settings = getSettings();
        return settings.promptPresets.find((p) => p.id === id) ?? null;
    };

    /**
     * Get a schema preset by ID.
     */
    getSchemaPreset = (id: PresetId): SchemaPreset | null => {
        const settings = getSettings();
        return settings.schemaPresets.find((p) => p.id === id) ?? null;
    };

    /**
     * Get presets for a specific stage.
     */
    getPresetsForStage = (type: PresetType, stage: StageName): AnyPreset[] => {
        return type === 'prompt'
            ? this.getPromptPresets({ stage })
            : this.getSchemaPresets({ stage });
    };

    /**
     * Check if a preset exists.
     */
    exists = (type: PresetType, id: PresetId): boolean => {
        return type === 'prompt'
            ? this.getPromptPreset(id) !== null
            : this.getSchemaPreset(id) !== null;
    };

    /**
     * Check if a preset is builtin.
     */
    isBuiltin = (type: PresetType, id: PresetId): boolean => {
        const preset =
            type === 'prompt'
                ? this.getPromptPreset(id)
                : this.getSchemaPreset(id);
        return preset?.isBuiltin ?? false;
    };

    // =========================================================================
    // MUTATION METHODS
    // =========================================================================

    /**
     * Register a new prompt preset.
     */
    registerPromptPreset = (
        data: Omit<
            PromptPreset,
            'id' | 'version' | 'createdAt' | 'updatedAt' | 'isBuiltin'
        >,
    ): PromptPreset => {
        const settings = getSettings();

        const preset: PromptPreset = {
            ...data,
            id: crypto.randomUUID(),
            isBuiltin: false,
            version: PRESET_VERSION,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        settings.promptPresets.push(preset);
        save();

        this.emit({ type: 'add', presetType: 'prompt', preset });
        return preset;
    };

    /**
     * Register a new schema preset.
     */
    registerSchemaPreset = (
        data: Omit<
            SchemaPreset,
            'id' | 'version' | 'createdAt' | 'updatedAt' | 'isBuiltin'
        >,
    ): SchemaPreset => {
        const settings = getSettings();

        const preset: SchemaPreset = {
            ...data,
            id: crypto.randomUUID(),
            isBuiltin: false,
            version: PRESET_VERSION,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        settings.schemaPresets.push(preset);
        save();

        this.emit({ type: 'add', presetType: 'schema', preset });
        return preset;
    };

    /**
     * Update an existing prompt preset (user presets only).
     */
    updatePromptPreset = (
        id: PresetId,
        updates: Partial<Omit<PromptPreset, 'id' | 'isBuiltin' | 'createdAt'>>,
    ): boolean => {
        const settings = getSettings();
        const preset = settings.promptPresets.find((p) => p.id === id);

        if (!preset || preset.isBuiltin) {
            return false;
        }

        const previousValue = { ...preset };
        Object.assign(preset, updates, { updatedAt: Date.now() });
        save();

        this.emit({
            type: 'update',
            presetType: 'prompt',
            preset,
            previousValue,
        });
        return true;
    };

    /**
     * Update an existing schema preset (user presets only).
     */
    updateSchemaPreset = (
        id: PresetId,
        updates: Partial<Omit<SchemaPreset, 'id' | 'isBuiltin' | 'createdAt'>>,
    ): boolean => {
        const settings = getSettings();
        const preset = settings.schemaPresets.find((p) => p.id === id);

        if (!preset || preset.isBuiltin) {
            return false;
        }

        const previousValue = { ...preset };
        Object.assign(preset, updates, { updatedAt: Date.now() });
        save();

        this.emit({
            type: 'update',
            presetType: 'schema',
            preset,
            previousValue,
        });
        return true;
    };

    /**
     * Delete a prompt preset (user presets only).
     */
    deletePromptPreset = (id: PresetId): boolean => {
        const settings = getSettings();
        const index = settings.promptPresets.findIndex(
            (p) => p.id === id && !p.isBuiltin,
        );

        if (index === -1) {
            return false;
        }

        const [deleted] = settings.promptPresets.splice(index, 1);
        save();

        this.emit({ type: 'delete', presetType: 'prompt', preset: deleted });
        return true;
    };

    /**
     * Delete a schema preset (user presets only).
     */
    deleteSchemaPreset = (id: PresetId): boolean => {
        const settings = getSettings();
        const index = settings.schemaPresets.findIndex(
            (p) => p.id === id && !p.isBuiltin,
        );

        if (index === -1) {
            return false;
        }

        const [deleted] = settings.schemaPresets.splice(index, 1);
        save();

        this.emit({ type: 'delete', presetType: 'schema', preset: deleted });
        return true;
    };

    /**
     * Duplicate a preset (creates a user copy of any preset, including builtins).
     */
    duplicatePromptPreset = (
        id: PresetId,
        newName?: string,
    ): PromptPreset | null => {
        const original = this.getPromptPreset(id);
        if (!original) return null;

        const name = newName || `${original.name} (Copy)`;
        return this.registerPromptPreset({
            name,
            stages: [...original.stages],
            prompt: original.prompt,
        });
    };

    /**
     * Duplicate a schema preset.
     */
    duplicateSchemaPreset = (
        id: PresetId,
        newName?: string,
    ): SchemaPreset | null => {
        const original = this.getSchemaPreset(id);
        if (!original) return null;

        const { lodash } = SillyTavern.libs;
        const name = newName || `${original.name} (Copy)`;

        return this.registerSchemaPreset({
            name,
            stages: [...original.stages],
            schema: lodash.cloneDeep(original.schema),
        });
    };

    // =========================================================================
    // EVENT SUBSCRIPTION
    // =========================================================================

    /**
     * Subscribe to registry changes.
     */
    subscribe = (listener: RegistryListener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Check if a preset name is unique.
     */
    isNameUnique = (
        type: PresetType,
        name: string,
        excludeId?: PresetId,
    ): boolean => {
        const presets =
            type === 'prompt'
                ? this.getPromptPresets()
                : this.getSchemaPresets();

        return !presets.some(
            (p) =>
                p.name.toLowerCase() === name.toLowerCase() &&
                p.id !== excludeId,
        );
    };

    /**
     * Generate a unique name for a preset.
     */
    generateUniqueName = (type: PresetType, baseName: string): string => {
        let name = baseName;
        let counter = 1;

        while (!this.isNameUnique(type, name)) {
            name = `${baseName} (${counter})`;
            counter++;
        }

        return name;
    };

    /**
     * Get display name for a preset ID.
     */
    getDisplayName = (type: PresetType, id: PresetId | null): string => {
        if (!id) return 'Custom';

        const preset =
            type === 'prompt'
                ? this.getPromptPreset(id)
                : this.getSchemaPreset(id);

        if (!preset) return 'Unknown';
        return preset.isBuiltin ? `${preset.name} (builtin)` : preset.name;
    };

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private applyFilter<T extends AnyPreset>(
        presets: T[],
        filter?: PresetFilter,
    ): T[] {
        if (!filter) return presets;

        return presets.filter((p) => {
            // Filter by stage
            if (filter.stage) {
                const matchesStage =
                    p.stages.length === 0 || p.stages.includes(filter.stage);
                if (!matchesStage) return false;
            }

            // Filter by builtin status
            if (filter.builtinOnly && !p.isBuiltin) return false;
            if (filter.userOnly && p.isBuiltin) return false;

            return true;
        });
    }

    private emit(event: RegistryEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (e) {
                console.error('[PresetRegistry] Listener error:', e);
            }
        }
    }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const presetRegistry = new PresetRegistry();

// =============================================================================
// CONVENIENCE EXPORTS (for backwards compatibility)
// =============================================================================

export const {
    getPromptPresets,
    getSchemaPresets,
    getPromptPreset,
    getSchemaPreset,
    getPresetsForStage,
    registerPromptPreset,
    registerSchemaPreset,
    updatePromptPreset,
    updateSchemaPreset,
    deletePromptPreset,
    deleteSchemaPreset,
    duplicatePromptPreset,
    duplicateSchemaPreset,
    isNameUnique,
    generateUniqueName,
    getDisplayName,
    subscribe,
} = presetRegistry;
