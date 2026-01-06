// src/ui/formatter/section-renderer.ts
// =============================================================================
// SECTION RENDERING (MARKDOWN)
// =============================================================================

import type { ParsedSection } from './types';
import { escapeHtml, getScoreColor } from './helpers';

/**
 * Render parsed sections to HTML
 */
export function renderSections(sections: ParsedSection[]): string {
    if (sections.length === 0) {
        return '<div class="cr-formatted cr-formatted--empty">No content</div>';
    }

    const parts = sections.map(renderSection);
    return /* html */ `<div class="cr-formatted">${parts.join('')}</div>`;
}

/**
 * Render a single section
 */
export function renderSection(section: ParsedSection): string {
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
export function renderHeroSection(section: ParsedSection): string {
    const score = section.score;
    if (!score) return '';

    const normalized = score.max === 100 ? score.value / 10 : score.value;
    const color = getScoreColor(normalized);
    const display = Number.isInteger(score.value)
        ? score.value
        : score.value.toFixed(1);
    const title = section.title || 'Score';

    return /* html */ `
        <div class="cr-hero">
            <div class="cr-hero__label">${escapeHtml(title)}</div>
            <div class="cr-hero__score">
                <span class="cr-hero__value" style="--score-color: ${color}">${display}</span>
                <span class="cr-hero__max">/${score.max}</span>
            </div>
            <div class="cr-hero__bar">
                <div class="cr-hero__fill" style="width: ${(score.value / score.max) * 100}%; --score-color: ${color}"></div>
            </div>
        </div>
    `;
}

/**
 * Render content section (with optional score badge)
 */
export function renderContentSection(section: ParsedSection): string {
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
            <span class="cr-section__score" style="--score-color: ${color}">
                ${display}<span class="cr-section__score-max">/${section.score.max}</span>
            </span>
        `;
    }

    const childrenHtml = children.map(renderSection).join('');

    return /* html */ `
        <div class="cr-section">
            <div class="cr-section__header">
                <h3 class="cr-section__title">${escapeHtml(title)}</h3>
                ${scoreHtml}
            </div>
            <div class="cr-section__body">
                ${childrenHtml}
            </div>
        </div>
    `;
}

/**
 * Render paragraph with inline formatting
 */
export function renderParagraph(section: ParsedSection): string {
    const content = section.content || '';
    const formatted = formatInlineContent(content);
    return /* html */ `<p class="cr-para">${formatted}</p>`;
}

/**
 * Render list (supports both bullet and numbered lists)
 */
export function renderList(section: ParsedSection): string {
    const items = section.items || [];
    if (items.length === 0) return '';

    const listItems = items
        .map((item) => {
            const formatted = formatInlineContent(item);
            return /* html */ `<li>${formatted}</li>`;
        })
        .join('');

    const tag = section.listType === 'numbered' ? 'ol' : 'ul';
    return /* html */ `<${tag} class="cr-list">${listItems}</${tag}>`;
}

/**
 * Render code block
 */
export function renderCodeBlock(section: ParsedSection): string {
    const { hljs } = SillyTavern.libs;
    const content = section.content || '';
    const language = section.language || '';

    let highlighted: string;
    try {
        // Fallback to escaped HTML if hljs is not available
        if (!hljs) {
            highlighted = escapeHtml(content);
        } else if (language && hljs.getLanguage(language)) {
            highlighted = hljs.highlight(content, { language }).value;
        } else {
            highlighted = hljs.highlightAuto(content).value;
        }
    } catch {
        highlighted = escapeHtml(content);
    }

    return /* html */ `
        <div class="cr-code">
            ${language ? `<div class="cr-code__lang">${escapeHtml(language)}</div>` : ''}
            <pre class="cr-code__pre"><code class="hljs">${highlighted}</code></pre>
        </div>
    `;
}

/**
 * Format inline content (bold, italic, code, scores)
 */
export function formatInlineContent(text: string): string {
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
                ? `<span class="cr-inline-score__label">${label}:</span> `
                : '';
            return /* html */ `${labelPart}<span class="cr-inline-score" style="--score-color: ${color}">${display}<span class="cr-inline-score__max">/${m}</span></span>`;
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
        '<code class="cr-inline-code">$1</code>',
    );

    return result;
}
