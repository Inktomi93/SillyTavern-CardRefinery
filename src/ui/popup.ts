// src/ui/popup.ts
// =============================================================================
// MAIN POPUP - Restructured with modern tab-based layout
// =============================================================================

import { MODULE_NAME } from '../shared';
import { clearCache } from '../data';
import {
    initState,
    clearState,
    forceSave,
    abortGeneration,
    getState,
} from '../state';
import { log } from '../shared';
import {
    renderCharacterSelector,
    bindCharacterSelectorEvents,
    updateCharacterSelector,
    renderSessionDropdown,
    bindSessionDropdownEvents,
    updateSessionDropdown,
    renderStageTabs,
    bindStageTabsEvents,
    updateStageTabs,
    renderPipelineControls,
    updatePipelineControls,
    renderStageConfig,
    bindStageConfigEvents,
    updateStageConfig,
    renderResultsPanel,
    bindResultsPanelEvents,
    updateResults,
    renderApiStatusCompact,
    bindApiStatusEvents,
    openSettingsModal,
    cleanupPipelineControls,
    initDrawer,
    destroyDrawer,
    $,
    on,
    // Update coordinator
    registerUpdate,
    clearRegistrations,
    // Input debounce management
    flushPendingInputs,
    clearPendingInputs,
} from './components';

// =============================================================================
// POPUP MANAGEMENT
// =============================================================================

let popupElement: HTMLElement | null = null;

/**
 * Render popup content HTML with new layout structure.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Header: Character Selector | Title | Settings/Close        │
 * ├─────────────────────────────────────────────────────────────┤
 * │ Stage Tabs: [Score] [Rewrite] [Analyze]   | Pipeline Ctrl  │
 * ├─────────────────────────────────────────────────────────────┤
 * │                    │                                        │
 * │   Config Panel     │         Results Panel                  │
 * │   - Fields         │         - Output                       │
 * │   - Prompt         │         - History                      │
 * │   - Schema         │                                        │
 * │                    │                                        │
 * └─────────────────────────────────────────────────────────────┘
 */
function renderPopupContent(): string {
    return /* html */ `
<div id="${MODULE_NAME}_popup" class="cr-popup">
    <header class="cr-header">
        <div class="cr-header__left">
            ${renderCharacterSelector()}
            ${renderSessionDropdown()}
        </div>
        <div class="cr-header__center">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <h2>Character Tools</h2>
            <div id="${MODULE_NAME}_api_status_container">
                ${renderApiStatusCompact()}
            </div>
        </div>
        <div class="cr-header__right">
            <button id="${MODULE_NAME}_settings_btn"
                    class="menu_button menu_button--icon menu_button--ghost"
                    type="button"
                    title="Settings"
                    aria-label="Settings">
                <i class="fa-solid fa-cog"></i>
            </button>
            <button id="${MODULE_NAME}_close_btn"
                    class="menu_button menu_button--icon menu_button--ghost"
                    type="button"
                    title="Close"
                    aria-label="Close popup">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
    </header>

    <div class="cr-toolbar">
        ${renderStageTabs()}
        <div id="${MODULE_NAME}_pipeline_controls" class="cr-toolbar__controls">
            ${renderPipelineControls()}
        </div>
    </div>

    <div class="cr-body">
        <aside class="cr-panel cr-panel--config cr-scrollable">
            ${renderStageConfig()}
        </aside>
        <main class="cr-panel cr-panel--results">
            ${renderResultsPanel()}
        </main>
    </div>
</div>`;
}

// Event cleanup functions
let eventCleanups: Array<() => void> = [];

/**
 * Open the main popup.
 */
export async function openPopup(): Promise<void> {
    const context = SillyTavern.getContext();
    const { DOMPurify } = SillyTavern.libs;

    // Initialize fresh state
    initState();

    // Build content
    const content = renderPopupContent();

    // Create popup
    const popup = new context.Popup(
        DOMPurify.sanitize(content),
        context.POPUP_TYPE.TEXT,
        '',
        {
            wide: true,
            large: true,
            allowVerticalScrolling: true,
            okButton: false,
            cancelButton: false,
        },
    );

    // Show and handle close
    popup.show().then(async () => {
        await onPopupClose();
    });

    // Wait for DOM
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Get popup element
    popupElement = document.getElementById(`${MODULE_NAME}_popup`);
    if (!popupElement) {
        log.error('Popup element not found');
        return;
    }

    // Initialize the preset drawer (appends to popup)
    initDrawer(popupElement);

    // Bind all component events
    bindAllEvents(popupElement);

    log.debug('Popup opened');
}

/**
 * Register component update functions with the coordinator.
 * This enables centralized, batched UI updates.
 */
function registerComponentUpdates(): void {
    // Character selector updates on character/session changes
    eventCleanups.push(
        registerUpdate('characterSelector', updateCharacterSelector, [
            'character',
            'session',
        ]),
    );

    // Stage tabs update on stage/pipeline changes
    eventCleanups.push(
        registerUpdate('stageTabs', updateStageTabs, ['stage', 'pipeline']),
    );

    // Pipeline controls update on pipeline changes
    eventCleanups.push(
        registerUpdate('pipelineControls', updatePipelineControls, [
            'pipeline',
            'character',
        ]),
    );

    // Stage config updates on stage/config/fields/character changes
    eventCleanups.push(
        registerUpdate('stageConfig', updateStageConfig, [
            'stage',
            'config',
            'fields',
            'character',
        ]),
    );

    // Results panel updates on results/stage changes
    eventCleanups.push(
        registerUpdate('results', updateResults, ['results', 'stage']),
    );

    // Session dropdown updates on session/character changes
    eventCleanups.push(
        registerUpdate('sessionDropdown', updateSessionDropdown, [
            'session',
            'character',
        ]),
    );
}

/**
 * Bind all component events.
 */
function bindAllEvents(container: HTMLElement): void {
    // Clear previous cleanups
    eventCleanups.forEach((fn) => fn());
    eventCleanups = [];

    // Register update functions with coordinator
    registerComponentUpdates();

    // Bind component events
    eventCleanups.push(bindCharacterSelectorEvents(container));
    eventCleanups.push(bindSessionDropdownEvents(container));
    eventCleanups.push(bindStageTabsEvents(container));
    eventCleanups.push(bindStageConfigEvents(container));
    eventCleanups.push(bindResultsPanelEvents(container));

    // Bind API status events
    const apiStatusContainer = $(
        `#${MODULE_NAME}_api_status_container`,
        container,
    );
    if (apiStatusContainer) {
        eventCleanups.push(bindApiStatusEvents(apiStatusContainer));
    }

    // Settings button
    const settingsBtn = $(`#${MODULE_NAME}_settings_btn`, container);
    if (settingsBtn) {
        eventCleanups.push(
            on(settingsBtn, 'click', () => {
                openSettingsModal();
            }),
        );
    }

    // Close button
    const closeBtn = $(`#${MODULE_NAME}_close_btn`, container);
    if (closeBtn) {
        eventCleanups.push(
            on(closeBtn, 'click', () => {
                closePopup();
            }),
        );
    }

    // Global keyboard shortcuts
    const handleKeydown = (e: KeyboardEvent) => {
        const state = getState();

        // Ctrl+Enter: Run current stage
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            const runBtn = $(`#${MODULE_NAME}_run_stage`, container);
            if (runBtn && !state.isGenerating && state.character) {
                (runBtn as HTMLButtonElement).click();
            }
        }

        // Escape: Abort generation
        if (e.key === 'Escape' && state.isGenerating) {
            e.preventDefault();
            abortGeneration();
        }
    };

    document.addEventListener('keydown', handleKeydown);
    eventCleanups.push(() =>
        document.removeEventListener('keydown', handleKeydown),
    );
}

/**
 * Close the popup programmatically.
 */
export function closePopup(): void {
    if (!popupElement) return;

    const dialog = popupElement.closest('.popup');
    const closeBtn = dialog?.querySelector(
        '.popup-button-cancel, .popup-button-ok',
    ) as HTMLElement;
    closeBtn?.click();
}

/**
 * Handle popup close.
 */
async function onPopupClose(): Promise<void> {
    // Flush any pending input debounces to ensure all typed content reaches state
    flushPendingInputs();

    // Save any pending changes (now properly awaited)
    await forceSave();

    // Cleanup event listeners
    eventCleanups.forEach((fn) => fn());
    eventCleanups = [];

    // Cleanup pipeline controls separately (has its own state)
    cleanupPipelineControls();

    // Remove drawer from DOM
    destroyDrawer();

    // Clear update coordinator registrations
    clearRegistrations();

    // Clear tracked input debounces
    clearPendingInputs();

    // Cleanup state
    popupElement = null;
    clearState();
    clearCache();

    log.debug('Popup closed');
}

/**
 * Get popup element (for event handlers).
 */
export function getPopupElement(): HTMLElement | null {
    return popupElement;
}
