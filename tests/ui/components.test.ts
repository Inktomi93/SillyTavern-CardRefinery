/**
 * UI Component Tests
 *
 * Tests UI components by mocking their dependencies and verifying
 * the rendered HTML output.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApiStatus } from '../../src/shared/profiles';

/** Creates a mock ApiStatus with all required fields */
function createMockApiStatus(overrides: Partial<ApiStatus> = {}): ApiStatus {
    return {
        mode: 'current',
        displayName: 'OpenAI',
        source: 'openai',
        model: 'gpt-4-turbo-preview',
        modelDisplay: 'gpt-4-turbo',
        apiType: 'cc',
        contextSize: 128000,
        maxOutput: 4096,
        isReady: true,
        statusText: 'Ready',
        error: null,
        ...overrides,
    };
}

// Mock the shared module before importing components
vi.mock('../../src/shared', async () => {
    const actual = await vi.importActual('../../src/shared');
    return {
        ...actual,
        MODULE_NAME: 'SillyTavern-CardRefinery',
        CSS_PREFIX: 'cr-',
        getApiStatus: vi.fn(() => createMockApiStatus()),
        hasCMRS: vi.fn(() => false),
        getAvailableProfiles: vi.fn(() => []),
    };
});

// Mock the data module
vi.mock('../../src/data', () => ({
    getSettings: vi.fn(() => ({})),
    save: vi.fn(),
}));

// Import components after mocks are set up
import {
    renderApiStatus,
    renderApiStatusCompact,
} from '../../src/ui/components/api-status';
import { getApiStatus, hasCMRS } from '../../src/shared';
import { cx } from '../../src/ui/components/base';

describe('API Status Component', () => {
    // Reset mocks to default "ready" state before each test
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset to default ready state
        vi.mocked(getApiStatus).mockReturnValue(createMockApiStatus());
        vi.mocked(hasCMRS).mockReturnValue(false);
    });

    describe('renderApiStatus', () => {
        it('renders with ready status', () => {
            const html = renderApiStatus();

            expect(html).toContain('cr-api-status');
            expect(html).toContain('cr-api-status--ready');
            expect(html).toContain('fa-circle-check');
            expect(html).toContain('cr-text-success');
            expect(html).toContain('gpt-4-turbo');
        });

        it('renders with error status', () => {
            vi.mocked(getApiStatus).mockReturnValue(
                createMockApiStatus({
                    isReady: false,
                    modelDisplay: 'No API configured',
                    statusText: 'Error',
                    error: 'API key missing',
                }),
            );

            const html = renderApiStatus();

            expect(html).toContain('cr-api-status--error');
            expect(html).toContain('fa-circle-xmark');
            expect(html).toContain('cr-text-danger');
            expect(html).toContain('fa-exclamation-triangle');
            expect(html).toContain('API key missing');
        });

        it('excludes profile selector when CMRS not available', () => {
            const html = renderApiStatus();

            expect(html).not.toContain('profile_select');
        });
    });

    describe('renderApiStatusCompact', () => {
        it('renders compact version with model name', () => {
            const html = renderApiStatusCompact();

            expect(html).toContain('cr-api-badge');
            expect(html).toContain('fa-circle-check');
            expect(html).toContain('gpt-4-turbo');
        });

        it('shows error styling when not ready', () => {
            vi.mocked(getApiStatus).mockReturnValue(
                createMockApiStatus({
                    isReady: false,
                    modelDisplay: 'Error',
                    statusText: 'API Error',
                    error: 'Connection failed',
                }),
            );

            const html = renderApiStatusCompact();

            expect(html).toContain('cr-api-badge--error');
            expect(html).toContain('fa-circle-xmark');
        });
    });
});

describe('Base UI Utilities', () => {
    describe('cx (classname utility)', () => {
        it('combines class names', () => {
            expect(cx('foo', 'bar')).toBe('foo bar');
        });

        it('filters falsy values', () => {
            const shouldInclude = false;
            expect(cx('foo', shouldInclude && 'bar', 'baz')).toBe('foo baz');
        });

        it('filters null and undefined', () => {
            expect(cx('foo', null, undefined, 'bar')).toBe('foo bar');
        });

        it('returns empty string for no truthy values', () => {
            expect(cx(false, null, undefined)).toBe('');
        });
    });
});

describe('DOM Testing with happy-dom', () => {
    beforeEach(() => {
        // Ensure ready state for DOM tests
        vi.mocked(getApiStatus).mockReturnValue(createMockApiStatus());
    });

    it('can parse and query rendered HTML', () => {
        const html = renderApiStatus();

        // Create a container and set innerHTML
        const container = document.createElement('div');
        container.innerHTML = html;

        // Query the rendered DOM
        const statusDiv = container.querySelector('.cr-api-status');
        expect(statusDiv).not.toBeNull();
        expect(statusDiv?.classList.contains('cr-api-status--ready')).toBe(
            true,
        );

        const indicator = container.querySelector('.cr-api-status__indicator');
        expect(indicator).not.toBeNull();

        const icon = container.querySelector('.fa-circle-check');
        expect(icon).not.toBeNull();
    });

    it('can test event binding setup', () => {
        const html = `
            <button id="test-btn" class="cr-button">Click me</button>
        `;

        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container);

        const button = container.querySelector(
            '#test-btn',
        ) as HTMLButtonElement;
        expect(button).not.toBeNull();

        // Test that we can add event listeners
        let clicked = false;
        button.addEventListener('click', () => {
            clicked = true;
        });

        button.click();
        expect(clicked).toBe(true);

        // Cleanup
        document.body.removeChild(container);
    });
});
