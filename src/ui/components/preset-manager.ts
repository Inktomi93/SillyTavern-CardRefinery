// src/ui/components/preset-manager.ts
// =============================================================================
// PRESET MANAGER - Unified preset management UI
// =============================================================================
//
// A comprehensive preset management section for the popup's left column.
// Provides full CRUD operations, import/export, and clear organization
// for both prompt and schema presets.
//
// =============================================================================

import { MODULE_NAME, STAGE_LABELS, VERSION, popup, toast } from '../../shared';
import { getSettings, save, presetRegistry } from '../../data';
import { $, $$, on } from './base';
import {
    openDrawerForCreate,
    openDrawerForEdit,
    openDrawerForDuplicate,
} from './preset-drawer';
import type { PromptPreset, SchemaPreset } from '../../types';

// =============================================================================
// STATE
// =============================================================================

type PresetTab = 'prompt' | 'schema';
let activeTab: PresetTab = 'prompt';
let isExpanded = true;

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderPresetItem(
    preset: PromptPreset | SchemaPreset,
    type: PresetTab,
): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const stagesText =
        preset.stages.length > 0
            ? preset.stages.map((s) => STAGE_LABELS[s]).join(', ')
            : 'All stages';

    const isBuiltin = preset.isBuiltin;

    return `
        <div class="ct-preset-item ${isBuiltin ? 'ct-preset-item--builtin' : ''}"
             data-id="${preset.id}"
             data-type="${type}">
            <div class="ct-preset-info">
                <span class="ct-preset-name">
                    ${isBuiltin ? '<i class="fa-solid fa-lock ct-text-dim" title="Built-in preset"></i>' : ''}
                    ${DOMPurify.sanitize(preset.name)}
                </span>
                <span class="ct-preset-stages">${stagesText}</span>
            </div>
            <div class="ct-preset-actions">
                <button class="ct-preset-action ct-preset-action--duplicate menu_button menu_button--icon menu_button--ghost"
                        type="button"
                        title="${isBuiltin ? 'Duplicate to create editable copy' : 'Duplicate preset'}">
                    <i class="fa-solid fa-copy"></i>
                </button>
                ${
                    !isBuiltin
                        ? `
                    <button class="ct-preset-action ct-preset-action--edit menu_button menu_button--icon menu_button--ghost"
                            type="button"
                            title="Edit preset">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="ct-preset-action ct-preset-action--delete menu_button menu_button--icon menu_button--ghost"
                            type="button"
                            title="Delete preset">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `
                        : ''
                }
            </div>
        </div>
    `;
}

function renderPresetList(type: PresetTab): string {
    const presets =
        type === 'prompt'
            ? presetRegistry.getPromptPresets()
            : presetRegistry.getSchemaPresets();

    if (presets.length === 0) {
        return `
            <div class="ct-preset-empty">
                <i class="fa-solid fa-bookmark"></i>
                <span>No ${type} presets yet</span>
            </div>
        `;
    }

    // Sort: custom first, then builtin
    const sorted = [...presets].sort((a, b) => {
        if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? 1 : -1;
        return a.name.localeCompare(b.name);
    });

    return sorted.map((p) => renderPresetItem(p, type)).join('');
}

/**
 * Render the preset manager section.
 */
export function renderPresetManager(): string {
    const promptCount = presetRegistry.getPromptPresets().length;
    const schemaCount = presetRegistry.getSchemaPresets().length;

    return `
        <section id="${MODULE_NAME}_preset_manager"
                 class="ct-presets-manager ${isExpanded ? '' : 'ct-presets-manager--collapsed'}">
            <button class="ct-presets-manager__toggle" type="button" aria-expanded="${isExpanded}">
                <i class="fa-solid fa-bookmark ct-text-accent"></i>
                <span class="ct-presets-manager__title">Presets</span>
                <span class="ct-presets-manager__count">${promptCount + schemaCount}</span>
                <i class="fa-solid fa-chevron-down ct-presets-manager__chevron"></i>
            </button>

            <div class="ct-presets-manager__content">
                <!-- Tabs -->
                <div class="ct-presets-manager__tabs">
                    <button class="ct-presets-manager__tab ${activeTab === 'prompt' ? 'ct-presets-manager__tab--active' : ''}"
                            data-tab="prompt"
                            type="button">
                        <i class="fa-solid fa-message"></i>
                        Prompts
                        <span class="ct-badge ct-badge--small">${promptCount}</span>
                    </button>
                    <button class="ct-presets-manager__tab ${activeTab === 'schema' ? 'ct-presets-manager__tab--active' : ''}"
                            data-tab="schema"
                            type="button">
                        <i class="fa-solid fa-code"></i>
                        Schemas
                        <span class="ct-badge ct-badge--small">${schemaCount}</span>
                    </button>
                </div>

                <!-- Preset Lists -->
                <div id="${MODULE_NAME}_preset_list_prompt"
                     class="ct-presets-manager__list ct-scrollable ${activeTab !== 'prompt' ? 'ct-hidden' : ''}">
                    ${renderPresetList('prompt')}
                </div>
                <div id="${MODULE_NAME}_preset_list_schema"
                     class="ct-presets-manager__list ct-scrollable ${activeTab !== 'schema' ? 'ct-hidden' : ''}">
                    ${renderPresetList('schema')}
                </div>

                <!-- Actions -->
                <div class="ct-presets-manager__actions">
                    <button id="${MODULE_NAME}_preset_create"
                            class="menu_button menu_button--sm menu_button--primary"
                            type="button">
                        <i class="fa-solid fa-plus"></i>
                        New ${activeTab === 'prompt' ? 'Prompt' : 'Schema'}
                    </button>
                    <div class="ct-presets-manager__io">
                        <button id="${MODULE_NAME}_preset_import"
                                class="menu_button menu_button--sm menu_button--ghost"
                                type="button"
                                title="Import presets from file">
                            <i class="fa-solid fa-file-import"></i>
                        </button>
                        <button id="${MODULE_NAME}_preset_export"
                                class="menu_button menu_button--sm menu_button--ghost"
                                type="button"
                                title="Export custom presets">
                            <i class="fa-solid fa-file-export"></i>
                        </button>
                    </div>
                </div>
            </div>
        </section>
    `;
}

/**
 * Update the preset manager UI.
 */
export function updatePresetManager(): void {
    const container = $(`#${MODULE_NAME}_preset_manager`);
    if (!container) return;

    // Update counts
    const promptCount = presetRegistry.getPromptPresets().length;
    const schemaCount = presetRegistry.getSchemaPresets().length;

    const countEl = container.querySelector('.ct-presets-manager__count');
    if (countEl) countEl.textContent = String(promptCount + schemaCount);

    // Update tab badges
    const promptTab = container.querySelector('[data-tab="prompt"] .ct-badge');
    const schemaTab = container.querySelector('[data-tab="schema"] .ct-badge');
    if (promptTab) promptTab.textContent = String(promptCount);
    if (schemaTab) schemaTab.textContent = String(schemaCount);

    // Update lists
    const promptList = $(`#${MODULE_NAME}_preset_list_prompt`);
    const schemaList = $(`#${MODULE_NAME}_preset_list_schema`);
    if (promptList) promptList.innerHTML = renderPresetList('prompt');
    if (schemaList) schemaList.innerHTML = renderPresetList('schema');

    // Update create button text
    const createBtn = $(`#${MODULE_NAME}_preset_create`);
    if (createBtn) {
        createBtn.innerHTML = `
            <i class="fa-solid fa-plus"></i>
            New ${activeTab === 'prompt' ? 'Prompt' : 'Schema'}
        `;
    }
}

/**
 * Bind preset manager events.
 */
export function bindPresetManagerEvents(container: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];
    const manager = $(`#${MODULE_NAME}_preset_manager`, container);
    if (!manager) return () => {};

    // Toggle expansion
    const toggle = manager.querySelector(
        '.ct-presets-manager__toggle',
    ) as HTMLElement | null;
    if (toggle) {
        cleanups.push(
            on(toggle, 'click', () => {
                isExpanded = !isExpanded;
                manager.classList.toggle(
                    'ct-presets-manager--collapsed',
                    !isExpanded,
                );
                toggle.setAttribute('aria-expanded', String(isExpanded));
            }),
        );
    }

    // Tab switching
    const tabs = $$('.ct-presets-manager__tab', manager);
    for (const tab of tabs) {
        cleanups.push(
            on(tab, 'click', () => {
                const tabType = (tab as HTMLElement).dataset.tab as PresetTab;
                if (tabType === activeTab) return;

                activeTab = tabType;

                // Update tab styles
                tabs.forEach((t) =>
                    t.classList.remove('ct-presets-manager__tab--active'),
                );
                tab.classList.add('ct-presets-manager__tab--active');

                // Show/hide lists
                const promptList = $(`#${MODULE_NAME}_preset_list_prompt`);
                const schemaList = $(`#${MODULE_NAME}_preset_list_schema`);
                promptList?.classList.toggle('ct-hidden', tabType !== 'prompt');
                schemaList?.classList.toggle('ct-hidden', tabType !== 'schema');

                // Update create button
                const createBtn = $(`#${MODULE_NAME}_preset_create`);
                if (createBtn) {
                    createBtn.innerHTML = `
                        <i class="fa-solid fa-plus"></i>
                        New ${tabType === 'prompt' ? 'Prompt' : 'Schema'}
                    `;
                }
            }),
        );
    }

    // Create button
    const createBtn = $(`#${MODULE_NAME}_preset_create`, manager);
    if (createBtn) {
        cleanups.push(
            on(createBtn, 'click', () => {
                openDrawerForCreate(activeTab, {
                    onSave: () => updatePresetManager(),
                });
            }),
        );
    }

    // Preset item actions (event delegation)
    const handleListClick = async (e: Event) => {
        const target = e.target as HTMLElement;
        const item = target.closest('.ct-preset-item') as HTMLElement;
        if (!item) return;

        const id = item.dataset.id;
        const type = item.dataset.type as PresetTab;
        if (!id || !type) return;

        // Edit
        if (target.closest('.ct-preset-action--edit')) {
            openDrawerForEdit(type, id, {
                onSave: () => updatePresetManager(),
            });
            return;
        }

        // Duplicate
        if (target.closest('.ct-preset-action--duplicate')) {
            openDrawerForDuplicate(type, id, {
                onSave: () => updatePresetManager(),
            });
            return;
        }

        // Delete
        if (target.closest('.ct-preset-action--delete')) {
            const preset =
                type === 'prompt'
                    ? presetRegistry.getPromptPreset(id)
                    : presetRegistry.getSchemaPreset(id);

            const confirmed = await popup.confirm(
                'Delete Preset',
                `Are you sure you want to delete "${preset?.name}"?`,
            );
            if (!confirmed) return;

            if (type === 'prompt') {
                presetRegistry.deletePromptPreset(id);
            } else {
                presetRegistry.deleteSchemaPreset(id);
            }

            toast.success('Preset deleted');
            updatePresetManager();
        }
    };

    const promptList = $(`#${MODULE_NAME}_preset_list_prompt`, manager);
    const schemaList = $(`#${MODULE_NAME}_preset_list_schema`, manager);
    if (promptList) cleanups.push(on(promptList, 'click', handleListClick));
    if (schemaList) cleanups.push(on(schemaList, 'click', handleListClick));

    // Import button
    const importBtn = $(`#${MODULE_NAME}_preset_import`, manager);
    if (importBtn) {
        cleanups.push(on(importBtn, 'click', handleImport));
    }

    // Export button
    const exportBtn = $(`#${MODULE_NAME}_preset_export`, manager);
    if (exportBtn) {
        cleanups.push(on(exportBtn, 'click', handleExport));
    }

    return () => cleanups.forEach((fn) => fn());
}

// =============================================================================
// IMPORT/EXPORT
// =============================================================================

async function handleImport(): Promise<void> {
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
            toast.success(`Imported ${importCount} presets`);
            updatePresetManager();
        } catch (error) {
            toast.error('Failed to import presets');
            console.error('Import error:', error);
        }
    };

    input.click();
}

function handleExport(): void {
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
        `Exported ${customPrompts.length + customSchemas.length} presets`,
    );
}
