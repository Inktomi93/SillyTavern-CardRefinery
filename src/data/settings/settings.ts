// src/data/settings/settings.ts
// =============================================================================
// SETTINGS MANAGEMENT & MIGRATION
// =============================================================================

import { MODULE_NAME, SETTINGS_VERSION } from '../../shared';
import type { Settings, StageName, StageConfig } from '../../types';
import {
    DEFAULT_SETTINGS,
    BUILTIN_PROMPT_PRESETS,
    BUILTIN_SCHEMA_PRESETS,
} from './defaults';

// =============================================================================
// SETTINGS ACCESS
// =============================================================================

/**
 * Get extension settings, initializing if needed.
 *
 * Uses the ST-recommended pattern with lodash.merge for deep merging
 * and special handling for arrays (presets are replaced, not merged).
 */
export function getSettings(): Settings {
    const context = SillyTavern.getContext();
    const { lodash } = SillyTavern.libs;
    const ext = context.extensionSettings;

    // First time - initialize with defaults
    if (!ext[MODULE_NAME]) {
        ext[MODULE_NAME] = lodash.cloneDeep(DEFAULT_SETTINGS);
        save();
        return ext[MODULE_NAME] as Settings;
    }

    const existing = ext[MODULE_NAME] as Partial<Settings>;
    const oldVersion = existing.version ?? 0;

    // Migration needed?
    if (oldVersion < SETTINGS_VERSION) {
        // Run version-specific migrations first
        runMigrations(existing, oldVersion);

        // Merge with defaults
        const merged = mergeSettingsWithDefaults(existing);
        merged.version = SETTINGS_VERSION;

        // Ensure builtins are current
        syncBuiltinPresets(merged);

        // Write back and save
        ext[MODULE_NAME] = merged;
        save();

        return merged;
    }

    // No migration needed - just ensure valid structure
    const settings = existing as Settings;

    // Ensure preset arrays exist
    if (!settings.promptPresets) settings.promptPresets = [];
    if (!settings.schemaPresets) settings.schemaPresets = [];

    // Sync builtins if needed
    const builtinsChanged = syncBuiltinPresets(settings);
    if (builtinsChanged) save();

    return settings;
}

/**
 * Save settings (debounced by ST).
 */
export function save(): void {
    SillyTavern.getContext().saveSettingsDebounced();
}

/**
 * Reset settings to defaults.
 */
export function resetSettings(): Settings {
    const { lodash } = SillyTavern.libs;
    const ext = SillyTavern.getContext().extensionSettings;
    ext[MODULE_NAME] = lodash.cloneDeep(DEFAULT_SETTINGS);
    save();
    return ext[MODULE_NAME] as Settings;
}

// =============================================================================
// MIGRATION
// =============================================================================

type MigrationFn = (settings: Partial<Settings>) => void;

const migrations: Record<number, MigrationFn> = {
    // Example: v1 -> v2 migration
    // 2: (settings) => { ... },
};

function runMigrations(settings: Partial<Settings>, oldVersion: number): void {
    for (let v = oldVersion + 1; v <= SETTINGS_VERSION; v++) {
        const migration = migrations[v];
        if (migration) {
            migration(settings);
        }
    }
}

/**
 * Merge existing settings with defaults.
 * Arrays are REPLACED, not merged by index.
 */
function mergeSettingsWithDefaults(existing: Partial<Settings>): Settings {
    const { lodash } = SillyTavern.libs;

    // Save arrays before merge
    const promptPresets = existing.promptPresets
        ? [...existing.promptPresets]
        : [];
    const schemaPresets = existing.schemaPresets
        ? [...existing.schemaPresets]
        : [];

    // Deep merge scalar and object properties
    const merged = lodash.merge(
        structuredClone(DEFAULT_SETTINGS),
        existing,
    ) as Settings;

    // Restore arrays
    merged.promptPresets = promptPresets.length
        ? promptPresets
        : [...DEFAULT_SETTINGS.promptPresets];
    merged.schemaPresets = schemaPresets.length
        ? schemaPresets
        : [...DEFAULT_SETTINGS.schemaPresets];

    return merged;
}

/**
 * Ensure builtin presets are up to date.
 */
function syncBuiltinPresets(settings: Settings): boolean {
    const { lodash } = SillyTavern.libs;
    let changed = false;

    for (const builtin of BUILTIN_PROMPT_PRESETS) {
        const existing = settings.promptPresets.find(
            (p) => p.id === builtin.id,
        );

        if (!existing) {
            settings.promptPresets.push(lodash.cloneDeep(builtin));
            changed = true;
        } else if (existing.version < builtin.version) {
            Object.assign(existing, lodash.cloneDeep(builtin));
            changed = true;
        }
    }

    for (const builtin of BUILTIN_SCHEMA_PRESETS) {
        const existing = settings.schemaPresets.find(
            (p) => p.id === builtin.id,
        );

        if (!existing) {
            settings.schemaPresets.push(lodash.cloneDeep(builtin));
            changed = true;
        } else if (existing.version < builtin.version) {
            Object.assign(existing, lodash.cloneDeep(builtin));
            changed = true;
        }
    }

    return changed;
}

// =============================================================================
// STAGE DEFAULTS
// =============================================================================

/**
 * Get default config for a stage.
 */
export function getStageDefaults(stage: StageName): StageConfig {
    const { lodash } = SillyTavern.libs;
    const settings = getSettings();
    return lodash.cloneDeep(settings.stageDefaults[stage]);
}

/**
 * Update default config for a stage.
 */
export function setStageDefaults(stage: StageName, config: StageConfig): void {
    const { lodash } = SillyTavern.libs;
    const settings = getSettings();
    settings.stageDefaults[stage] = lodash.cloneDeep(config);
    save();
}

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

/**
 * Get combined system prompt for a stage.
 */
export function getSystemPrompt(stage: StageName): string {
    const settings = getSettings();
    const parts = [
        settings.baseSystemPrompt,
        settings.userSystemPrompt,
        settings.stageSystemPrompts[stage],
    ].filter((p) => p.trim());

    return parts.join('\n\n');
}

/**
 * Get combined refinement prompt.
 */
export function getRefinementPrompt(): string {
    const settings = getSettings();
    const parts = [
        settings.baseRefinementPrompt,
        settings.userRefinementPrompt,
    ].filter((p) => p.trim());

    return parts.join('\n\n');
}
