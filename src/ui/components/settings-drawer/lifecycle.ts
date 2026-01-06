// src/ui/components/settings-drawer/lifecycle.ts
// =============================================================================
// LIFECYCLE FUNCTIONS
// =============================================================================

import { MODULE_NAME, log } from '../../../shared';
import { $ } from '../base';
import type { SettingsDrawerCallbacks } from './types';
import {
    isDrawerOpen,
    setDrawerOpen,
    clearCleanupFns,
    setCallbacks,
    getCallbacks,
} from './state';
import {
    renderDrawer,
    renderDrawerHeader,
    renderDrawerBody,
    renderDrawerFooter,
} from './templates';
import { bindDrawerEvents } from './events';

// =============================================================================
// LIFECYCLE
// =============================================================================

/**
 * Initialize the settings drawer (create DOM).
 */
export function initSettingsDrawer(container: HTMLElement): void {
    // Check if drawer already exists
    if ($(`#${MODULE_NAME}_settings_drawer`)) {
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

/**
 * Show the settings drawer.
 */
export function showSettingsDrawer(callbacks?: SettingsDrawerCallbacks): void {
    const drawer = $(`#${MODULE_NAME}_settings_drawer`);
    if (!drawer) {
        log.error('Settings drawer not initialized');
        return;
    }

    // Clean up any existing event listeners before re-binding
    // This prevents listener accumulation if drawer is reopened without closing
    clearCleanupFns();

    // Store callbacks
    setCallbacks(callbacks || {});

    // Update drawer content
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

    // Bind events
    bindDrawerEvents(drawer);

    // Mark as open
    setDrawerOpen(true);

    // Show drawer with animation
    requestAnimationFrame(() => {
        drawer.classList.add('cr-drawer--open');
        drawer.setAttribute('aria-hidden', 'false');
    });
}

/**
 * Close the settings drawer.
 */
export function closeSettingsDrawer(): void {
    const drawer = $(`#${MODULE_NAME}_settings_drawer`);
    if (!drawer) return;

    // Guard against double-close during animation
    if (!isDrawerOpen()) return;

    // Mark as closed immediately to prevent race conditions
    setDrawerOpen(false);

    drawer.classList.remove('cr-drawer--open');
    drawer.setAttribute('aria-hidden', 'true');

    // Cleanup after animation completes
    setTimeout(() => {
        clearCleanupFns();
        getCallbacks().onClose?.();
    }, 300);
}

/**
 * Destroy the settings drawer (remove from DOM).
 */
export function destroySettingsDrawer(): void {
    const drawer = $(`#${MODULE_NAME}_settings_drawer`);
    if (drawer) {
        drawer.remove();
    }
    clearCleanupFns();
    setDrawerOpen(false);
}

// =============================================================================
// CONVENIENCE EXPORT (replaces openSettingsModal)
// =============================================================================

/**
 * Open settings drawer (convenience function).
 * This is the main entry point that replaces openSettingsModal.
 */
export function openSettingsDrawer(
    container: HTMLElement,
    callbacks?: SettingsDrawerCallbacks,
): void {
    initSettingsDrawer(container);
    showSettingsDrawer(callbacks);
}
