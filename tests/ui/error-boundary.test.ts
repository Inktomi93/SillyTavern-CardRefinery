/**
 * Error Boundary Tests
 *
 * Tests for the error boundary utilities that provide graceful error handling
 * for UI components, preventing cascading failures.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock shared module
vi.mock('../../src/shared', () => ({
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

// Mock constants
vi.mock('../../src/shared/constants', () => ({
    CSS_PREFIX: 'cr',
}));

// Track debug mode state for tests
let mockDebugMode = false;

vi.mock('../../src/data/settings', () => ({
    getSettings: vi.fn(() => ({ debugMode: mockDebugMode })),
}));

import {
    withRenderBoundary,
    withUpdateBoundary,
    withEventBoundary,
    tryCatch,
    tryCatchAsync,
} from '../../src/ui/error-boundary';
import { log, toast } from '../../src/shared';

// =============================================================================
// TESTS
// =============================================================================

describe('Error Boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDebugMode = false;
    });

    // -------------------------------------------------------------------------
    // withRenderBoundary
    // -------------------------------------------------------------------------

    describe('withRenderBoundary', () => {
        it('returns render output when function succeeds', () => {
            const renderFn = () => '<div>Hello</div>';
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
            });

            const result = safeRender();

            expect(result).toBe('<div>Hello</div>');
            expect(log.error).not.toHaveBeenCalled();
        });

        it('passes arguments through to render function', () => {
            const renderFn = (name: string, count: number) =>
                `<div>${name}: ${count}</div>`;
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
            });

            const result = safeRender('Items', 5);

            expect(result).toBe('<div>Items: 5</div>');
        });

        it('returns fallback HTML when render throws', () => {
            const renderFn = () => {
                throw new Error('Render failed');
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'BrokenComponent',
            });

            const result = safeRender();

            expect(result).toContain('cr-error-fallback');
            expect(result).toContain('BrokenComponent');
        });

        it('logs error when render throws', () => {
            const error = new Error('Render failed');
            const renderFn = () => {
                throw error;
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
            });

            safeRender();

            expect(log.error).toHaveBeenCalledWith(
                '[TestComponent] Render failed:',
                error,
            );
        });

        it('calls onError callback when provided', () => {
            const onError = vi.fn();
            const error = new Error('Render failed');
            const renderFn = () => {
                throw error;
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
                onError,
            });

            safeRender();

            expect(onError).toHaveBeenCalledWith(error);
        });

        it('uses custom fallback string when provided', () => {
            const renderFn = () => {
                throw new Error('Render failed');
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
                fallback: '<div class="custom-fallback">Oops!</div>',
            });

            const result = safeRender();

            expect(result).toBe('<div class="custom-fallback">Oops!</div>');
        });

        it('uses custom fallback function when provided', () => {
            const error = new Error('Specific error');
            const renderFn = () => {
                throw error;
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
                fallback: (err) => `<div>Error: ${err.message}</div>`,
            });

            const result = safeRender();

            expect(result).toBe('<div>Error: Specific error</div>');
        });

        it('does not show toast by default for render errors', () => {
            const renderFn = () => {
                throw new Error('Render failed');
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
            });

            safeRender();

            expect(toast.error).not.toHaveBeenCalled();
        });

        it('shows toast when showToast is true', () => {
            mockDebugMode = false;
            const renderFn = () => {
                throw new Error('Render failed');
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
                showToast: true,
            });

            safeRender();

            expect(toast.error).toHaveBeenCalledWith('TestComponent failed');
        });

        it('shows detailed toast message in debug mode', () => {
            mockDebugMode = true;
            const renderFn = () => {
                throw new Error('Specific error message');
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
                showToast: true,
            });

            safeRender();

            expect(toast.error).toHaveBeenCalledWith(
                'TestComponent: Specific error message',
            );
        });

        describe('fallback UI content', () => {
            it('shows generic message in production mode', () => {
                mockDebugMode = false;
                const renderFn = () => {
                    throw new Error('Detailed error info');
                };
                const safeRender = withRenderBoundary(renderFn, {
                    name: 'TestComponent',
                });

                const result = safeRender();

                expect(result).toContain('Failed to render');
                expect(result).not.toContain('Detailed error info');
            });

            it('shows error message in debug mode', () => {
                mockDebugMode = true;
                const renderFn = () => {
                    throw new Error('Detailed error info');
                };
                const safeRender = withRenderBoundary(renderFn, {
                    name: 'TestComponent',
                });

                const result = safeRender();

                expect(result).toContain('Detailed error info');
            });

            it('shows stack trace in debug mode', () => {
                mockDebugMode = true;
                const error = new Error('Test error');
                error.stack = 'Error: Test error\n    at TestComponent.render';
                const renderFn = () => {
                    throw error;
                };
                const safeRender = withRenderBoundary(renderFn, {
                    name: 'TestComponent',
                });

                const result = safeRender();

                expect(result).toContain('<details');
                expect(result).toContain('Stack trace');
                expect(result).toContain(error.stack);
            });
        });

        it('handles non-Error thrown values', () => {
            const renderFn = () => {
                throw 'string error';
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
            });

            const result = safeRender();

            expect(result).toContain('cr-error-fallback');
            expect(log.error).toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // withUpdateBoundary
    // -------------------------------------------------------------------------

    describe('withUpdateBoundary', () => {
        it('executes update function normally when it succeeds', () => {
            const updateFn = vi.fn();
            const safeUpdate = withUpdateBoundary(updateFn, {
                name: 'TestComponent',
            });

            safeUpdate();

            expect(updateFn).toHaveBeenCalled();
            expect(log.error).not.toHaveBeenCalled();
        });

        it('passes arguments through to update function', () => {
            const updateFn = vi.fn();
            const safeUpdate = withUpdateBoundary(updateFn, {
                name: 'TestComponent',
            });

            safeUpdate('arg1', 42);

            expect(updateFn).toHaveBeenCalledWith('arg1', 42);
        });

        it('catches and logs errors without rethrowing', () => {
            const error = new Error('Update failed');
            const updateFn = () => {
                throw error;
            };
            const safeUpdate = withUpdateBoundary(updateFn, {
                name: 'TestComponent',
            });

            // Should not throw
            expect(() => safeUpdate()).not.toThrow();
            expect(log.error).toHaveBeenCalledWith(
                '[TestComponent] Update failed:',
                error,
            );
        });

        it('calls onError callback when provided', () => {
            const onError = vi.fn();
            const error = new Error('Update failed');
            const updateFn = () => {
                throw error;
            };
            const safeUpdate = withUpdateBoundary(updateFn, {
                name: 'TestComponent',
                onError,
            });

            safeUpdate();

            expect(onError).toHaveBeenCalledWith(error);
        });

        it('does not show toast by default', () => {
            const updateFn = () => {
                throw new Error('Update failed');
            };
            const safeUpdate = withUpdateBoundary(updateFn, {
                name: 'TestComponent',
            });

            safeUpdate();

            expect(toast.error).not.toHaveBeenCalled();
        });

        it('shows toast when showToast is true', () => {
            const updateFn = () => {
                throw new Error('Update failed');
            };
            const safeUpdate = withUpdateBoundary(updateFn, {
                name: 'TestComponent',
                showToast: true,
            });

            safeUpdate();

            expect(toast.error).toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // withEventBoundary
    // -------------------------------------------------------------------------

    describe('withEventBoundary', () => {
        it('executes bind function and returns its cleanup', () => {
            const cleanup = vi.fn();
            const bindFn = vi.fn(() => cleanup);
            const safeBind = withEventBoundary(bindFn, {
                name: 'TestComponent',
            });
            const container = document.createElement('div');

            const returnedCleanup = safeBind(container);

            expect(bindFn).toHaveBeenCalledWith(container);
            expect(returnedCleanup).toBe(cleanup);
        });

        it('returns no-op cleanup when bind throws', () => {
            const bindFn = () => {
                throw new Error('Bind failed');
            };
            const safeBind = withEventBoundary(bindFn, {
                name: 'TestComponent',
            });
            const container = document.createElement('div');

            const cleanup = safeBind(container);

            expect(typeof cleanup).toBe('function');
            // Should not throw when called
            expect(() => cleanup()).not.toThrow();
        });

        it('logs error when bind throws', () => {
            const error = new Error('Bind failed');
            const bindFn = () => {
                throw error;
            };
            const safeBind = withEventBoundary(bindFn, {
                name: 'TestComponent',
            });
            const container = document.createElement('div');

            safeBind(container);

            expect(log.error).toHaveBeenCalledWith(
                '[TestComponent] Event binding failed:',
                error,
            );
        });

        it('shows toast by default for event binding errors', () => {
            mockDebugMode = false;
            const bindFn = () => {
                throw new Error('Bind failed');
            };
            const safeBind = withEventBoundary(bindFn, {
                name: 'TestComponent',
            });
            const container = document.createElement('div');

            safeBind(container);

            expect(toast.error).toHaveBeenCalledWith('TestComponent failed');
        });

        it('can suppress toast with showToast: false', () => {
            const bindFn = () => {
                throw new Error('Bind failed');
            };
            const safeBind = withEventBoundary(bindFn, {
                name: 'TestComponent',
                showToast: false,
            });
            const container = document.createElement('div');

            safeBind(container);

            expect(toast.error).not.toHaveBeenCalled();
        });

        it('calls onError callback when provided', () => {
            const onError = vi.fn();
            const error = new Error('Bind failed');
            const bindFn = () => {
                throw error;
            };
            const safeBind = withEventBoundary(bindFn, {
                name: 'TestComponent',
                onError,
            });
            const container = document.createElement('div');

            safeBind(container);

            expect(onError).toHaveBeenCalledWith(error);
        });
    });

    // -------------------------------------------------------------------------
    // tryCatch
    // -------------------------------------------------------------------------

    describe('tryCatch', () => {
        it('returns function result on success', () => {
            const result = tryCatch(() => 42, { name: 'TestOp' });

            expect(result).toBe(42);
        });

        it('returns undefined on error', () => {
            const result = tryCatch(
                () => {
                    throw new Error('Failed');
                },
                { name: 'TestOp' },
            );

            expect(result).toBeUndefined();
        });

        it('logs error on failure', () => {
            const error = new Error('Operation failed');

            tryCatch(
                () => {
                    throw error;
                },
                { name: 'TestOp' },
            );

            expect(log.error).toHaveBeenCalledWith('[TestOp] Failed:', error);
        });

        it('calls onError callback', () => {
            const onError = vi.fn();
            const error = new Error('Failed');

            tryCatch(
                () => {
                    throw error;
                },
                { name: 'TestOp', onError },
            );

            expect(onError).toHaveBeenCalledWith(error);
        });

        it('shows toast when showToast is true', () => {
            mockDebugMode = false;

            tryCatch(
                () => {
                    throw new Error('Failed');
                },
                { name: 'TestOp', showToast: true },
            );

            expect(toast.error).toHaveBeenCalledWith('TestOp failed');
        });

        it('shows detailed toast in debug mode', () => {
            mockDebugMode = true;

            tryCatch(
                () => {
                    throw new Error('Specific message');
                },
                { name: 'TestOp', showToast: true },
            );

            expect(toast.error).toHaveBeenCalledWith(
                'TestOp: Specific message',
            );
        });

        it('does not show toast by default', () => {
            tryCatch(
                () => {
                    throw new Error('Failed');
                },
                { name: 'TestOp' },
            );

            expect(toast.error).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // tryCatchAsync
    // -------------------------------------------------------------------------

    describe('tryCatchAsync', () => {
        it('returns async function result on success', async () => {
            const result = await tryCatchAsync(
                async () => {
                    return 42;
                },
                { name: 'TestOp' },
            );

            expect(result).toBe(42);
        });

        it('returns undefined on async error', async () => {
            const result = await tryCatchAsync(
                async () => {
                    throw new Error('Async failed');
                },
                { name: 'TestOp' },
            );

            expect(result).toBeUndefined();
        });

        it('logs error on async failure', async () => {
            const error = new Error('Async failed');

            await tryCatchAsync(
                async () => {
                    throw error;
                },
                { name: 'TestOp' },
            );

            expect(log.error).toHaveBeenCalledWith('[TestOp] Failed:', error);
        });

        it('handles rejected promises', async () => {
            const error = new Error('Promise rejected');

            const result = await tryCatchAsync(() => Promise.reject(error), {
                name: 'TestOp',
            });

            expect(result).toBeUndefined();
            expect(log.error).toHaveBeenCalledWith('[TestOp] Failed:', error);
        });

        it('calls onError callback for async errors', async () => {
            const onError = vi.fn();
            const error = new Error('Async failed');

            await tryCatchAsync(
                async () => {
                    throw error;
                },
                { name: 'TestOp', onError },
            );

            expect(onError).toHaveBeenCalledWith(error);
        });

        it('shows toast for async errors when enabled', async () => {
            mockDebugMode = false;

            await tryCatchAsync(
                async () => {
                    throw new Error('Async failed');
                },
                { name: 'TestOp', showToast: true },
            );

            expect(toast.error).toHaveBeenCalledWith('TestOp failed');
        });
    });

    // -------------------------------------------------------------------------
    // Edge Cases
    // -------------------------------------------------------------------------

    describe('Edge Cases', () => {
        it('handles null error message', () => {
            mockDebugMode = true;
            const error = new Error();
            error.message = '';
            const renderFn = () => {
                throw error;
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
            });

            const result = safeRender();

            expect(result).toContain('Unknown error');
        });

        it('handles error without stack in debug mode', () => {
            mockDebugMode = true;
            const error = new Error('No stack');
            delete error.stack;
            const renderFn = () => {
                throw error;
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
            });

            const result = safeRender();

            expect(result).not.toContain('<details');
        });

        it('handles getSettings throwing (settings not loaded)', async () => {
            // This tests the isDebugMode() safety wrapper
            const settings = await import('../../src/data/settings');
            const { getSettings } = vi.mocked(settings);
            getSettings.mockImplementationOnce(() => {
                throw new Error('Settings not loaded');
            });

            const renderFn = () => {
                throw new Error('Render failed');
            };
            const safeRender = withRenderBoundary(renderFn, {
                name: 'TestComponent',
                showToast: true,
            });

            // Should not throw, should use non-debug fallback
            expect(() => safeRender()).not.toThrow();
            // Should use production message (debug mode defaults to false)
            expect(toast.error).toHaveBeenCalledWith('TestComponent failed');
        });

        it('preserves function type signature', () => {
            const typedFn = (a: string, b: number): string => `${a}-${b}`;
            const safeFn = withRenderBoundary(typedFn, {
                name: 'TypedComponent',
            });

            // TypeScript would catch type mismatches at compile time
            const result = safeFn('test', 123);
            expect(result).toBe('test-123');
        });
    });
});
