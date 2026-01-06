// src/domain/pipeline/index.ts
// =============================================================================
// PIPELINE DOMAIN EXPORTS
// =============================================================================
//
// For template processing utilities, use shared/templates.ts directly.
//
// =============================================================================

// Prompt building
export {
    buildUserPrompt,
    getSchema,
    getStageSystemPrompt,
    type PromptContext,
    type PromptDependencies,
} from './prompt';

// Execution
export {
    runStage,
    type StageContext,
    type RunOptions,
    type ExecutionDependencies,
} from './execution';
