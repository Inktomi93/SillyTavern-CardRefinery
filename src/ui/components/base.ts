// src/ui/components/base.ts
// =============================================================================
// BASE COMPONENT UTILITIES
// =============================================================================
//
// IMPORTANT: This file contains ONLY DOM utilities that ST doesn't provide.
// For everything else, use the ST APIs via shared/st.ts:
//   - debounce/throttle -> import { debounce, throttle } from '../../shared'
//   - sanitizeHtml -> import { sanitizeHtml } from '../../shared'
//   - avatar URLs -> import { getAvatarUrl } from '../../shared'
//
// =============================================================================

/**
 * Create an element from HTML string.
 */
export function createElement<T extends HTMLElement>(html: string): T {
    const template = document.createElement('template');
    template.innerHTML = SillyTavern.libs.DOMPurify.sanitize(html.trim());
    return template.content.firstChild as T;
}

/**
 * Query element with type safety.
 */
export function $(
    selector: string,
    parent: Element | Document = document,
): HTMLElement | null {
    return parent.querySelector(selector);
}

/**
 * Query all elements.
 */
export function $$(
    selector: string,
    parent: Element | Document = document,
): HTMLElement[] {
    return Array.from(parent.querySelectorAll(selector));
}

/**
 * Add event listener with cleanup tracking.
 */
export function on<K extends keyof HTMLElementEventMap>(
    element: HTMLElement | null,
    event: K,
    handler: (e: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
): () => void {
    if (!element) return () => {};

    element.addEventListener(event, handler as EventListener, options);

    return () => {
        element.removeEventListener(event, handler as EventListener, options);
    };
}

/**
 * Simple reactive state helper.
 * Returns [get, set, subscribe] tuple.
 */
export function createSignal<T>(
    initial: T,
): [
    () => T,
    (value: T | ((prev: T) => T)) => void,
    (fn: (v: T) => void) => () => void,
] {
    let value = initial;
    const listeners = new Set<(v: T) => void>();

    const get = () => value;

    const set = (newValue: T | ((prev: T) => T)) => {
        value =
            typeof newValue === 'function'
                ? (newValue as (prev: T) => T)(value)
                : newValue;
        listeners.forEach((fn) => fn(value));
    };

    const subscribe = (fn: (v: T) => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
    };

    return [get, set, subscribe];
}

// NOTE: debounce/throttle removed - use import { debounce, throttle } from '../../shared'

/**
 * Format character count for display.
 */
export function formatCharCount(count: number): string {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
}

/**
 * Format token count for display.
 * Shows loading state when tokens are undefined, "—" when null (unavailable).
 */
export function formatTokenCount(tokens: number | null | undefined): string {
    if (tokens === undefined) return '...';
    if (tokens === null) return '—';
    if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + '…';
}

// NOTE: getAvatarUrl removed - use import { getAvatarUrl } from '../../shared'
// which wraps st().getThumbnailUrl() for proper ST integration

/**
 * CSS class helper for conditional classes.
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(' ');
}

// =============================================================================
// MORPHDOM - Efficient DOM Updates
// =============================================================================

/**
 * Options for morphdom updates.
 */
export interface MorphOptions {
    /** Called before node is updated. Return false to skip. */
    onBeforeElUpdated?: (fromEl: HTMLElement, toEl: HTMLElement) => boolean;
    /** Called before a child node is discarded. */
    onBeforeNodeDiscarded?: (node: Node) => boolean;
    /** Called after node is updated. */
    onNodeAdded?: (node: Node) => void;
}

/**
 * Efficiently update DOM by morphing from current to new HTML.
 *
 * Uses morphdom for surgical DOM updates that preserve:
 * - Focus state (input fields stay focused)
 * - Scroll position
 * - Form values
 * - Event listeners on unchanged nodes
 *
 * @param container - Container to update
 * @param newHtml - New HTML content
 * @param options - morphdom options
 *
 * @example
 * ```ts
 * // Instead of: container.innerHTML = renderContent()
 * morphUpdate(container, renderContent());
 * ```
 */
export function morphUpdate(
    container: HTMLElement,
    newHtml: string,
    options?: MorphOptions,
): void {
    const morphdom = SillyTavern.libs.morphdom;
    const DOMPurify = SillyTavern.libs.DOMPurify;

    // Fallback to innerHTML if morphdom is not available
    if (!morphdom) {
        container.innerHTML = DOMPurify.sanitize(newHtml);
        return;
    }

    // Create a temporary wrapper with sanitized new content
    const wrapper = document.createElement('div');
    wrapper.innerHTML = DOMPurify.sanitize(newHtml);

    // Morph the container's children
    morphdom(container, wrapper, {
        childrenOnly: true,
        onBeforeElUpdated: (fromEl: HTMLElement, toEl: HTMLElement) => {
            // Preserve focused input state
            if (
                document.activeElement === fromEl &&
                fromEl.tagName === 'INPUT'
            ) {
                const fromInput = fromEl as HTMLInputElement;
                const toInput = toEl as HTMLInputElement;
                // Preserve current value and selection
                toInput.value = fromInput.value;
                toInput.selectionStart = fromInput.selectionStart;
                toInput.selectionEnd = fromInput.selectionEnd;
            }

            // Preserve textarea content if focused
            if (
                document.activeElement === fromEl &&
                fromEl.tagName === 'TEXTAREA'
            ) {
                const fromTextarea = fromEl as HTMLTextAreaElement;
                const toTextarea = toEl as HTMLTextAreaElement;
                toTextarea.value = fromTextarea.value;
                toTextarea.selectionStart = fromTextarea.selectionStart;
                toTextarea.selectionEnd = fromTextarea.selectionEnd;
            }

            // Call custom handler if provided
            return options?.onBeforeElUpdated?.(fromEl, toEl) ?? true;
        },
        onBeforeNodeDiscarded: options?.onBeforeNodeDiscarded,
        onNodeAdded: options?.onNodeAdded,
    });
}

/**
 * Morph a single element to match new HTML.
 * Useful when you want to replace an element but preserve its state.
 */
export function morphElement(element: HTMLElement, newHtml: string): void {
    const morphdom = SillyTavern.libs.morphdom;
    const DOMPurify = SillyTavern.libs.DOMPurify;

    const template = document.createElement('template');
    template.innerHTML = DOMPurify.sanitize(newHtml.trim());
    const newElement = template.content.firstChild as HTMLElement;

    if (newElement) {
        // Fallback to replaceWith if morphdom is not available
        if (!morphdom) {
            element.replaceWith(newElement);
            return;
        }
        morphdom(element, newElement);
    }
}
