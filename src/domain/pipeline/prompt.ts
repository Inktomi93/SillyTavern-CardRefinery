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
 *
 * Prompt structure:
 * 1. TASK - Stage name and iteration context
 * 2. INSTRUCTIONS - What to do (from preset or custom)
 * 3. CHARACTER DATA - Source material to work with
 * 4. CONTEXT - Previous stage results (scores, rewrites, analysis)
 * 5. USER GUIDANCE - Additional direction from user (if any)
 */
export function buildUserPrompt(
    ctx: PromptContext,
    deps: Pick<PromptDependencies, 'getPromptPreset'>,
): string {
    const sections: string[] = [];

    // ==========================================================================
    // 1. TASK HEADER - What we're doing
    // ==========================================================================
    const stageLabels: Record<StageName, string> = {
        score: 'Score & Evaluate',
        rewrite: 'Rewrite & Improve',
        analyze: 'Analyze Changes',
    };
    let taskHeader = `# TASK: ${stageLabels[ctx.stage]}`;
    if (ctx.iterationCount > 0) {
        taskHeader += ` (Refinement #${ctx.iterationCount + 1})`;
    }
    sections.push(taskHeader);

    // ==========================================================================
    // 2. INSTRUCTIONS - What to do
    // ==========================================================================
    const instructions = getInstructions(ctx.config, deps);
    if (instructions) {
        sections.push(`## Instructions\n\n${instructions}`);
    }

    // ==========================================================================
    // 3. CHARACTER DATA - Source material
    // ==========================================================================
    if (ctx.stage === 'analyze') {
        // For analyze: show original and rewritten side by side
        sections.push(
            '## Original Character\n\n' +
                buildCharacterSummary(ctx.character, ctx.selection),
        );

        if (ctx.previousResults.rewrite) {
            sections.push(
                '## Rewritten Version\n\n' + ctx.previousResults.rewrite.output,
            );
        }
    } else {
        // For score/rewrite: just the character data
        sections.push(
            '## Character Data\n\n' +
                buildCharacterSummary(ctx.character, ctx.selection),
        );
    }

    // ==========================================================================
    // 4. CONTEXT - Previous stage results
    // ==========================================================================
    if (ctx.stage === 'rewrite' && ctx.previousResults.score) {
        sections.push(
            '## Score Results\n\n' + ctx.previousResults.score.output,
        );
    }

    if (
        ctx.stage === 'rewrite' &&
        ctx.isRefinement &&
        ctx.previousResults.analyze
    ) {
        sections.push(
            '## Analysis Feedback\n\n' + ctx.previousResults.analyze.output,
        );
    }

    if (ctx.stage === 'analyze' && ctx.previousResults.score) {
        sections.push(
            '## Score Results (Context)\n\n' + ctx.previousResults.score.output,
        );
    }

    // ==========================================================================
    // 5. USER GUIDANCE - Additional direction
    // ==========================================================================
    if (ctx.guidance?.trim()) {
        sections.push('## User Guidance\n\n' + ctx.guidance.trim());
    }

    return sections.join('\n\n---\n\n');
}
