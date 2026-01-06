// src/ui/components/preset-drawer/actions.ts
// =============================================================================
// SAVE, DELETE, IMPORT/EXPORT HANDLERS
// =============================================================================

import { MODULE_NAME, VERSION, popup, toast, log } from '../../../shared';
import { STAGES } from '../../../shared/constants';
import {
    presetRegistry,
    validatePromptPreset,
    validateSchemaPreset,
    getSettings,
    save,
} from '../../../data';
import { $, $$ } from '../base';
import { drawerState, drawerCallbacks } from './state';
import { showFormErrors } from './form-view';
import { refreshListView } from './list-view';
import type {
    StageName,
    PromptPreset,
    SchemaPreset,
    StructuredOutputSchema,
} from '../../../types';

// =============================================================================
// SAVE HANDLER
// =============================================================================

export async function handleSave(closeDrawer: () => void): Promise<void> {
    const { type, mode, preset } = drawerState;

    // Gather form data
    const nameInput = $(`#${MODULE_NAME}_drawer_name`) as HTMLInputElement;
    const name = nameInput?.value.trim() || '';

    const stageCheckboxes = $$(
        'input[name="drawer_stages"]:checked',
    ) as HTMLInputElement[];
    const stages = Array.from(stageCheckboxes).map(
        (cb) => cb.value as StageName,
    );
    const finalStages = stages.length === STAGES.length ? [] : stages;

    if (type === 'prompt') {
        const promptTextarea = $(
            `#${MODULE_NAME}_drawer_prompt`,
        ) as HTMLTextAreaElement;
        const prompt = promptTextarea?.value || '';

        // Validate
        const validation = validatePromptPreset({
            name,
            prompt,
            stages: finalStages,
        });
        if (!validation.valid) {
            showFormErrors(validation.errors);
            return;
        }

        // Check unique name
        const excludeId = mode === 'edit' ? preset?.id : undefined;
        if (!presetRegistry.isNameUnique('prompt', name, excludeId)) {
            showFormErrors(['A preset with this name already exists']);
            return;
        }

        let result: PromptPreset;
        if (mode === 'edit' && preset) {
            presetRegistry.updatePromptPreset(preset.id, {
                name,
                prompt,
                stages: finalStages,
            });
            result = presetRegistry.getPromptPreset(preset.id)!;
            toast.success('Preset updated');
        } else {
            result = presetRegistry.registerPromptPreset({
                name,
                prompt,
                stages: finalStages,
            });
            toast.success('Preset created');
        }

        drawerCallbacks.onSave?.(result);
        closeDrawer();
    } else {
        const schemaTextarea = $(
            `#${MODULE_NAME}_drawer_schema`,
        ) as HTMLTextAreaElement;
        const schemaStr = schemaTextarea?.value || '';

        // Parse schema
        let schema: StructuredOutputSchema;
        try {
            schema = JSON.parse(schemaStr);
        } catch (e) {
            showFormErrors([`Invalid JSON: ${(e as Error).message}`]);
            return;
        }

        // Validate
        const validation = validateSchemaPreset({
            name,
            schema,
            stages: finalStages,
        });
        if (!validation.valid) {
            showFormErrors(validation.errors);
            return;
        }

        // Check unique name
        const excludeId = mode === 'edit' ? preset?.id : undefined;
        if (!presetRegistry.isNameUnique('schema', name, excludeId)) {
            showFormErrors(['A preset with this name already exists']);
            return;
        }

        let result: SchemaPreset;
        if (mode === 'edit' && preset) {
            presetRegistry.updateSchemaPreset(preset.id, {
                name,
                schema,
                stages: finalStages,
            });
            result = presetRegistry.getSchemaPreset(preset.id)!;
            toast.success('Schema preset updated');
        } else {
            result = presetRegistry.registerSchemaPreset({
                name,
                schema,
                stages: finalStages,
            });
            toast.success('Schema preset created');
        }

        drawerCallbacks.onSave?.(result);
        closeDrawer();
    }
}

// =============================================================================
// DELETE HANDLER
// =============================================================================

export async function handleDelete(closeDrawer: () => void): Promise<void> {
    const { type, preset } = drawerState;
    if (!preset) return;

    const confirmed = await popup.confirm(
        'Delete Preset',
        `Are you sure you want to delete "${preset.name}"?`,
    );
    if (!confirmed) return;

    if (type === 'prompt') {
        presetRegistry.deletePromptPreset(preset.id);
    } else {
        presetRegistry.deleteSchemaPreset(preset.id);
    }

    toast.success('Preset deleted');
    closeDrawer();
}

// =============================================================================
// IMPORT/EXPORT
// =============================================================================

export async function handleImport(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            const settings = getSettings();
            let importCount = 0;

            if (Array.isArray(data.promptPresets)) {
                for (const preset of data.promptPresets) {
                    if (!preset.isBuiltin) {
                        preset.id = crypto.randomUUID();
                        settings.promptPresets.push(preset);
                        importCount++;
                    }
                }
            }

            if (Array.isArray(data.schemaPresets)) {
                for (const preset of data.schemaPresets) {
                    if (!preset.isBuiltin) {
                        preset.id = crypto.randomUUID();
                        settings.schemaPresets.push(preset);
                        importCount++;
                    }
                }
            }

            save();
            toast.success(
                `Imported ${importCount} preset${importCount !== 1 ? 's' : ''}`,
            );
            drawerCallbacks.onUpdate?.();

            // Refresh list view
            const drawer = $(`#${MODULE_NAME}_preset_drawer`);
            if (drawer && drawerState.mode === 'list') {
                refreshListView(drawer);
            }
        } catch (error) {
            toast.error('Failed to import presets');
            log.error('Import error:', error);
        }
    };

    input.click();
}

export function handleExport(): void {
    const settings = getSettings();
    const customPrompts = settings.promptPresets.filter((p) => !p.isBuiltin);
    const customSchemas = settings.schemaPresets.filter((p) => !p.isBuiltin);

    if (customPrompts.length === 0 && customSchemas.length === 0) {
        toast.warning('No custom presets to export');
        return;
    }

    const data = {
        version: VERSION,
        exportedAt: new Date().toISOString(),
        promptPresets: customPrompts,
        schemaPresets: customSchemas,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `character-tools-presets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
    toast.success(
        `Exported ${customPrompts.length + customSchemas.length} preset${customPrompts.length + customSchemas.length !== 1 ? 's' : ''}`,
    );
}
