// src/ui/panel.ts
// =============================================================================
// EXTENSION PANEL - Launch button in ST settings
// =============================================================================

import {
    MODULE_NAME,
    DISPLAY_NAME,
    VERSION,
    toast,
    setDebugMode,
} from '../shared';
import { log } from '../shared';
import { getSettings, save } from '../data';
import { openPopup } from './popup';

// =============================================================================
// HTML
// =============================================================================

function getPanelHTML(): string {
    const settings = getSettings();

    return /* html */ `
<div id="${MODULE_NAME}_panel">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b><i class="fa-solid fa-wand-magic-sparkles"></i> ${DISPLAY_NAME}</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="cr-panel-content">
                <p class="cr-panel-desc">
                    AI-powered character card scoring, rewriting, and analysis.
                </p>
                <button id="${MODULE_NAME}_open_btn" class="menu_button cr-panel-launch" type="button">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    <span>Open Card Refinery</span>
                </button>
                <div class="cr-panel-footer">
                    <label class="cr-panel-checkbox">
                        <input type="checkbox" id="${MODULE_NAME}_debug_mode" ${settings.debugMode ? 'checked' : ''}/>
                        <span>Debug mode</span>
                    </label>
                    <span class="cr-panel-version">v${VERSION}</span>
                </div>
            </div>
        </div>
    </div>
</div>`;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the extension panel.
 */
export async function initPanel(): Promise<void> {
    const container = document.getElementById('extensions_settings');
    if (!container) {
        log.error('Extensions container not found');
        return;
    }

    // Guard against double initialization (e.g., settings refresh)
    if (document.getElementById(`${MODULE_NAME}_panel`)) {
        log.debug('Panel already initialized, skipping');
        return;
    }

    container.insertAdjacentHTML('beforeend', getPanelHTML());

    // Bind launch button
    const openBtn = document.getElementById(`${MODULE_NAME}_open_btn`);
    openBtn?.addEventListener('click', openPopup);

    // Bind debug mode toggle
    const debugToggle = document.getElementById(
        `${MODULE_NAME}_debug_mode`,
    ) as HTMLInputElement | null;
    debugToggle?.addEventListener('change', () => {
        const settings = getSettings();
        settings.debugMode = debugToggle.checked;
        setDebugMode(debugToggle.checked);
        save();
        toast.info(
            debugToggle.checked
                ? 'Debug logging enabled'
                : 'Debug logging disabled',
        );
    });

    log.debug('Panel initialized');
}
