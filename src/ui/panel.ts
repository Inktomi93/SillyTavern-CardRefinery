// src/ui/panel.ts
// =============================================================================
// EXTENSION PANEL - Launch button in ST settings
// =============================================================================

import { MODULE_NAME, DISPLAY_NAME, VERSION } from '../shared';
import { log } from '../shared';
import { openPopup } from './popup';

// =============================================================================
// HTML
// =============================================================================

function getPanelHTML(): string {
    return `
<div id="${MODULE_NAME}_panel">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b><i class="fa-solid fa-wand-magic-sparkles"></i> ${DISPLAY_NAME}</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="flex-container flexFlowColumn">
                <small class="ct-panel-version">Version ${VERSION}</small>
                <p class="ct-panel-desc">
                    AI-powered character card analysis, scoring, and enhancement.
                    Run the pipeline to evaluate and improve your character cards.
                </p>
                <div class="ct-panel-actions">
                    <button id="${MODULE_NAME}_open_btn" class="menu_button menu_button_icon">
                        <i class="fa-solid fa-play"></i>
                        <span>Open Character Tools</span>
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

    log.debug('Panel initialized');
}
