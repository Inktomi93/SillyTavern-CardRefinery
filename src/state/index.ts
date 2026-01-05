// src/state/index.ts
// =============================================================================
// STATE MODULE EXPORTS
// =============================================================================

// Core state management
export {
    // Initialization
    createInitialState,
    initState,
    getState,
    getStateOrNull,
    clearState,
    // Auto-save
    autoSave,
    forceSave,
    cancelAutoSave,
    // Character & Session
    setCharacter,
    createNewSession,
    loadSession,
    deleteSession,
    // Field selection
    setFieldSelection,
    toggleField,
    getFieldSelectionForStage,
    getCurrentFieldSelection,
    areStagesLinked,
    toggleStageFieldLinking,
    // Stage management
    setActiveStage,
    toggleStageSelection,
    updateStageConfig,
    setStageStatus,
    recordStageResult,
    incrementIteration,
    resetPipeline,
    // User guidance
    getUserGuidance,
    setUserGuidance,
    // Generation (legacy - prefer pipeline actions)
    setGenerating,
    abortGeneration,
    // Search
    setSearchState,
    // Character refresh
    refreshCharacter,
    // UI
    toggleSessionList,
    toggleHistory,
} from './popup-state';

// Pipeline actions (preferred for execution orchestration)
export {
    executeStageAction,
    executeAllStagesAction,
    executeRefinementAction,
    executeQuickIterateAction,
    abortPipelineAction,
    resetPipelineAction,
    type PipelineCallbacks,
    type ExecuteStageOptions,
    type ExecuteAllOptions,
} from './pipeline-actions';
