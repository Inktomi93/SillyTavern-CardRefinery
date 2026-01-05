// src/types/stage.ts
// =============================================================================
// STAGE TYPE DEFINITIONS
// =============================================================================

import type { STAGES } from '../shared/constants';

/**
 * Pipeline stage names.
 */
export type StageName = (typeof STAGES)[number];

/**
 * Current status of a stage in the pipeline.
 */
export type StageStatus = 'pending' | 'running' | 'complete' | 'error';

/**
 * Configuration for a single pipeline stage.
 */
export interface StageConfig {
    promptPresetId: string | null;
    customPrompt: string;
    schemaPresetId: string | null;
    customSchema: string;
    useStructuredOutput: boolean;
}

/**
 * Result from running a pipeline stage.
 */
export interface StageResult {
    stage: StageName;
    timestamp: number;
    input: string;
    output: string;
    guidance?: string;
    error?: string;
}
