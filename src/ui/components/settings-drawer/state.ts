// src/ui/components/settings-drawer/state.ts
// =============================================================================
// MODULE STATE
// =============================================================================

import type { SettingsDrawerState, SettingsDrawerCallbacks } from './types';

// =============================================================================
// STATE VARIABLES
// =============================================================================

const drawerState: SettingsDrawerState = {
    isOpen: false,
};

let cleanupFns: Array<() => void> = [];
let drawerCallbacks: SettingsDrawerCallbacks = {};

// =============================================================================
// STATE ACCESSORS
// =============================================================================

export function isDrawerOpen(): boolean {
    return drawerState.isOpen;
}

export function setDrawerOpen(open: boolean): void {
    drawerState.isOpen = open;
}

export function getCleanupFns(): Array<() => void> {
    return cleanupFns;
}

export function addCleanupFn(fn: () => void): void {
    cleanupFns.push(fn);
}

export function clearCleanupFns(): void {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
}

export function getCallbacks(): SettingsDrawerCallbacks {
    return drawerCallbacks;
}

export function setCallbacks(callbacks: SettingsDrawerCallbacks): void {
    drawerCallbacks = callbacks;
}
