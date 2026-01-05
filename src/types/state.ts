// src/types/state.ts
// =============================================================================
// STATE TYPE DEFINITIONS
// =============================================================================

import type { Character } from './character';
import type { StageName, StageStatus, StageConfig, StageResult } from './stage';
import type { Session, SessionId } from './session';

/**
 * Which fields are selected for analysis.
 * - true = entire field
 * - number[] = specific indices (for alternate_greetings)
 */
export interface FieldSelection {
    [key: string]: boolean | number[];
}

/**
 * Per-stage field selection state.
 * When linked is true, uses the base selection for all stages.
 * When false, each stage can have its own overrides.
 */
export interface StageFieldSelection {
    /** Base selection shared across all stages */
    base: FieldSelection;
    /** Whether stages share the same selection */
    linked: boolean;
    /** Per-stage overrides when not linked */
    overrides: Partial<Record<StageName, FieldSelection>>;
}

/**
 * Full popup state for the extension UI.
 */
export interface PopupState {
    // Character
    character: Character | null;
    /** @deprecated Use stageFields instead */
    selectedFields: FieldSelection;
    /** New per-stage field selection */
    stageFields: StageFieldSelection;

    // Session
    activeSessionId: SessionId | null;
    sessions: Session[];
    sessionsLoaded: boolean;
    hasUnsavedChanges: boolean;

    // Pipeline
    selectedStages: StageName[];
    stageStatus: Record<StageName, StageStatus>;
    stageResults: Record<StageName, StageResult | null>;
    stageConfigs: Record<StageName, StageConfig>;
    activeStage: StageName;
    iterationCount: number;
    iterationHistory: StageResult[];
    /** User guidance text for the current pipeline run */
    userGuidance: string;

    // Generation
    isGenerating: boolean;
    abortController: AbortController | null;

    // Search
    searchQuery: string;
    searchResults: Character[];
    searchSelectedIndex: number;
    dropdownOpen: boolean;

    // UI
    sessionListExpanded: boolean;
    historyExpanded: boolean;
}
