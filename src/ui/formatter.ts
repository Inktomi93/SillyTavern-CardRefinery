// src/ui/formatter.ts
// =============================================================================
// HYBRID RESPONSE FORMATTER
// =============================================================================
//
// Renders both JSON and markdown responses with consistent, polished styling.
// Detects structure patterns in markdown (sections, scores, lists) and renders
// them with the same visual treatment as structured JSON output.

import type { StructuredOutputSchema, JsonSchemaValue } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ParsedSection {
    type: 'hero' | 'section' | 'paragraph' | 'list' | 'code';
    title?: string;
    score?: { value: number; max: number };
    content?: string;
    items?: string[];
    children?: ParsedSection[];
    language?: string;
}

interface ScoreMatch {
    value: number;
    max: number;
    label?: string;
}

// =============================================================================
// MAIN ENTRY POINTS
// =============================================================================

/**
 * Format any response (auto-detects JSON vs markdown)
 */
export function formatResponse(response: string): string {
    const { DOMPurify } = SillyTavern.libs;
    const text =
        typeof response === 'string' ? response : String(response ?? '');

    // Try JSON first
    const parsed = parseStructuredResponse(text);
    if (parsed && typeof parsed === 'object') {
        return formatStructuredResponse(text, null);
    }

    // Parse markdown into structured sections
    const sections = parseMarkdownSections(text);
    const html = renderSections(sections);

    return DOMPurify.sanitize(html);
}

/**
 * Format a structured JSON response with smart rendering
 */
export function formatStructuredResponse(
    response: string,
    schema: StructuredOutputSchema | null,
): string {
    const { DOMPurify } = SillyTavern.libs;
    const text =
        typeof response === 'string' ? response : String(response ?? '');

    const parsed = parseStructuredResponse(text);

    if (!parsed || typeof parsed !== 'object') {
        // Fall back to markdown parsing
        const sections = parseMarkdownSections(text);
        return DOMPurify.sanitize(renderSections(sections));
    }

    const schemaValue = schema?.value ?? inferSchema(parsed);
    const html = renderStructuredRoot(
        parsed as Record<string, unknown>,
        schemaValue,
    );

    return DOMPurify.sanitize(html);
}

/**
 * Parse a structured response (handles JSON and code blocks)
 */
export function parseStructuredResponse(response: string): unknown | null {
    try {
        return JSON.parse(response);
    } catch {
        // Try to extract JSON from markdown code blocks
        const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            try {
                return JSON.parse(codeBlockMatch[1].trim());
            } catch {
                return null;
            }
        }
        return null;
    }
}

// =============================================================================
// MARKDOWN STRUCTURE DETECTION
// =============================================================================

/**
 * Parse markdown into structured sections for rich rendering
 */
function parseMarkdownSections(text: string): ParsedSection[] {
    const lines = text.split('\n');
    const sections: ParsedSection[] = [];
    let currentSection: ParsedSection | null = null;
    let contentBuffer: string[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer: string[] = [];

    const flushContent = () => {
        if (contentBuffer.length === 0) return;

        const content = contentBuffer.join('\n').trim();
        if (!content) {
            contentBuffer = [];
            return;
        }

        // Check if it's a list
        const listItems = extractListItems(content);
        if (listItems.length > 0) {
            const section: ParsedSection = { type: 'list', items: listItems };
            if (currentSection) {
                currentSection.children = currentSection.children || [];
                currentSection.children.push(section);
            } else {
                sections.push(section);
            }
        } else {
            // Parse as paragraph(s) with potential inline scores
            const paragraphs = content.split(/\n\n+/);
            for (const para of paragraphs) {
                if (!para.trim()) continue;
                const section: ParsedSection = {
                    type: 'paragraph',
                    content: para.trim(),
                };
                if (currentSection) {
                    currentSection.children = currentSection.children || [];
                    currentSection.children.push(section);
                } else {
                    sections.push(section);
                }
            }
        }
        contentBuffer = [];
    };

    const flushCode = () => {
        if (codeBuffer.length === 0) return;
        const section: ParsedSection = {
            type: 'code',
            content: codeBuffer.join('\n'),
            language: codeLanguage,
        };
        if (currentSection) {
            currentSection.children = currentSection.children || [];
            currentSection.children.push(section);
        } else {
            sections.push(section);
        }
        codeBuffer = [];
        codeLanguage = '';
    };

    for (const line of lines) {
        // Skip horizontal rules
        if (/^[-*_]{3,}\s*$/.test(line.trim())) {
            continue;
        }

        // Code block handling
        const codeBlockStart = line.match(/^```(\w*)/);
        if (codeBlockStart) {
            if (inCodeBlock) {
                // End of code block
                flushCode();
                inCodeBlock = false;
            } else {
                // Start of code block
                flushContent();
                inCodeBlock = true;
                codeLanguage = codeBlockStart[1] || '';
            }
            continue;
        }

        if (inCodeBlock) {
            codeBuffer.push(line);
            continue;
        }

        // Check for headers
        const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
        if (headerMatch) {
            flushContent();

            // Save current section if exists (only if it has content)
            if (currentSection) {
                // Only push if section has children or a score
                if (
                    (currentSection.children &&
                        currentSection.children.length > 0) ||
                    currentSection.score
                ) {
                    sections.push(currentSection);
                }
            }

            const level = headerMatch[1].length;
            const title = headerMatch[2].trim();

            // Check for hero patterns (main score/title)
            const heroScore = extractHeroScore(title);
            if (heroScore && level === 1) {
                sections.push({
                    type: 'hero',
                    title: heroScore.label,
                    score: { value: heroScore.value, max: heroScore.max },
                });
                currentSection = null;
            } else {
                currentSection = {
                    type: 'section',
                    title,
                    children: [],
                };

                // Check if title contains a score
                const titleScore = extractScore(title);
                if (titleScore) {
                    currentSection.score = {
                        value: titleScore.value,
                        max: titleScore.max,
                    };
                    currentSection.title = title
                        .replace(/\s*[\d.]+\s*\/\s*\d+\s*$/, '')
                        .trim();
                }
            }
            continue;
        }

        // Check for standalone score line (like "Score: 8/10" or "8/10")
        const standaloneScore = extractStandaloneScore(line);
        if (standaloneScore && currentSection) {
            currentSection.score = {
                value: standaloneScore.value,
                max: standaloneScore.max,
            };
            continue;
        }

        // Regular content
        contentBuffer.push(line);
    }

    // Flush remaining content
    flushContent();
    if (inCodeBlock) flushCode();
    // Only push final section if it has content
    if (
        currentSection &&
        ((currentSection.children && currentSection.children.length > 0) ||
            currentSection.score)
    ) {
        sections.push(currentSection);
    }

    // Post-process: detect hero if first section looks like overall score
    if (sections.length > 0 && sections[0].type === 'section') {
        const first = sections[0];
        if (first.score && isHeroTitle(first.title || '')) {
            sections[0] = {
                type: 'hero',
                title: first.title,
                score: first.score,
            };
            // Move children to next position
            if (first.children && first.children.length > 0) {
                sections.splice(1, 0, ...first.children.map((c) => c));
            }
        }
    }

    return sections;
}

/**
 * Extract list items from content
 */
function extractListItems(content: string): string[] {
    const lines = content.split('\n');
    const items: string[] = [];
    let currentItem = '';

    for (const line of lines) {
        const listMatch = line.match(/^[\s]*[-*•]\s+(.+)$/);
        const numberedMatch = line.match(/^[\s]*\d+[.)]\s+(.+)$/);

        if (listMatch || numberedMatch) {
            if (currentItem) items.push(currentItem.trim());
            currentItem = (listMatch || numberedMatch)![1];
        } else if (currentItem && line.match(/^\s+/)) {
            // Continuation of list item
            currentItem += ' ' + line.trim();
        } else if (line.trim() === '') {
            if (currentItem) items.push(currentItem.trim());
            currentItem = '';
        } else {
            // Not a list
            if (items.length === 0) return [];
            if (currentItem) items.push(currentItem.trim());
            currentItem = '';
        }
    }

    if (currentItem) items.push(currentItem.trim());
    return items;
}

/**
 * Extract score from text (e.g., "8/10", "Score: 85/100")
 */
function extractScore(text: string): ScoreMatch | null {
    // Match patterns like "8/10", "85/100", "Score: 6/10"
    const match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
    if (match) {
        const value = parseFloat(match[1]);
        const max = parseInt(match[2], 10);
        if (!isNaN(value) && !isNaN(max) && max > 0) {
            return { value, max };
        }
    }
    return null;
}

/**
 * Extract standalone score line
 */
function extractStandaloneScore(line: string): ScoreMatch | null {
    const trimmed = line.trim();
    // Match "Score: X/Y" or just "X/Y" on its own line
    const match = trimmed.match(
        /^(?:score\s*:?\s*)?(\d+(?:\.\d+)?)\s*\/\s*(\d+)$/i,
    );
    if (match) {
        const value = parseFloat(match[1]);
        const max = parseInt(match[2], 10);
        if (!isNaN(value) && !isNaN(max) && max > 0) {
            return { value, max };
        }
    }
    return null;
}

/**
 * Extract hero score from title (for main title with score)
 */
function extractHeroScore(title: string): ScoreMatch | null {
    const score = extractScore(title);
    if (score) {
        const label = title.replace(/\s*[\d.]+\s*\/\s*\d+\s*$/, '').trim();
        return { ...score, label };
    }
    return null;
}

/**
 * Check if title looks like a hero/overall score
 */
function isHeroTitle(title: string): boolean {
    const lower = title.toLowerCase().replace(/[_-]/g, '');
    const heroPatterns = [
        'overall',
        'total',
        'final',
        'summary',
        'verdict',
        'rating',
        'soulcheck',
    ];
    return heroPatterns.some((p) => lower.includes(p));
}

// =============================================================================
// SECTION RENDERING
// =============================================================================

/**
 * Render parsed sections to HTML
 */
function renderSections(sections: ParsedSection[]): string {
    if (sections.length === 0) {
        return '<div class="ct-formatted ct-formatted--empty">No content</div>';
    }

    const parts = sections.map(renderSection);
    return `<div class="ct-formatted">${parts.join('')}</div>`;
}

/**
 * Render a single section
 */
function renderSection(section: ParsedSection): string {
    switch (section.type) {
        case 'hero':
            return renderHeroSection(section);
        case 'section':
            return renderContentSection(section);
        case 'paragraph':
            return renderParagraph(section);
        case 'list':
            return renderList(section);
        case 'code':
            return renderCodeBlock(section);
        default:
            return '';
    }
}

/**
 * Render hero score section
 */
function renderHeroSection(section: ParsedSection): string {
    const score = section.score;
    if (!score) return '';

    const normalized = score.max === 100 ? score.value / 10 : score.value;
    const color = getScoreColor(normalized);
    const display = Number.isInteger(score.value)
        ? score.value
        : score.value.toFixed(1);
    const title = section.title || 'Score';

    return `
        <div class="ct-hero">
            <div class="ct-hero__label">${escapeHtml(title)}</div>
            <div class="ct-hero__score">
                <span class="ct-hero__value" style="--score-color: ${color}">${display}</span>
                <span class="ct-hero__max">/${score.max}</span>
            </div>
            <div class="ct-hero__bar">
                <div class="ct-hero__fill" style="width: ${(score.value / score.max) * 100}%; background: ${color}"></div>
            </div>
        </div>
    `;
}

/**
 * Render content section (with optional score badge)
 */
function renderContentSection(section: ParsedSection): string {
    const title = section.title || '';
    const hasScore = section.score != null;
    const children = section.children || [];

    let scoreHtml = '';
    if (hasScore && section.score) {
        const normalized =
            section.score.max === 100
                ? section.score.value / 10
                : section.score.value;
        const color = getScoreColor(normalized);
        const display = Number.isInteger(section.score.value)
            ? section.score.value
            : section.score.value.toFixed(1);
        scoreHtml = `
            <span class="ct-section__score" style="--score-color: ${color}">
                ${display}<span class="ct-section__score-max">/${section.score.max}</span>
            </span>
        `;
    }

    const childrenHtml = children.map(renderSection).join('');

    return `
        <div class="ct-section">
            <div class="ct-section__header">
                <h3 class="ct-section__title">${escapeHtml(title)}</h3>
                ${scoreHtml}
            </div>
            <div class="ct-section__body">
                ${childrenHtml}
            </div>
        </div>
    `;
}

/**
 * Render paragraph with inline formatting
 */
function renderParagraph(section: ParsedSection): string {
    const content = section.content || '';
    const formatted = formatInlineContent(content);
    return `<p class="ct-para">${formatted}</p>`;
}

/**
 * Render list
 */
function renderList(section: ParsedSection): string {
    const items = section.items || [];
    if (items.length === 0) return '';

    const listItems = items
        .map((item) => {
            const formatted = formatInlineContent(item);
            return `<li>${formatted}</li>`;
        })
        .join('');

    return `<ul class="ct-list">${listItems}</ul>`;
}

/**
 * Render code block
 */
function renderCodeBlock(section: ParsedSection): string {
    const { hljs } = SillyTavern.libs;
    const content = section.content || '';
    const language = section.language || '';

    let highlighted: string;
    try {
        if (language && hljs.getLanguage(language)) {
            highlighted = hljs.highlight(content, { language }).value;
        } else {
            highlighted = hljs.highlightAuto(content).value;
        }
    } catch {
        highlighted = escapeHtml(content);
    }

    return `
        <div class="ct-code">
            ${language ? `<div class="ct-code__lang">${escapeHtml(language)}</div>` : ''}
            <pre class="ct-code__pre"><code class="hljs">${highlighted}</code></pre>
        </div>
    `;
}

/**
 * Format inline content (bold, italic, code, scores)
 */
function formatInlineContent(text: string): string {
    let result = escapeHtml(text);

    // Inline scores (e.g., "8/10" or "Score: 6/10")
    result = result.replace(
        /(?:(\w+)\s*:\s*)?(\d+(?:\.\d+)?)\s*\/\s*(\d+)/gi,
        (match, label, value, max) => {
            const v = parseFloat(value);
            const m = parseInt(max, 10);
            const normalized = m === 100 ? v / 10 : v;
            const color = getScoreColor(normalized);
            const display = Number.isInteger(v) ? v : v.toFixed(1);
            const labelPart = label
                ? `<span class="ct-inline-score__label">${label}:</span> `
                : '';
            return `${labelPart}<span class="ct-inline-score" style="--score-color: ${color}">${display}<span class="ct-inline-score__max">/${m}</span></span>`;
        },
    );

    // Bold (**text** or __text__)
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_) - careful not to match inside words
    result = result.replace(
        /(?<![*_])\*(?![*\s])(.+?)(?<![*\s])\*(?![*_])/g,
        '<em>$1</em>',
    );
    result = result.replace(
        /(?<![*_])_(?![_\s])(.+?)(?<![_\s])_(?![*_])/g,
        '<em>$1</em>',
    );

    // Inline code (`code`)
    result = result.replace(
        /`([^`]+)`/g,
        '<code class="ct-inline-code">$1</code>',
    );

    return result;
}

// =============================================================================
// JSON STRUCTURED RENDERING (preserved from original)
// =============================================================================

const MAX_DEPTH = 8;

function inferSchema(data: unknown): JsonSchemaValue {
    if (data === null) return { type: 'null' };
    if (Array.isArray(data)) {
        return {
            type: 'array',
            items: data.length > 0 ? inferSchema(data[0]) : { type: 'string' },
        };
    }
    if (typeof data === 'object') {
        const properties: Record<string, JsonSchemaValue> = {};
        for (const [key, value] of Object.entries(
            data as Record<string, unknown>,
        )) {
            properties[key] = inferSchema(value);
        }
        return { type: 'object', properties };
    }
    return { type: typeof data as 'string' | 'number' | 'boolean' };
}

function renderStructuredRoot(
    data: Record<string, unknown>,
    schema: JsonSchemaValue,
): string {
    const heroKey = findHeroKey(data);
    const heroValue = heroKey ? data[heroKey] : null;

    const sections: string[] = [];

    // Hero score at top
    if (heroKey && typeof heroValue === 'number') {
        const max = heroValue > 10 ? 100 : 10;
        sections.push(
            renderHeroSection({
                type: 'hero',
                title: formatLabel(heroKey),
                score: { value: heroValue, max },
            }),
        );
    }

    // Render all fields
    const properties = (schema.properties || {}) as Record<
        string,
        JsonSchemaValue
    >;
    const keys =
        Object.keys(properties).length > 0
            ? Object.keys(properties)
            : Object.keys(data);

    for (const key of keys) {
        if (key === heroKey) continue;
        const value = data[key];
        if (value === undefined) continue;

        const propSchema = properties[key] || { type: inferType(value) };
        sections.push(
            renderField(key, value, propSchema as JsonSchemaValue, 0),
        );
    }

    return `<div class="ct-formatted">${sections.join('')}</div>`;
}

function renderField(
    key: string,
    value: unknown,
    schema: JsonSchemaValue,
    depth: number,
): string {
    if (depth > MAX_DEPTH) {
        return renderJson(value);
    }

    const label = formatLabel(key);
    const type = schema.type || inferType(value);

    if (type === 'array' && Array.isArray(value)) {
        return renderArrayField(label, value, schema, depth);
    }

    if (type === 'object' && typeof value === 'object' && value !== null) {
        return renderObjectField(
            label,
            value as Record<string, unknown>,
            schema,
            depth,
        );
    }

    const rendered = renderValue(value, schema, key);

    return `
        <div class="ct-field">
            <div class="ct-field__label">${escapeHtml(label)}</div>
            <div class="ct-field__value">${rendered}</div>
        </div>
    `;
}

function renderArrayField(
    label: string,
    items: unknown[],
    schema: JsonSchemaValue,
    depth: number,
): string {
    if (items.length === 0) {
        return `
            <div class="ct-field">
                <div class="ct-field__label">${escapeHtml(label)}</div>
                <div class="ct-field__value ct-field--empty">(none)</div>
            </div>
        `;
    }

    const itemSchema = (schema.items || {
        type: inferType(items[0]),
    }) as JsonSchemaValue;

    // Simple values as list
    if (items.every(isSimpleValue)) {
        const listItems = items
            .map((item) => `<li>${renderSimpleValue(item)}</li>`)
            .join('');
        return `
            <div class="ct-field">
                <div class="ct-field__label">${escapeHtml(label)}</div>
                <ul class="ct-list">${listItems}</ul>
            </div>
        `;
    }

    // Complex values as cards
    const cards = items
        .map((item, index) => {
            if (typeof item === 'object' && item !== null) {
                return renderCard(
                    item as Record<string, unknown>,
                    itemSchema,
                    depth + 1,
                    index,
                );
            }
            return `<div class="ct-card">${renderValue(item, itemSchema)}</div>`;
        })
        .join('');

    return `
        <div class="ct-field">
            <div class="ct-field__label">${escapeHtml(label)}</div>
            <div class="ct-cards">${cards}</div>
        </div>
    `;
}

function renderCard(
    data: Record<string, unknown>,
    schema: JsonSchemaValue,
    depth: number,
    _index: number,
): string {
    const properties = (schema.properties || {}) as Record<
        string,
        JsonSchemaValue
    >;
    const keys =
        Object.keys(properties).length > 0
            ? Object.keys(properties)
            : Object.keys(data);

    // Find title, score, and body fields
    const titleKey = keys.find(
        (k) => typeof data[k] === 'string' && (data[k] as string).length < 100,
    );
    const scoreKey = keys.find(
        (k) =>
            typeof data[k] === 'number' &&
            (data[k] as number) >= 0 &&
            (data[k] as number) <= 100,
    );
    const bodyKey = keys.find(
        (k) =>
            typeof data[k] === 'string' &&
            (data[k] as string).length >= 50 &&
            k !== titleKey,
    );

    let header = '';
    if (titleKey || scoreKey) {
        const titlePart = titleKey
            ? `<span class="ct-card__title">${escapeHtml(String(data[titleKey]))}</span>`
            : '';
        const scorePart = scoreKey
            ? renderScoreBadge(data[scoreKey] as number)
            : '';
        header = `<div class="ct-card__header">${titlePart}${scorePart}</div>`;
    }

    let body = '';
    if (bodyKey) {
        body = `<div class="ct-card__body">${formatInlineContent(String(data[bodyKey]))}</div>`;
    }

    const remainingKeys = keys.filter(
        (k) => k !== titleKey && k !== scoreKey && k !== bodyKey,
    );
    const remaining = remainingKeys
        .map((k) => {
            const v = data[k];
            if (v === undefined) return '';
            const propSchema = properties[k] || { type: inferType(v) };
            return renderField(k, v, propSchema as JsonSchemaValue, depth + 1);
        })
        .filter(Boolean)
        .join('');

    const extra = remaining
        ? `<div class="ct-card__extra">${remaining}</div>`
        : '';

    return `<div class="ct-card">${header}${body}${extra}</div>`;
}

function renderObjectField(
    label: string,
    data: Record<string, unknown>,
    schema: JsonSchemaValue,
    depth: number,
): string {
    const properties = (schema.properties || {}) as Record<
        string,
        JsonSchemaValue
    >;
    const keys =
        Object.keys(properties).length > 0
            ? Object.keys(properties)
            : Object.keys(data);

    const fields = keys
        .map((k) => {
            const v = data[k];
            if (v === undefined) return '';
            const propSchema = properties[k] || { type: inferType(v) };
            return renderField(k, v, propSchema as JsonSchemaValue, depth + 1);
        })
        .filter(Boolean)
        .join('');

    return `
        <div class="ct-section">
            <div class="ct-section__header">
                <h3 class="ct-section__title">${escapeHtml(label)}</h3>
            </div>
            <div class="ct-section__body ct-section__body--nested">
                ${fields}
            </div>
        </div>
    `;
}

function renderValue(
    value: unknown,
    schema: JsonSchemaValue,
    fieldName?: string,
): string {
    if (value === null || value === undefined) {
        return `<span class="ct-null">—</span>`;
    }

    const type = schema.type || inferType(value);

    switch (type) {
        case 'string':
            return renderString(value as string, schema);
        case 'number':
        case 'integer':
            return renderNumber(value as number, schema, fieldName);
        case 'boolean':
            return renderBoolean(value as boolean);
        default:
            return `<span>${escapeHtml(String(value))}</span>`;
    }
}

function renderString(data: string, schema: JsonSchemaValue): string {
    if (!data.trim()) {
        return `<span class="ct-empty">(empty)</span>`;
    }

    const format = schema.format as string | undefined;

    if (format === 'uri' || format === 'url' || isUrl(data)) {
        const display = data.length > 50 ? data.substring(0, 47) + '...' : data;
        return `<a href="${escapeHtml(data)}" target="_blank" rel="noopener" class="ct-link">${escapeHtml(display)}</a>`;
    }

    if (format === 'email' || isEmail(data)) {
        return `<a href="mailto:${escapeHtml(data)}" class="ct-link">${escapeHtml(data)}</a>`;
    }

    if (data.length > 100 || data.includes('\n')) {
        return `<div class="ct-text">${formatInlineContent(data)}</div>`;
    }

    return `<span>${formatInlineContent(data)}</span>`;
}

function renderNumber(
    data: number,
    schema: JsonSchemaValue,
    fieldName?: string,
): string {
    const label = String(
        schema.title || schema.description || fieldName || '',
    ).toLowerCase();

    if (looksLikeScore(label, data)) {
        return renderScoreBadge(data);
    }

    const formatted = data.toLocaleString(undefined, {
        maximumFractionDigits: 2,
    });
    return `<span class="ct-num">${formatted}</span>`;
}

function renderScoreBadge(data: number): string {
    const max = data > 10 ? 100 : 10;
    const normalized = data > 10 ? data / 10 : data;
    const color = getScoreColor(normalized);
    const display = Number.isInteger(data) ? data : data.toFixed(1);

    return `<span class="ct-score" style="--score-color: ${color}">${display}<span class="ct-score__max">/${max}</span></span>`;
}

function renderBoolean(data: boolean): string {
    const icon = data ? 'fa-check-circle' : 'fa-times-circle';
    const cls = data ? 'ct-bool--yes' : 'ct-bool--no';
    return `<span class="${cls}"><i class="fa-solid ${icon}"></i> ${data ? 'Yes' : 'No'}</span>`;
}

function renderSimpleValue(data: unknown): string {
    if (typeof data === 'boolean') {
        return renderBoolean(data);
    }
    if (typeof data === 'number') {
        return `<span class="ct-num">${data.toLocaleString()}</span>`;
    }
    return formatInlineContent(String(data));
}

function renderJson(data: unknown): string {
    const { hljs } = SillyTavern.libs;
    const json = JSON.stringify(data, null, 2);
    const highlighted = hljs.highlight(json, { language: 'json' }).value;
    return `<pre class="ct-code__pre"><code class="hljs">${highlighted}</code></pre>`;
}

// =============================================================================
// HELPERS
// =============================================================================

function escapeHtml(value: unknown): string {
    const { DOMPurify } = SillyTavern.libs;
    const str = typeof value === 'string' ? value : String(value ?? '');
    return DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });
}

function inferType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function isSimpleValue(value: unknown): boolean {
    return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
    );
}

function formatLabel(key: string): string {
    return key
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function findHeroKey(data: Record<string, unknown>): string | null {
    const heroPatterns = [
        'overallscore',
        'totalscore',
        'overall',
        'total',
        'score',
        'rating',
    ];

    for (const pattern of heroPatterns) {
        for (const key of Object.keys(data)) {
            if (
                key.toLowerCase().replace(/_/g, '') === pattern &&
                typeof data[key] === 'number'
            ) {
                return key;
            }
        }
    }

    return null;
}

function looksLikeScore(label: string, value: number): boolean {
    const scoreWords = [
        'score',
        'rating',
        'rank',
        'grade',
        'level',
        'confidence',
        'quality',
    ];
    if (scoreWords.some((word) => label.includes(word))) return true;
    if (value >= 0 && value <= 10 && Number.isFinite(value)) return true;
    if (value >= 0 && value <= 100 && Number.isInteger(value)) return true;
    return false;
}

function getScoreColor(score: number): string {
    // Returns CSS color based on score (0-10 scale)
    if (score >= 8) return 'var(--ct-score-high, #10b981)';
    if (score >= 6) return 'var(--ct-score-good, #22c55e)';
    if (score >= 4) return 'var(--ct-score-mid, #eab308)';
    if (score >= 2) return 'var(--ct-score-low, #f97316)';
    return 'var(--ct-score-bad, #ef4444)';
}

function isUrl(str: string): boolean {
    return /^https?:\/\//i.test(str);
}

function isEmail(str: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}
