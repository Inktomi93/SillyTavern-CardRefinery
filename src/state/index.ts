// src/state/index.ts
// =============================================================================
// STATE MODULE EXPORTS
// =============================================================================

// Core state management
export {
    // Initialization
    initState,
    getState,
    clearState,
    // Auto-save
    forceSave,
    // Character & Session
    setCharacter,
    createNewSession,
    loadSession,
    deleteSession,
    deleteAllSessions,
    renameSession,
    ensureActiveSession,
    // Field selection
    toggleField,
    getFieldSelectionForStage,
    getCurrentFieldSelection,
    areStagesLinked,
    toggleStageFieldLinking,
    // Stage management
    setActiveStage,
    updateStageConfig,
    // User guidance
    getUserGuidance,
    setUserGuidance,
    // Generation
    abortGeneration,
    // Character refresh
    refreshCharacter,
    // UI
    toggleHistory,
    // History navigation
    viewHistoryItem,
    viewPreviousHistory,
    viewNextHistory,
    restoreHistoryItem,
    getViewedHistoryItem,
} from './popup-state';

// Pipeline actions (preferred for execution orchestration)
export {
    executeStageAction,
    executeAllStagesAction,
    executeQuickIterateAction,
    abortPipelineAction,
    resetPipelineAction,
} from './pipeline-actions';
