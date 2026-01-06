// src/index.ts
// =============================================================================
// EXTENSION ENTRY POINT
//
// Uses ST's event system for proper initialization timing and reactive updates.
// =============================================================================

import './styles/index.css';

import {
    DISPLAY_NAME,
    VERSION,
    DEBUG,
    log,
    setDebugMode,
    toast,
} from './shared';
import { getSettings, clearCache } from './data';
import { refreshCharacter } from './state';
import { initPanel } from './ui/panel';
import { resetFuse } from './ui/components/character-selector';
import { refreshAfterCharacterChange } from './ui/components/update-coordinator';

// =============================================================================
// SETUP
// =============================================================================

// Set debug mode from constants
setDebugMode(DEBUG);

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Main initialization function.
 * Called when ST fires APP_READY event.
 */
function init(): void {
    try {
        log.info(`${DISPLAY_NAME} v${VERSION} initializing...`);

        // Initialize settings (triggers migration if needed)
        const settings = getSettings();

        // Sync debug mode from user settings (overrides constant)
        setDebugMode(settings.debugMode);

        // Load panel UI (just the launch button)
        initPanel();

        // Register event listeners for reactive updates
        registerEventListeners();

        log.info(`${DISPLAY_NAME} v${VERSION} loaded`);
    } catch (error) {
        log.error('Extension initialization failed', error);
        toast.error(`${DISPLAY_NAME} failed to initialize. Check console.`);
    }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

// Store handler references for cleanup
const eventHandlers: Array<{ type: string; handler: () => void }> = [];

/**
 * Register ST event listeners for reactive updates.
 *
 * Common events to listen for:
 * - CHAT_CHANGED: User switched chats
 * - CHARACTER_EDITED: Character card was modified
 * - CHARACTER_DELETED: Character was deleted
 * - CHATCOMPLETION_SOURCE_CHANGED: API source changed
 * - CHATCOMPLETION_MODEL_CHANGED: Model changed
 * - ONLINE_STATUS_CHANGED: API connection status changed
 *
 * @see eventTypes in SillyTavern.getContext() for full list
 */
function registerEventListeners(): void {
    const { eventSource, eventTypes } = SillyTavern.getContext();

    // Helper to register and track handlers
    const register = (type: string, handler: () => void) => {
        eventSource.on(type, handler);
        eventHandlers.push({ type, handler });
    };

    // Reset Fuse index and refresh popup character when characters change
    register(eventTypes.CHARACTER_EDITED, () => {
        log.debug(
            'Character edited, resetting Fuse index and refreshing popup',
        );
        resetFuse();
        refreshCharacter(); // Update popup state if this character is selected
        refreshAfterCharacterChange(); // Trigger UI updates if popup is open
    });

    register(eventTypes.CHARACTER_DELETED, () => {
        log.debug('Character deleted, resetting Fuse index');
        resetFuse();
    });

    // React to API changes
    register(eventTypes.CHATCOMPLETION_SOURCE_CHANGED, () => {
        log.debug('Chat completion source changed');
    });

    register(eventTypes.CHATCOMPLETION_MODEL_CHANGED, () => {
        log.debug('Chat completion model changed');
    });

    log.debug('Event listeners registered');
}

/**
 * Unregister all ST event listeners.
 */
function unregisterEventListeners(): void {
    const { eventSource } = SillyTavern.getContext();

    for (const { type, handler } of eventHandlers) {
        eventSource.off(type, handler);
    }
    eventHandlers.length = 0;

    log.debug('Event listeners unregistered');
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Cleanup on extension unload (if ST ever supports it).
 */
export function cleanup(): void {
    unregisterEventListeners();
    clearCache();
    log.info('Extension cleaned up');
}

// =============================================================================
// BOOTSTRAP
// =============================================================================

// Wait for ST to be fully ready before initializing
// This is the recommended pattern from ST docs
const { eventSource, eventTypes } = SillyTavern.getContext();
eventSource.on(eventTypes.APP_READY, init);

// =============================================================================
// EXPORTS
// =============================================================================

export { init, log };
