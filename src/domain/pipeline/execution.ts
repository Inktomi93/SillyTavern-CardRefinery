// src/domain/pipeline/execution.ts
// =============================================================================
// PIPELINE EXECUTION
// =============================================================================

import { log } from '../../shared';
import type { StructuredOutputSchema } from '../../shared';
import { generate } from '../generation';
import { getSettings } from '../../data/settings';
import type { StageResult } from '../../types';
import {
    buildUserPrompt,
    getStageSystemPrompt,
    getSchema,
    type PromptContext,
    type PromptDependencies,
} from './prompt';

// =============================================================================
// TYPES
// =============================================================================

export type StageContext = PromptContext;

export interface RunOptions {
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
}

export type ExecutionDependencies = PromptDependencies;

// =============================================================================
// EXECUTION
// =============================================================================

/**
 * Run a single pipeline stage.
 */
export async function runStage(
    ctx: StageContext,
    deps: ExecutionDependencies,
    options: RunOptions = {},
): Promise<StageResult> {
    const { signal, onProgress } = options;

    const timestamp = Date.now();
    const userPrompt = buildUserPrompt(ctx, deps);
    const systemPrompt = getStageSystemPrompt(
        ctx.stage,
        ctx.isRefinement ?? false,
        deps,
    );
    const schema = getSchema(ctx.config, deps);

    onProgress?.(`Running ${ctx.stage}...`);

    // Check abort before starting
    if (signal?.aborted) {
        return {
            stage: ctx.stage,
            timestamp,
            input: userPrompt,
            output: '',
            guidance: ctx.guidance,
            error: 'Aborted',
        };
    }

    // Get max tokens override from settings (if enabled)
    const settings = getSettings();
    const responseLength = settings.maxTokensOverride ?? undefined;

    // Use centralized generation with API checks and error handling
    const result = await generate({
        prompt: userPrompt,
        systemPrompt,
        jsonSchema: (schema as StructuredOutputSchema | null) ?? undefined,
        signal,
        responseLength,
    });

    if (!result.success) {
        log.error(`Stage ${ctx.stage} failed`, result.error);

        return {
            stage: ctx.stage,
            timestamp,
            input: userPrompt,
            output: '',
            guidance: ctx.guidance,
            error: result.error ?? 'Generation failed',
        };
    }

    return {
        stage: ctx.stage,
        timestamp,
        input: userPrompt,
        output: result.response ?? '',
        guidance: ctx.guidance,
    };
}
