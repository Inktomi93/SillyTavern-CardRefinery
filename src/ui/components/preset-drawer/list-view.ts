// src/ui/components/preset-drawer/list-view.ts
// =============================================================================
// LIST VIEW RENDERING
// =============================================================================

import { MODULE_NAME, STAGE_LABELS, popup, toast } from '../../../shared';
import { presetRegistry } from '../../../data';
import { $, $$, on } from '../base';
import { withRenderBoundary } from '../../error-boundary';
import { drawerState, drawerCallbacks, addCleanup } from './state';
import type { PresetType } from './types';
import type { PromptPreset, SchemaPreset } from '../../../types';

// =============================================================================
// LIST VIEW TEMPLATES
// =============================================================================

const _renderListHeader = (): string => {
    const { type } = drawerState;

    return /* html */ `
        <header class="cr-drawer__header">
            <div class="cr-drawer__title">
                <i class="fa-solid fa-bookmark cr-text-accent"></i>
                <h3>Manage Presets</h3>
            </div>
            <button id="${MODULE_NAME}_drawer_close"
                    class="menu_button menu_button--icon menu_button--ghost"
                    type="button"
                    aria-label="Close drawer">
                <i class="fa-solid fa-times"></i>
            </button>
        </header>
        <div class="cr-drawer__tabs">
            <button class="cr-drawer__tab ${type === 'prompt' ? 'cr-drawer__tab--active' : ''}"
                    data-tab="prompt" type="button">
                <i class="fa-solid fa-message"></i>
                Prompts
            </button>
            <button class="cr-drawer__tab ${type === 'schema' ? 'cr-drawer__tab--active' : ''}"
                    data-tab="schema" type="button">
                <i class="fa-solid fa-code"></i>
                Schemas
            </button>
        </div>
    `;
};
export const renderListHeader = withRenderBoundary(_renderListHeader, {
    name: 'PresetListHeader',
});

const _renderListBody = (): string => {
    const { type } = drawerState;
    const presets =
        type === 'prompt'
            ? presetRegistry.getPromptPresets()
            : presetRegistry.getSchemaPresets();

    // Sort: custom first, then builtin
    const sorted = [...presets].sort((a, b) => {
        if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? 1 : -1;
        return a.name.localeCompare(b.name);
    });

    const customCount = sorted.filter((p) => !p.isBuiltin).length;
    const builtinCount = sorted.filter((p) => p.isBuiltin).length;

    return /* html */ `
        <div class="cr-drawer__body cr-drawer__body--list">
            ${
                sorted.length === 0
                    ? /* html */ `
                <div class="cr-empty cr-empty--compact">
                    <i class="fa-solid fa-bookmark cr-empty__icon"></i>
                    <div class="cr-empty__title">No ${type} presets</div>
                    <div class="cr-empty__text">Create one to get started</div>
                </div>
            `
                    : /* html */ `
                <div class="cr-preset-list cr-scrollable">
                    ${customCount > 0 ? '<div class="cr-preset-list__section-label">Custom</div>' : ''}
                    ${sorted
                        .filter((p) => !p.isBuiltin)
                        .map((p) => renderPresetListItem(p, type))
                        .join('')}
                    ${builtinCount > 0 ? '<div class="cr-preset-list__section-label">Built-in</div>' : ''}
                    ${sorted
                        .filter((p) => p.isBuiltin)
                        .map((p) => renderPresetListItem(p, type))
                        .join('')}
                </div>
            `
            }
        </div>
    `;
};
export const renderListBody = withRenderBoundary(_renderListBody, {
    name: 'PresetListBody',
});

const _renderPresetListItem = (
    preset: PromptPreset | SchemaPreset,
    type: PresetType,
): string => {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const stagesText =
        preset.stages.length > 0
            ? preset.stages.map((s) => STAGE_LABELS[s]).join(', ')
            : 'All stages';

    return /* html */ `
        <div class="cr-preset-list__item ${preset.isBuiltin ? 'cr-preset-list__item--builtin' : ''}"
             data-id="${preset.id}"
             data-type="${type}">
            <button class="cr-preset-list__select" type="button" title="Apply this preset">
                <div class="cr-preset-list__info">
                    <span class="cr-preset-list__name">
                        ${preset.isBuiltin ? '<i class="fa-solid fa-lock cr-text-dim"></i>' : ''}
                        ${DOMPurify.sanitize(preset.name)}
                    </span>
                    <span class="cr-preset-list__stages">${stagesText}</span>
                </div>
            </button>
            <div class="cr-preset-list__actions">
                ${
                    !preset.isBuiltin
                        ? /* html */ `
                    <button class="cr-preset-list__action cr-preset-list__action--edit menu_button menu_button--icon menu_button--sm menu_button--ghost"
                            type="button" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                `
                        : ''
                }
                <button class="cr-preset-list__action cr-preset-list__action--duplicate menu_button menu_button--icon menu_button--sm menu_button--ghost"
                        type="button" title="${preset.isBuiltin ? 'Create editable copy' : 'Duplicate'}">
                    <i class="fa-solid fa-copy"></i>
                </button>
                ${
                    !preset.isBuiltin
                        ? /* html */ `
                    <button class="cr-preset-list__action cr-preset-list__action--delete menu_button menu_button--icon menu_button--sm menu_button--ghost"
                            type="button" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `
                        : ''
                }
            </div>
        </div>
    `;
};
export const renderPresetListItem = withRenderBoundary(_renderPresetListItem, {
    name: 'PresetListItem',
});

const _renderListFooter = (): string => {
    return /* html */ `
        <footer class="cr-drawer__footer cr-drawer__footer--list">
            <button id="${MODULE_NAME}_drawer_list_create"
                    class="menu_button menu_button--primary"
                    type="button">
                <i class="fa-solid fa-plus"></i>
                New Preset
            </button>
            <div class="cr-row cr-gap-2">
                <button id="${MODULE_NAME}_drawer_list_import"
                        class="menu_button menu_button--ghost"
                        type="button"
                        title="Import presets from file">
                    <i class="fa-solid fa-file-import"></i>
                </button>
                <button id="${MODULE_NAME}_drawer_list_export"
                        class="menu_button menu_button--ghost"
                        type="button"
                        title="Export custom presets">
                    <i class="fa-solid fa-file-export"></i>
                </button>
            </div>
        </footer>
    `;
};
export const renderListFooter = withRenderBoundary(_renderListFooter, {
    name: 'PresetListFooter',
});

// =============================================================================
// LIST VIEW EVENTS
// =============================================================================

export function bindListEvents(
    drawer: HTMLElement,
    closeDrawer: () => void,
    switchToCreateMode: (type: PresetType) => void,
    switchToEditMode: (type: PresetType, presetId: string) => void,
    switchToDuplicateMode: (type: PresetType, presetId: string) => void,
    handleImport: () => Promise<void>,
    handleExport: () => void,
): void {
    // Close button
    const closeBtn = $(`#${MODULE_NAME}_drawer_close`, drawer);
    if (closeBtn) {
        addCleanup(on(closeBtn, 'click', closeDrawer));
    }

    // Backdrop click
    const backdrop = $('.cr-drawer__backdrop', drawer);
    if (backdrop) {
        addCleanup(on(backdrop, 'click', closeDrawer));
    }

    // Tab switching
    const tabs = $$('.cr-drawer__tab', drawer);
    for (const tab of tabs) {
        addCleanup(
            on(tab, 'click', () => {
                const tabType = (tab as HTMLElement).dataset.tab as PresetType;
                if (tabType === drawerState.type) return;

                drawerState.type = tabType;

                // Update tab styles
                tabs.forEach((t) =>
                    t.classList.remove('cr-drawer__tab--active'),
                );
                tab.classList.add('cr-drawer__tab--active');

                // Re-render list body
                const bodyContainer = $('.cr-drawer__body--list', drawer);
                if (bodyContainer) {
                    bodyContainer.outerHTML = renderListBody();
                }
            }),
        );
    }

    // Preset list actions (event delegation from drawer to survive body re-renders)
    // Note: We bind to drawer instead of listContainer because the list body
    // gets replaced via outerHTML when switching tabs, which would orphan listeners
    addCleanup(
        on(drawer, 'click', async (e) => {
            const target = e.target as HTMLElement;

            // Only handle clicks within the preset list
            if (!target.closest('.cr-preset-list')) return;

            const item = target.closest('.cr-preset-list__item') as HTMLElement;
            if (!item) return;

            const id = item.dataset.id;
            const type = item.dataset.type as PresetType;
            if (!id || !type) return;

            const preset =
                type === 'prompt'
                    ? presetRegistry.getPromptPreset(id)
                    : presetRegistry.getSchemaPreset(id);
            if (!preset) return;

            // Select preset (clicking main button)
            if (target.closest('.cr-preset-list__select')) {
                drawerCallbacks.onSelect?.(preset);
                closeDrawer();
                return;
            }

            // Edit
            if (target.closest('.cr-preset-list__action--edit')) {
                switchToEditMode(type, id);
                return;
            }

            // Duplicate
            if (target.closest('.cr-preset-list__action--duplicate')) {
                switchToDuplicateMode(type, id);
                return;
            }

            // Delete
            if (target.closest('.cr-preset-list__action--delete')) {
                const confirmed = await popup.confirm(
                    'Delete Preset',
                    `Are you sure you want to delete "${preset.name}"?`,
                );
                if (!confirmed) return;

                if (type === 'prompt') {
                    presetRegistry.deletePromptPreset(id);
                } else {
                    presetRegistry.deleteSchemaPreset(id);
                }

                toast.success('Preset deleted');
                drawerCallbacks.onUpdate?.();
                refreshListView(drawer);
            }
        }),
    );

    // Create button
    const createBtn = $(`#${MODULE_NAME}_drawer_list_create`, drawer);
    if (createBtn) {
        addCleanup(
            on(createBtn, 'click', () => {
                switchToCreateMode(drawerState.type);
            }),
        );
    }

    // Import button
    const importBtn = $(`#${MODULE_NAME}_drawer_list_import`, drawer);
    if (importBtn) {
        addCleanup(on(importBtn, 'click', handleImport));
    }

    // Export button
    const exportBtn = $(`#${MODULE_NAME}_drawer_list_export`, drawer);
    if (exportBtn) {
        addCleanup(on(exportBtn, 'click', handleExport));
    }

    // Escape key
    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && drawerState.isOpen) {
            e.preventDefault();
            e.stopPropagation();
            closeDrawer();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    addCleanup(() => document.removeEventListener('keydown', handleKeydown));
}

export function refreshListView(drawer: HTMLElement): void {
    const bodyContainer = $('.cr-drawer__body--list', drawer);
    if (bodyContainer) {
        bodyContainer.outerHTML = renderListBody();
    }
}
