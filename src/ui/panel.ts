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

    return `
<div id="${MODULE_NAME}_panel">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b><i class="fa-solid fa-wand-magic-sparkles"></i> ${DISPLAY_NAME}</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="flex-container flexFlowColumn">
                <small class="cr-panel-version">Version ${VERSION}</small>
                <p class="cr-panel-desc">
                    AI-powered character card analysis, scoring, and enhancement.
                    Run the pipeline to evaluate and improve your character cards.
                </p>
                <div class="cr-panel-actions">
                    <button id="${MODULE_NAME}_open_btn" class="menu_button menu_button_icon">
                        <i class="fa-solid fa-play"></i>
                        <span>Open Character Tools</span>
                    </button>
                </div>
                <hr class="cr-panel-divider" />
                <div class="cr-panel-debug">
                    <label class="cr-panel-checkbox">
                        <input type="checkbox" id="${MODULE_NAME}_debug_mode" ${settings.debugMode ? 'checked' : ''} />
                        <span>Enable debug logging</span>
                    </label>
                    <button id="${MODULE_NAME}_view_logs" class="menu_button menu_button--sm">
                        <i class="fa-solid fa-terminal"></i>
                        <span>View Logs</span>
                    </button>
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

    // Bind view logs button
    const viewLogsBtn = document.getElementById(`${MODULE_NAME}_view_logs`);
    viewLogsBtn?.addEventListener('click', () => {
        toast.info('Check browser console (F12) for logs');
    });

    log.debug('Panel initialized');
}
