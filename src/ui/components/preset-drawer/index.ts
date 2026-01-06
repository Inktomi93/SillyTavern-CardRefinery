// src/ui/components/preset-drawer/index.ts
// =============================================================================
// PRESET DRAWER - Public API
// =============================================================================
//
// A modern drawer component that slides in from the right for editing presets.
// Provides a better UX than buried modals by being:
// - Contextual (can be triggered from anywhere presets are used)
// - Spacious (full-height panel for comfortable editing)
// - Integrated (includes create, edit, duplicate, and AI generation)
//
// =============================================================================

// Types
export type {
    PresetType,
    DrawerMode,
    DrawerState,
    DrawerCallbacks,
} from './types';

// Lifecycle functions
export {
    initDrawer,
    openDrawerForCreate,
    openDrawerForEdit,
    openDrawerForDuplicate,
    openDrawerWithList,
    closeDrawer,
    destroyDrawer,
} from './drawer-core';
