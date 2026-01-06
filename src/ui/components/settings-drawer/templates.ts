// src/ui/components/settings-drawer/templates.ts
// =============================================================================
// HTML TEMPLATES
// =============================================================================

import {
    MODULE_NAME,
    DISPLAY_NAME,
    VERSION,
    getAvailableProfiles,
    getApiStatus,
    hasCMRS,
} from '../../../shared';
import type { ProfileInfo, ApiStatus } from '../../../shared';
import { getSettings } from '../../../data';
import { withRenderBoundary } from '../../error-boundary';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Truncate model name for display.
 */
export function truncateModel(model: string): string {
    const stripped = model
        .replace(/^anthropic\//, '')
        .replace(/^openai\//, '')
        .replace(/^google\//, '')
        .replace(/^meta-llama\//, 'llama-')
        .replace(/^mistralai\//, 'mistral-');

    if (stripped.length > 30) {
        return stripped.substring(0, 27) + '...';
    }
    return stripped;
}

// =============================================================================
// TEMPLATE FUNCTIONS
// =============================================================================

/**
 * Render API status banner.
 */
const _renderApiStatusBanner = (status: ApiStatus): string => {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const settings = getSettings();
    const statusClass = status.isReady
        ? 'cr-api-banner--ready'
        : 'cr-api-banner--error';
    const icon = status.isReady ? 'fa-circle-check' : 'fa-circle-xmark';
    const typeLabel = status.apiType === 'cc' ? 'Chat' : 'Text';

    // Show override value if set, otherwise show API max
    const hasOverride = settings.maxTokensOverride !== null;
    const displayMaxOutput = hasOverride
        ? settings.maxTokensOverride!
        : status.maxOutput;
    const overrideIndicator = hasOverride
        ? '<i class="fa-solid fa-pen cr-api-banner__override-icon" title="Custom output limit active"></i>'
        : '';

    return /* html */ `
        <div class="cr-api-banner ${statusClass}">
            <div class="cr-api-banner__left">
                <i class="fa-solid ${icon}"></i>
                <span class="cr-api-banner__name">${DOMPurify.sanitize(status.displayName)}</span>
                <span class="cr-badge cr-badge--small">${typeLabel}</span>
            </div>
            <div class="cr-api-banner__right">
                <span class="cr-api-banner__model" title="${DOMPurify.sanitize(status.model)}">${DOMPurify.sanitize(status.modelDisplay)}</span>
                <span class="cr-api-banner__limits ${hasOverride ? 'cr-api-banner__limits--override' : ''}">${overrideIndicator}${displayMaxOutput.toLocaleString()}t max</span>
            </div>
        </div>
        ${
            status.error
                ? /* html */ `
            <div class="cr-api-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>${DOMPurify.sanitize(status.error)}</span>
            </div>
        `
                : ''
        }
    `;
};
export const renderApiStatusBanner = withRenderBoundary(
    _renderApiStatusBanner,
    {
        name: 'SettingsApiStatusBanner',
    },
);

/**
 * Render selected profile info card.
 */
const _renderProfileInfo = (profile: ProfileInfo | null): string => {
    const DOMPurify = SillyTavern.libs.DOMPurify;

    if (!profile) {
        return /* html */ `
            <div class="cr-profile-info cr-profile-info--empty">
                <i class="fa-solid fa-circle-question"></i>
                <span>Select a profile above</span>
            </div>
        `;
    }

    const typeLabel = profile.mode === 'cc' ? 'Chat' : 'Text';

    return /* html */ `
        <div class="cr-profile-info ${!profile.isSupported ? 'cr-profile-info--error' : ''}">
            <div class="cr-profile-info__row">
                <span class="cr-profile-info__label">API</span>
                <span class="cr-profile-info__value">${DOMPurify.sanitize(profile.api)}</span>
            </div>
            <div class="cr-profile-info__row">
                <span class="cr-profile-info__label">Model</span>
                <span class="cr-profile-info__value" title="${DOMPurify.sanitize(profile.model)}">${DOMPurify.sanitize(truncateModel(profile.model))}</span>
            </div>
            <div class="cr-profile-info__row">
                <span class="cr-profile-info__label">Type</span>
                <span class="cr-badge cr-badge--small">${typeLabel}</span>
            </div>
            ${
                profile.presetName
                    ? /* html */ `
                <div class="cr-profile-info__row">
                    <span class="cr-profile-info__label">Preset</span>
                    <span class="cr-profile-info__value">${DOMPurify.sanitize(profile.presetName)}</span>
                </div>
            `
                    : ''
            }
            ${
                !profile.isSupported
                    ? /* html */ `
                <div class="cr-profile-info__error">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>${profile.validationError || 'Profile configuration is invalid'}</span>
                </div>
            `
                    : ''
            }
        </div>
    `;
};
export const renderProfileInfo = withRenderBoundary(_renderProfileInfo, {
    name: 'SettingsProfileInfo',
});

/**
 * Render the drawer header.
 */
const _renderDrawerHeader = (): string => {
    return /* html */ `
        <header class="cr-drawer__header">
            <div class="cr-drawer__title">
                <i class="fa-solid fa-cog"></i>
                <h3>${DISPLAY_NAME} Settings</h3>
            </div>
            <button id="${MODULE_NAME}_settings_close"
                    class="cr-btn cr-btn--icon cr-btn--ghost menu_button"
                    type="button"
                    title="Close settings">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </header>
    `;
};
export const renderDrawerHeader = withRenderBoundary(_renderDrawerHeader, {
    name: 'SettingsDrawerHeader',
});

/**
 * Render the drawer body with settings sections.
 */
const _renderDrawerBody = (): string => {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const settings = getSettings();
    const profiles = getAvailableProfiles();
    const apiStatus = getApiStatus(
        settings.generationMode === 'profile' ? settings.profileId : null,
    );

    // Fallback to 'current' mode if no profiles available
    const effectiveMode =
        settings.generationMode === 'profile' && profiles.length === 0
            ? 'current'
            : settings.generationMode;

    return /* html */ `
        <div class="cr-drawer__body">
            <!-- Generation Settings -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-sliders"></i>
                    Generation
                </h3>

                <!-- Current API Status -->
                <div id="${MODULE_NAME}_api_status_banner">
                    ${renderApiStatusBanner(apiStatus)}
                </div>

                <!-- Mode Toggle -->
                ${
                    hasCMRS()
                        ? /* html */ `
                <div class="cr-gen-mode-toggle">
                    <label class="cr-gen-mode-option ${effectiveMode === 'current' ? 'cr-gen-mode-option--active' : ''}" data-mode="current">
                        <input type="radio" name="${MODULE_NAME}_gen_mode" value="current" ${effectiveMode === 'current' ? 'checked' : ''}/>
                        <i class="fa-solid fa-sliders"></i>
                        <span>Current ST Settings</span>
                    </label>
                    <label class="cr-gen-mode-option ${effectiveMode === 'profile' ? 'cr-gen-mode-option--active' : ''}" data-mode="profile">
                        <input type="radio" name="${MODULE_NAME}_gen_mode" value="profile" ${effectiveMode === 'profile' ? 'checked' : ''}/>
                        <i class="fa-solid fa-plug"></i>
                        <span>Connection Profile</span>
                    </label>
                </div>

                <!-- Profile Selection -->
                <div id="${MODULE_NAME}_profile_section" class="cr-profile-section ${effectiveMode === 'current' ? 'cr-hidden' : ''}">
                    ${
                        profiles.length > 0
                            ? /* html */ `
                    <div class="cr-setting-item">
                        <label class="cr-setting-label">Select Profile</label>
                        <select id="${MODULE_NAME}_profile_select" class="cr-select text_pole">
                            <option value="">-- Select a profile --</option>
                            ${profiles
                                .map(
                                    (p) => /* html */ `
                            <option value="${p.id}"
                                    ${p.id === settings.profileId ? 'selected' : ''}
                                    ${!p.isSupported ? 'disabled' : ''}>
                                ${DOMPurify.sanitize(p.name)}${!p.isSupported ? ' (invalid)' : ''}
                            </option>
                            `,
                                )
                                .join('')}
                        </select>
                    </div>
                    <div id="${MODULE_NAME}_profile_info_container">
                        ${renderProfileInfo(profiles.find((p) => p.id === settings.profileId) || null)}
                    </div>
                    `
                            : /* html */ `
                    <div class="cr-profile-empty">
                        <i class="fa-solid fa-info-circle"></i>
                        <div>
                            <strong>No connection profiles found</strong>
                            <p>Create profiles in SillyTavern's Connection Manager to use specific API configurations.</p>
                        </div>
                    </div>
                    `
                    }
                </div>
                `
                        : ''
                }

                <!-- Max Tokens Override -->
                <details class="cr-collapsible">
                    <summary>Response Length Override</summary>
                    <div class="cr-setting-item">
                        <label class="cr-setting-label">
                            <input type="checkbox"
                                   id="${MODULE_NAME}_max_tokens_enabled"
                                   ${settings.maxTokensOverride !== null ? 'checked' : ''}/>
                            <span>Override max response tokens</span>
                        </label>
                        <input type="number"
                               id="${MODULE_NAME}_max_tokens"
                               class="cr-number-input text_pole"
                               value="${settings.maxTokensOverride ?? 4096}"
                               min="100"
                               max="32000"
                               step="100"
                               ${settings.maxTokensOverride === null ? 'disabled' : ''}/>
                        <span class="cr-setting-hint">
                            Leave unchecked to use the profile's preset settings
                        </span>
                    </div>
                </details>
            </section>

            <!-- System Prompt -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-terminal"></i>
                    System Prompt
                </h3>
                <p class="cr-setting-desc">
                    The system prompt is sent with every generation. Your additions are appended after the base prompt.
                </p>

                <div class="cr-setting-item">
                    <label class="cr-setting-label">Your Additions</label>
                    <textarea id="${MODULE_NAME}_user_system_prompt"
                              class="cr-textarea text_pole"
                              rows="4"
                              placeholder="Add custom instructions...">${DOMPurify.sanitize(settings.userSystemPrompt)}</textarea>
                </div>

                <details class="cr-collapsible">
                    <summary>Base Prompt</summary>
                    <div class="cr-collapsible__content">
                        <div class="cr-warning-banner">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>Editing the base prompt may affect results. Use "Revert" to restore defaults.</span>
                        </div>
                        <textarea id="${MODULE_NAME}_base_system_prompt"
                                  class="cr-textarea cr-textarea--compact text_pole"
                                  rows="4">${DOMPurify.sanitize(settings.baseSystemPrompt)}</textarea>
                        <button id="${MODULE_NAME}_revert_system_prompt"
                                class="cr-btn cr-btn--small menu_button cr-mt-2"
                                type="button">
                            <i class="fa-solid fa-rotate-left"></i>
                            Revert to Default
                        </button>
                    </div>
                </details>
            </section>

            <!-- Refinement Prompt -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-rotate"></i>
                    Refinement Prompt
                </h3>
                <p class="cr-setting-desc">
                    Instructions for refinement iterations. Your additions are appended after the base.
                </p>

                <div class="cr-setting-item">
                    <label class="cr-setting-label">Your Additions</label>
                    <textarea id="${MODULE_NAME}_user_refinement_prompt"
                              class="cr-textarea text_pole"
                              rows="4"
                              placeholder="Add custom refinement instructions...">${DOMPurify.sanitize(settings.userRefinementPrompt)}</textarea>
                </div>

                <details class="cr-collapsible">
                    <summary>Base Prompt</summary>
                    <div class="cr-collapsible__content">
                        <div class="cr-warning-banner">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>Editing the base prompt may affect results. Use "Revert" to restore defaults.</span>
                        </div>
                        <textarea id="${MODULE_NAME}_base_refinement_prompt"
                                  class="cr-textarea cr-textarea--compact text_pole"
                                  rows="4">${DOMPurify.sanitize(settings.baseRefinementPrompt)}</textarea>
                        <button id="${MODULE_NAME}_revert_refinement_prompt"
                                class="cr-btn cr-btn--small menu_button cr-mt-2"
                                type="button">
                            <i class="fa-solid fa-rotate-left"></i>
                            Revert to Default
                        </button>
                    </div>
                </details>
            </section>

            <!-- Reset Settings -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-rotate-left"></i>
                    Reset
                </h3>
                <button id="${MODULE_NAME}_reset_settings"
                        class="cr-btn cr-btn--small cr-btn--danger menu_button"
                        type="button">
                    <i class="fa-solid fa-rotate-left"></i>
                    Reset All Settings
                </button>
            </section>

            <!-- Data Management -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-database"></i>
                    Data Management
                </h3>
                <div class="cr-danger-zone">
                    <div class="cr-danger-zone__warning">
                        <i class="fa-solid fa-skull-crossbones"></i>
                        <div>
                            <strong>Danger Zone</strong>
                            <p>These actions are destructive and cannot be undone.</p>
                        </div>
                    </div>
                    <button id="${MODULE_NAME}_purge_all_sessions"
                            class="menu_button menu_button--danger"
                            type="button">
                        <i class="fa-solid fa-trash"></i>
                        Delete All Sessions (All Characters)
                    </button>
                </div>
            </section>

            <!-- Keyboard Shortcuts -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-keyboard"></i>
                    Keyboard Shortcuts
                </h3>
                <div class="cr-shortcuts-list">
                    <div class="cr-shortcut">
                        <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
                        <span>Run current stage</span>
                    </div>
                    <div class="cr-shortcut">
                        <kbd>Escape</kbd>
                        <span>Cancel generation</span>
                    </div>
                </div>
            </section>
        </div>
    `;
};
export const renderDrawerBody = withRenderBoundary(_renderDrawerBody, {
    name: 'SettingsDrawerBody',
});

/**
 * Render the drawer footer.
 */
const _renderDrawerFooter = (): string => {
    return /* html */ `
        <footer class="cr-drawer__footer cr-drawer__footer--spaced">
            <span class="cr-version">v${VERSION}</span>
            <button id="${MODULE_NAME}_settings_save"
                    class="cr-btn cr-btn--primary menu_button"
                    type="button">
                <i class="fa-solid fa-check"></i>
                Save & Close
            </button>
        </footer>
    `;
};
export const renderDrawerFooter = withRenderBoundary(_renderDrawerFooter, {
    name: 'SettingsDrawerFooter',
});

/**
 * Render the complete drawer container.
 */
const _renderDrawer = (): string => {
    return /* html */ `
        <div id="${MODULE_NAME}_settings_drawer" class="cr-drawer" aria-hidden="true">
            <div class="cr-drawer__backdrop"></div>
            <aside class="cr-drawer__panel" role="dialog" aria-label="${DISPLAY_NAME} Settings">
                <div class="cr-drawer__content">
                    ${renderDrawerHeader()}
                    ${renderDrawerBody()}
                    ${renderDrawerFooter()}
                </div>
            </aside>
        </div>
    `;
};
export const renderDrawer = withRenderBoundary(_renderDrawer, {
    name: 'SettingsDrawer',
});
