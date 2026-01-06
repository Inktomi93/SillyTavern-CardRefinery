// src/ui/components/settings-drawer/types.ts
// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Internal state for the settings drawer.
 */
export interface SettingsDrawerState {
    isOpen: boolean;
}

/**
 * Callbacks for settings drawer lifecycle events.
 */
export interface SettingsDrawerCallbacks {
    onClose?: () => void;
}
