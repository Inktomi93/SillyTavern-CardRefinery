// src/domain/pipeline/prompt.ts
// =============================================================================
// PIPELINE PROMPT BUILDING
// =============================================================================

import { buildCharacterSummary } from '../character';
import type {
    Character,
    FieldSelection,
    StageName,
    StageConfig,
    StageResult,
    StructuredOutputSchema,
} from '../../types';

// Forward declaration - these will be imported from data/settings
// We use dependency injection via the context to avoid circular imports
export interface PromptContext {
    character: Character;
    selection: FieldSelection;
    stage: StageName;
    config: StageConfig;
    previousResults: Record<StageName, StageResult | null>;
    iterationCount: number;
    guidance?: string;
    isRefinement?: boolean;
}

export interface PromptDependencies {
    getPromptPreset: (id: string) => { prompt: string } | null;
    getSchemaPreset: (id: string) => { schema: StructuredOutputSchema } | null;
    getSystemPrompt: (stage: StageName) => string;
    getRefinementPrompt: () => string;
}

/**
 * Get instruction text from config.
 */
function getInstructions(
    config: StageConfig,
    deps: Pick<PromptDependencies, 'getPromptPreset'>,
): string {
    // Custom prompt takes priority
    if (config.customPrompt.trim()) {
        return config.customPrompt.trim();
    }

    // Fall back to preset
    if (config.promptPresetId) {
        const preset = deps.getPromptPreset(config.promptPresetId);
        if (preset) return preset.prompt;
    }

    return '';
}

/**
 * Get schema from config.
 */
export function getSchema(
    config: StageConfig,
    deps: Pick<PromptDependencies, 'getSchemaPreset'>,
): StructuredOutputSchema | null {
    if (!config.useStructuredOutput) return null;

    // Custom schema takes priority
    if (config.customSchema.trim()) {
        try {
            return JSON.parse(config.customSchema);
        } catch {
            return null;
        }
    }

    // Fall back to preset
    if (config.schemaPresetId) {
        const preset = deps.getSchemaPreset(config.schemaPresetId);
        if (preset) return preset.schema;
    }

    return null;
}

/**
 * Get system prompt for stage.
 */
export function getStageSystemPrompt(
    stage: StageName,
    isRefinement: boolean,
    deps: Pick<PromptDependencies, 'getSystemPrompt' | 'getRefinementPrompt'>,
): string {
    if (isRefinement) {
        return deps.getRefinementPrompt();
    }
    return deps.getSystemPrompt(stage);
}

/**
 * Build the user prompt for a stage.
 */
export function buildUserPrompt(
    ctx: PromptContext,
    deps: Pick<PromptDependencies, 'getPromptPreset'>,
): string {
    const parts: string[] = [];

    // For Analyze stage, we want to show both original and rewritten versions
    if (ctx.stage === 'analyze') {
        // Original character data - labeled clearly
        parts.push('## ORIGINAL CHARACTER\n\n');
        parts.push(buildCharacterSummary(ctx.character, ctx.selection));

        // Include score results if available (context for what was being fixed)
        if (ctx.previousResults.score) {
            parts.push(
                '\n\n---\n\n## SCORE RESULTS\n\n' +
                    ctx.previousResults.score.output,
            );
        }

        // Rewritten version for comparison
        if (ctx.previousResults.rewrite) {
            parts.push(
                '\n\n---\n\n## REWRITTEN VERSION\n\n' +
                    ctx.previousResults.rewrite.output,
            );
        }
    } else {
        // Standard character data for other stages
        parts.push(buildCharacterSummary(ctx.character, ctx.selection));

        // Previous results based on stage
        if (ctx.stage === 'rewrite') {
            if (ctx.previousResults.score) {
                parts.push(
                    '\n\n---\n\n## SCORE RESULTS\n\n' +
                        ctx.previousResults.score.output,
                );
            }

            // For refinement, include analysis feedback
            if (ctx.isRefinement && ctx.previousResults.analyze) {
                parts.push(
                    '\n\n---\n\n## ANALYSIS FEEDBACK\n\n' +
                        ctx.previousResults.analyze.output,
                );
            }
        }
    }

    // User guidance
    if (ctx.guidance?.trim()) {
        parts.push('\n\n---\n\n## USER GUIDANCE\n\n' + ctx.guidance.trim());
    }

    // Iteration info
    if (ctx.iterationCount > 0) {
        parts.push(
            `\n\n---\n\n*Refinement iteration ${ctx.iterationCount + 1}*`,
        );
    }

    // Stage instructions
    const instructions = getInstructions(ctx.config, deps);
    if (instructions) {
        parts.push('\n\n---\n\n## INSTRUCTIONS\n\n' + instructions);
    }

    return parts.join('');
}
