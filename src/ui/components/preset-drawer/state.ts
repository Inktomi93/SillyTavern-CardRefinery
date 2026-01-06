// src/ui/components/preset-drawer/state.ts
// =============================================================================
// STATE MANAGEMENT
// =============================================================================

import type { DrawerState, DrawerCallbacks } from './types';

// =============================================================================
// STATE
// =============================================================================

export let drawerState: DrawerState = {
    isOpen: false,
    type: 'prompt',
    mode: 'create',
    preset: null,
    activeTab: 'edit',
};

export let drawerCallbacks: DrawerCallbacks = {};
export let cleanupFns: Array<() => void> = [];

// =============================================================================
// STATE SETTERS
// =============================================================================

export function setDrawerState(state: DrawerState): void {
    drawerState = state;
}

export function setDrawerCallbacks(callbacks: DrawerCallbacks): void {
    drawerCallbacks = callbacks;
}

export function resetCleanupFns(): void {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
}

export function addCleanup(fn: () => void): void {
    cleanupFns.push(fn);
}
