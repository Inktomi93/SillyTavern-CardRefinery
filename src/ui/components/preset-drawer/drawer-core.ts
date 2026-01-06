// src/ui/components/preset-drawer/drawer-core.ts
// =============================================================================
// DRAWER LIFECYCLE & MODE SWITCHING
// =============================================================================

import { MODULE_NAME, log, toast } from '../../../shared';
import { presetRegistry } from '../../../data';
import { $ } from '../base';
import {
    drawerState,
    drawerCallbacks,
    setDrawerState,
    setDrawerCallbacks,
    resetCleanupFns,
} from './state';
import type { DrawerCallbacks, PresetType } from './types';
import {
    renderDrawer,
    renderDrawerHeader,
    renderDrawerBody,
    renderDrawerFooter,
    bindDrawerEvents,
    updateSchemaHighlighting,
} from './form-view';
import {
    renderListHeader,
    renderListBody,
    renderListFooter,
    bindListEvents,
} from './list-view';
import {
    handleSave,
    handleDelete,
    handleImport,
    handleExport,
} from './actions';

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize drawer in the DOM (call once when popup opens).
 * Appends to the ST popup dialog element for proper stacking in the top layer.
 */
export function initDrawer(container: HTMLElement): void {
    // Check if drawer already exists
    if ($(`#${MODULE_NAME}_preset_drawer`)) {
        return;
    }

    // Find the ST popup dialog (which uses the browser's top layer)
    const popupDialog = container.closest('.popup');
    if (popupDialog) {
        // Append inside the dialog so it stays in the top layer stacking context
        popupDialog.insertAdjacentHTML('beforeend', renderDrawer());
    } else {
        // Fallback to body if no popup found
        document.body.insertAdjacentHTML('beforeend', renderDrawer());
    }
}

// =============================================================================
// OPEN DRAWER
// =============================================================================

/**
 * Open the drawer for creating a new preset.
 */
export function openDrawerForCreate(
    type: PresetType,
    callbacks?: DrawerCallbacks,
): void {
    setDrawerState({
        isOpen: true,
        type,
        mode: 'create',
        preset: null,
        activeTab: 'edit',
    });
    setDrawerCallbacks(callbacks || {});
    showDrawer();
}

/**
 * Open the drawer for editing an existing preset.
 */
export function openDrawerForEdit(
    type: PresetType,
    presetId: string,
    callbacks?: DrawerCallbacks,
): void {
    const preset =
        type === 'prompt'
            ? presetRegistry.getPromptPreset(presetId)
            : presetRegistry.getSchemaPreset(presetId);

    if (!preset) {
        toast.error('Preset not found');
        return;
    }

    // Builtins can only be duplicated
    if (preset.isBuiltin) {
        openDrawerForDuplicate(type, presetId, callbacks);
        return;
    }

    setDrawerState({
        isOpen: true,
        type,
        mode: 'edit',
        preset,
        activeTab: 'edit',
    });
    setDrawerCallbacks(callbacks || {});
    showDrawer();
}

/**
 * Open the drawer for duplicating a preset.
 */
export function openDrawerForDuplicate(
    type: PresetType,
    presetId: string,
    callbacks?: DrawerCallbacks,
): void {
    const preset =
        type === 'prompt'
            ? presetRegistry.getPromptPreset(presetId)
            : presetRegistry.getSchemaPreset(presetId);

    if (!preset) {
        toast.error('Preset not found');
        return;
    }

    setDrawerState({
        isOpen: true,
        type,
        mode: 'duplicate',
        preset,
        activeTab: 'edit',
    });
    setDrawerCallbacks(callbacks || {});
    showDrawer();
}

/**
 * Open the drawer in list mode for managing presets.
 */
export function openDrawerWithList(
    type: PresetType,
    callbacks?: DrawerCallbacks,
): void {
    setDrawerState({
        isOpen: true,
        type,
        mode: 'list',
        preset: null,
        activeTab: 'edit',
    });
    setDrawerCallbacks(callbacks || {});
    showDrawer();
}

// =============================================================================
// CLOSE & DESTROY
// =============================================================================

/**
 * Close the drawer.
 */
export function closeDrawer(): void {
    const drawer = $(`#${MODULE_NAME}_preset_drawer`);
    if (!drawer) return;

    drawer.classList.remove('cr-drawer--open');
    drawer.setAttribute('aria-hidden', 'true');

    // Cleanup after animation
    setTimeout(() => {
        resetCleanupFns();
        drawerState.isOpen = false;
        drawerCallbacks.onClose?.();
    }, 300);
}

/**
 * Remove drawer from DOM (call when popup closes).
 */
export function destroyDrawer(): void {
    const drawer = $(`#${MODULE_NAME}_preset_drawer`);
    if (drawer) {
        drawer.remove();
    }
    resetCleanupFns();
    drawerState.isOpen = false;
}

// =============================================================================
// INTERNAL SHOW
// =============================================================================

function showDrawer(): void {
    const drawer = $(`#${MODULE_NAME}_preset_drawer`);
    if (!drawer) {
        log.error('Drawer not initialized');
        return;
    }

    // Update drawer content based on mode
    const panel = $('.cr-drawer__panel', drawer);
    if (panel) {
        if (drawerState.mode === 'list') {
            panel.innerHTML = /* html */ `
                <div class="cr-drawer__content cr-drawer__content--list">
                    ${renderListHeader()}
                    ${renderListBody()}
                    ${renderListFooter()}
                </div>
            `;
        } else {
            panel.innerHTML = /* html */ `
                <div class="cr-drawer__content">
                    ${renderDrawerHeader()}
                    ${renderDrawerBody()}
                    ${renderDrawerFooter()}
                </div>
            `;
        }
    }

    // Bind events
    if (drawerState.mode === 'list') {
        bindListEvents(
            drawer,
            closeDrawer,
            switchToCreateMode,
            switchToEditMode,
            switchToDuplicateMode,
            handleImport,
            handleExport,
        );
    } else {
        bindDrawerEvents(
            drawer,
            closeDrawer,
            () => handleSave(closeDrawer),
            () => handleDelete(closeDrawer),
        );
    }

    // Show drawer with animation
    requestAnimationFrame(() => {
        drawer.classList.add('cr-drawer--open');
        drawer.setAttribute('aria-hidden', 'false');

        // Focus first input (only in edit modes)
        if (drawerState.mode !== 'list') {
            const nameInput = $(`#${MODULE_NAME}_drawer_name`, drawer);
            if (nameInput) {
                (nameInput as HTMLInputElement).focus();
                (nameInput as HTMLInputElement).select();
            }

            // Initialize syntax highlighting for schema
            if (drawerState.type === 'schema') {
                updateSchemaHighlighting();
            }
        }
    });
}

// =============================================================================
// MODE SWITCHING
// =============================================================================

function switchToCreateMode(type: PresetType): void {
    // Clean up current events
    resetCleanupFns();

    // Update state
    drawerState.mode = 'create';
    drawerState.type = type;
    drawerState.preset = null;

    // Re-render with edit view
    const drawer = $(`#${MODULE_NAME}_preset_drawer`);
    if (!drawer) return;

    const panel = $('.cr-drawer__panel', drawer);
    if (panel) {
        panel.innerHTML = /* html */ `
            <div class="cr-drawer__content">
                ${renderDrawerHeader()}
                ${renderDrawerBody()}
                ${renderDrawerFooter()}
            </div>
        `;
    }

    bindDrawerEvents(
        drawer,
        closeDrawer,
        () => handleSave(closeDrawer),
        () => handleDelete(closeDrawer),
    );

    // Focus name input
    const nameInput = $(`#${MODULE_NAME}_drawer_name`, drawer);
    if (nameInput) {
        (nameInput as HTMLInputElement).focus();
    }
}

function switchToEditMode(type: PresetType, presetId: string): void {
    const preset =
        type === 'prompt'
            ? presetRegistry.getPromptPreset(presetId)
            : presetRegistry.getSchemaPreset(presetId);

    if (!preset) return;

    // Clean up current events
    resetCleanupFns();

    // Update state
    drawerState.mode = 'edit';
    drawerState.type = type;
    drawerState.preset = preset;

    // Re-render with edit view
    const drawer = $(`#${MODULE_NAME}_preset_drawer`);
    if (!drawer) return;

    const panel = $('.cr-drawer__panel', drawer);
    if (panel) {
        panel.innerHTML = /* html */ `
            <div class="cr-drawer__content">
                ${renderDrawerHeader()}
                ${renderDrawerBody()}
                ${renderDrawerFooter()}
            </div>
        `;
    }

    bindDrawerEvents(
        drawer,
        closeDrawer,
        () => handleSave(closeDrawer),
        () => handleDelete(closeDrawer),
    );

    // Focus name input
    const nameInput = $(`#${MODULE_NAME}_drawer_name`, drawer);
    if (nameInput) {
        (nameInput as HTMLInputElement).focus();
        (nameInput as HTMLInputElement).select();
    }

    // Initialize schema highlighting
    if (type === 'schema') {
        updateSchemaHighlighting();
    }
}

function switchToDuplicateMode(type: PresetType, presetId: string): void {
    const preset =
        type === 'prompt'
            ? presetRegistry.getPromptPreset(presetId)
            : presetRegistry.getSchemaPreset(presetId);

    if (!preset) return;

    // Clean up current events
    resetCleanupFns();

    // Update state
    drawerState.mode = 'duplicate';
    drawerState.type = type;
    drawerState.preset = preset;

    // Re-render with edit view
    const drawer = $(`#${MODULE_NAME}_preset_drawer`);
    if (!drawer) return;

    const panel = $('.cr-drawer__panel', drawer);
    if (panel) {
        panel.innerHTML = /* html */ `
            <div class="cr-drawer__content">
                ${renderDrawerHeader()}
                ${renderDrawerBody()}
                ${renderDrawerFooter()}
            </div>
        `;
    }

    bindDrawerEvents(
        drawer,
        closeDrawer,
        () => handleSave(closeDrawer),
        () => handleDelete(closeDrawer),
    );

    // Focus name input
    const nameInput = $(`#${MODULE_NAME}_drawer_name`, drawer);
    if (nameInput) {
        (nameInput as HTMLInputElement).focus();
        (nameInput as HTMLInputElement).select();
    }

    // Initialize schema highlighting
    if (type === 'schema') {
        updateSchemaHighlighting();
    }
}
