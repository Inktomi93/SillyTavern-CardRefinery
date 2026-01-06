// src/ui/formatter/json-renderer.ts
// =============================================================================
// JSON STRUCTURED RENDERING
// =============================================================================

import type { JsonSchemaValue } from '../../types';
import { renderHeroSection, formatInlineContent } from './section-renderer';
import {
    escapeHtml,
    inferType,
    isSimpleValue,
    formatLabel,
    findHeroKey,
    looksLikeScore,
    getScoreColor,
    isUrl,
    isEmail,
} from './helpers';

const MAX_DEPTH = 8;

export function inferSchema(data: unknown): JsonSchemaValue {
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

export function renderStructuredRoot(
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

    return /* html */ `<div class="cr-formatted">${sections.join('')}</div>`;
}

export function renderField(
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

    return /* html */ `
        <div class="cr-field">
            <div class="cr-field__label">${escapeHtml(label)}</div>
            <div class="cr-field__value">${rendered}</div>
        </div>
    `;
}

export function renderArrayField(
    label: string,
    items: unknown[],
    schema: JsonSchemaValue,
    depth: number,
): string {
    if (items.length === 0) {
        return /* html */ `
            <div class="cr-field">
                <div class="cr-field__label">${escapeHtml(label)}</div>
                <div class="cr-field__value cr-field--empty">(none)</div>
            </div>
        `;
    }

    const itemSchema = (schema.items || {
        type: inferType(items[0]),
    }) as JsonSchemaValue;

    // Simple values as list
    if (items.every(isSimpleValue)) {
        const listItems = items
            .map((item) => /* html */ `<li>${renderSimpleValue(item)}</li>`)
            .join('');
        return /* html */ `
            <div class="cr-field">
                <div class="cr-field__label">${escapeHtml(label)}</div>
                <ul class="cr-list">${listItems}</ul>
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
            return /* html */ `<div class="cr-card">${renderValue(item, itemSchema)}</div>`;
        })
        .join('');

    return /* html */ `
        <div class="cr-field">
            <div class="cr-field__label">${escapeHtml(label)}</div>
            <div class="cr-cards">${cards}</div>
        </div>
    `;
}

export function renderCard(
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
            ? `<span class="cr-card__title">${escapeHtml(String(data[titleKey]))}</span>`
            : '';
        const scorePart = scoreKey
            ? renderScoreBadge(data[scoreKey] as number)
            : '';
        header = `<div class="cr-card__header">${titlePart}${scorePart}</div>`;
    }

    let body = '';
    if (bodyKey) {
        body = `<div class="cr-card__body">${formatInlineContent(String(data[bodyKey]))}</div>`;
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
        ? `<div class="cr-card__extra">${remaining}</div>`
        : '';

    return /* html */ `<div class="cr-card">${header}${body}${extra}</div>`;
}

export function renderObjectField(
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

    return /* html */ `
        <div class="cr-section">
            <div class="cr-section__header">
                <h3 class="cr-section__title">${escapeHtml(label)}</h3>
            </div>
            <div class="cr-section__body cr-section__body--nested">
                ${fields}
            </div>
        </div>
    `;
}

export function renderValue(
    value: unknown,
    schema: JsonSchemaValue,
    fieldName?: string,
): string {
    if (value === null || value === undefined) {
        return /* html */ `<span class="cr-null">—</span>`;
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
            return /* html */ `<span>${escapeHtml(String(value))}</span>`;
    }
}

export function renderString(data: string, schema: JsonSchemaValue): string {
    if (!data.trim()) {
        return /* html */ `<span class="cr-empty">(empty)</span>`;
    }

    const format = schema.format as string | undefined;

    if (format === 'uri' || format === 'url' || isUrl(data)) {
        const display = data.length > 50 ? data.substring(0, 47) + '...' : data;
        return /* html */ `<a href="${escapeHtml(data)}" target="_blank" rel="noopener" class="cr-link">${escapeHtml(display)}</a>`;
    }

    if (format === 'email' || isEmail(data)) {
        return /* html */ `<a href="mailto:${escapeHtml(data)}" class="cr-link">${escapeHtml(data)}</a>`;
    }

    if (data.length > 100 || data.includes('\n')) {
        return /* html */ `<div class="cr-text">${formatInlineContent(data)}</div>`;
    }

    return /* html */ `<span>${formatInlineContent(data)}</span>`;
}

export function renderNumber(
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
    return /* html */ `<span class="cr-num">${formatted}</span>`;
}

export function renderScoreBadge(data: number): string {
    const max = data > 10 ? 100 : 10;
    const normalized = data > 10 ? data / 10 : data;
    const color = getScoreColor(normalized);
    const display = Number.isInteger(data) ? data : data.toFixed(1);

    return /* html */ `<span class="cr-score" style="--score-color: ${color}">${display}<span class="cr-score__max">/${max}</span></span>`;
}

export function renderBoolean(data: boolean): string {
    const icon = data ? 'fa-check-circle' : 'fa-times-circle';
    const cls = data ? 'cr-bool--yes' : 'cr-bool--no';
    return /* html */ `<span class="${cls}"><i class="fa-solid ${icon}"></i> ${data ? 'Yes' : 'No'}</span>`;
}

export function renderSimpleValue(data: unknown): string {
    if (typeof data === 'boolean') {
        return renderBoolean(data);
    }
    if (typeof data === 'number') {
        return /* html */ `<span class="cr-num">${data.toLocaleString()}</span>`;
    }
    return formatInlineContent(String(data));
}

export function renderJson(data: unknown): string {
    const { hljs } = SillyTavern.libs;
    const json = JSON.stringify(data, null, 2);
    // Fallback to escaped HTML if hljs is not available
    const highlighted = hljs
        ? hljs.highlight(json, { language: 'json' }).value
        : escapeHtml(json);
    return /* html */ `<pre class="cr-code__pre"><code class="hljs">${highlighted}</code></pre>`;
}
