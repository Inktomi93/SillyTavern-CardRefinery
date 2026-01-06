// src/ui/components/settings-drawer/index.ts
// =============================================================================
// SETTINGS DRAWER - PUBLIC API
// =============================================================================
// Slideout drawer for extension settings.

// Types
export type { SettingsDrawerCallbacks } from './types';

// Lifecycle functions
export {
    initSettingsDrawer,
    showSettingsDrawer,
    closeSettingsDrawer,
    destroySettingsDrawer,
    openSettingsDrawer,
} from './lifecycle';
