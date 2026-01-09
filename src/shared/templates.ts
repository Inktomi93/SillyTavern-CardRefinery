// src/shared/templates.ts
// =============================================================================
// TEMPLATE PROCESSING UTILITIES
// =============================================================================
//
// Custom placeholder replacement and conditional block processing.
// Uses {{placeholder}} syntax with {{#if}}...{{/if}} conditionals.
//
// NOTE: This is separate from ST's substituteParams() because we need
// control over which macros get replaced (e.g., {{char}} should be the
// analyzed character, not the active chat character).
//
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

/**
 * Context object for template substitution.
 */
export interface TemplateContext {
    [key: string]: string | undefined;
}

/**
 * Configuration for template processing.
 */
export interface TemplateConfig {
    /**
     * Placeholders to explicitly NOT replace (pass through unchanged).
     * @example ['user', 'persona'] - Leave {{user}} and {{persona}} as-is
     */
    passthrough?: string[];

    /**
     * Use lodash.escapeRegExp for placeholder matching.
     * Default: true
     */
    escapeRegex?: boolean;
}

// =============================================================================
// PLACEHOLDER PROCESSING
// =============================================================================

/**
 * Process a template string, replacing placeholders with values from context.
 *
 * @example
 * ```ts
 * const result = processTemplate(
 *     'Hello {{name}}, your score is {{score}}.',
 *     { name: 'Alice', score: '95' }
 * );
 * // Result: "Hello Alice, your score is 95."
 * ```
 *
 * @example With conditional blocks:
 * ```ts
 * const template = `
 * # Report
 * {{#if score}}Score: {{score}}{{/if}}
 * {{#if notes}}Notes: {{notes}}{{/if}}
 * `;
 * const result = processTemplate(template, { score: '95' });
 * // Result includes score section but not notes section
 * ```
 */
export function processTemplate(
    template: string,
    context: TemplateContext,
    config: TemplateConfig = {},
): string {
    const { passthrough = [], escapeRegex = true } = config;

    // Handle conditional blocks first
    let processed = processConditionalBlocks(template, context);

    // Get lodash for escaping
    const { lodash } = SillyTavern.libs;
    const escapeForRegex =
        escapeRegex && lodash?.escapeRegExp
            ? lodash.escapeRegExp
            : (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace each context value
    for (const [key, value] of Object.entries(context)) {
        if (value === undefined) continue;
        if (passthrough.includes(key)) continue;

        const placeholder = `{{${key}}}`;
        const escaped = escapeForRegex(placeholder);
        const regex = new RegExp(escaped, 'gi');
        processed = processed.replace(regex, value);
    }

    return processed;
}

/**
 * Process conditional blocks in template.
 * Syntax: {{#if variable}}...content...{{/if}}
 */
export function processConditionalBlocks(
    template: string,
    context: TemplateContext,
): string {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/gi;

    return template.replace(conditionalRegex, (_match, variable, content) => {
        const varName = variable.toLowerCase();
        const value = context[varName];
        // Ensure value is a string before calling .trim()
        const hasValue =
            value !== undefined &&
            value !== null &&
            typeof value === 'string' &&
            value.trim() !== '';
        return hasValue ? content : '';
    });
}

/**
 * Detect which placeholders are used in a template.
 */
export function detectPlaceholders(template: string): string[] {
    const found: string[] = [];
    const regex = /\{\{(\w+)\}\}/gi;
    let match;

    while ((match = regex.exec(template)) !== null) {
        const name = match[1].toLowerCase();
        if (!found.includes(name)) {
            found.push(name);
        }
    }

    return found;
}

/**
 * Detect which conditional blocks are used in a template.
 */
export function detectConditionals(template: string): string[] {
    const found: string[] = [];
    const regex = /\{\{#if\s+(\w+)\}\}/gi;
    let match;

    while ((match = regex.exec(template)) !== null) {
        const name = match[1].toLowerCase();
        if (!found.includes(name)) {
            found.push(name);
        }
    }

    return found;
}

/**
 * Check if a template has any placeholders or conditionals.
 */
export function hasTemplateMarkers(template: string): boolean {
    return /\{\{[\w#/]/.test(template);
}

// =============================================================================
// ST MACRO ESCAPING
// =============================================================================

/**
 * Escape ST macros to prevent replacement.
 * Inserts zero-width spaces to break macro patterns.
 *
 * CRITICAL: Use this when you have content containing {{user}}, {{char}},
 * etc. that should be displayed literally, not replaced by ST.
 *
 * @example
 * ```ts
 * // Character description contains: "{{user}} will love this"
 * // Without escaping, ST replaces {{user}} with the persona name
 * const escaped = escapeSTMacros(charDescription);
 * // Now it displays literally as "{{user}} will love this"
 * ```
 */
export function escapeSTMacros(
    text: string,
    macros: string[] = ['user', 'persona', 'original', 'input'],
): string {
    if (!text) return text;

    let result = text;
    const ZWSP = '\u200B';

    for (const macro of macros) {
        const regex = new RegExp(`\\{\\{(${macro})\\}\\}`, 'gi');
        result = result.replace(regex, `{{${ZWSP}$1${ZWSP}}}`);
    }

    return result;
}

/**
 * Unescape previously escaped ST macros.
 */
export function unescapeSTMacros(text: string): string {
    if (!text) return text;

    const ZWSP = '\u200B';
    return text.replace(
        new RegExp(`\\{\\{${ZWSP}(\\w+)${ZWSP}\\}\\}`, 'g'),
        '{{$1}}',
    );
}

/**
 * Replace {{char}} with actual character name for display.
 */
export function replaceCharMacro(text: string, charName: string): string {
    if (!text || !charName) return text;
    return text.replace(/\{\{char\}\}/gi, charName);
}

/**
 * Replace {{user}} with actual user/persona name.
 * This allows the LLM to understand user-specific context in character cards.
 */
export function replaceUserMacro(text: string, userName?: string): string {
    if (!text) return text;
    const name = userName || SillyTavern.getContext().name1 || 'User';
    return text.replace(/\{\{user\}\}/gi, name);
}

/**
 * Get the current user/persona name from ST context.
 */
export function getUserName(): string {
    return SillyTavern.getContext().name1 || 'User';
}

// =============================================================================
// PROMPT BUILDING HELPERS
// =============================================================================

/**
 * Check which placeholders in a template won't have values.
 */
export function getUnfilledPlaceholders(
    template: string,
    context: TemplateContext,
): string[] {
    const used = detectPlaceholders(template);
    const unfilled: string[] = [];

    for (const placeholder of used) {
        const value = context[placeholder.toLowerCase()];
        if (value === undefined || value === null || value.trim() === '') {
            unfilled.push(placeholder);
        }
    }

    return unfilled;
}

/**
 * Build a template context from an object, converting values to strings.
 */
export function buildContext(data: Record<string, unknown>): TemplateContext {
    const context: TemplateContext = {};

    for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) {
            context[key] = '';
        } else if (typeof value === 'string') {
            context[key] = value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            context[key] = String(value);
        } else if (typeof value === 'object') {
            try {
                context[key] = JSON.stringify(value);
            } catch {
                context[key] = '[Object]';
            }
        } else {
            context[key] = String(value);
        }
    }

    return context;
}
