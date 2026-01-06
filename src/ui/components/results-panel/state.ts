// src/ui/components/results-panel/state.ts
// =============================================================================
// MODULE STATE
// =============================================================================

import type { StageName } from '../../../types';

// =============================================================================
// STATE VARIABLES
// =============================================================================

// Track current view mode (result or compare)
let currentViewMode: 'result' | 'compare' = 'result';

// Track JSON display mode per stage (raw vs smart)
const jsonDisplayModes: Record<StageName, 'smart' | 'raw'> = {
    score: 'smart',
    rewrite: 'smart',
    analyze: 'smart',
};

// Track text display mode per stage (formatted vs raw)
const textDisplayModes: Record<StageName, 'formatted' | 'raw'> = {
    score: 'formatted',
    rewrite: 'formatted',
    analyze: 'formatted',
};

// Track compare view cleanup separately to prevent listener accumulation
let compareViewCleanup: (() => void) | null = null;

// =============================================================================
// STATE ACCESSORS
// =============================================================================

export function getViewMode(): 'result' | 'compare' {
    return currentViewMode;
}

export function setViewMode(mode: 'result' | 'compare'): void {
    currentViewMode = mode;
}

export function getJsonDisplayMode(stage: StageName): 'smart' | 'raw' {
    return jsonDisplayModes[stage];
}

export function setJsonDisplayMode(
    stage: StageName,
    mode: 'smart' | 'raw',
): void {
    jsonDisplayModes[stage] = mode;
}

export function getTextDisplayMode(stage: StageName): 'formatted' | 'raw' {
    return textDisplayModes[stage];
}

export function setTextDisplayMode(
    stage: StageName,
    mode: 'formatted' | 'raw',
): void {
    textDisplayModes[stage] = mode;
}

export function getCompareViewCleanup(): (() => void) | null {
    return compareViewCleanup;
}

export function setCompareViewCleanup(cleanup: (() => void) | null): void {
    compareViewCleanup = cleanup;
}
