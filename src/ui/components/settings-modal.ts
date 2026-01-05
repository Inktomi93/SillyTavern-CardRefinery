// src/ui/components/settings-modal.ts
// =============================================================================
// SETTINGS MODAL COMPONENT
// =============================================================================

import {
    MODULE_NAME,
    DISPLAY_NAME,
    VERSION,
    STAGE_LABELS,
    popup,
    toast,
    setDebugMode,
    getAvailableProfiles,
    getApiStatus,
    hasCMRS,
} from '../../shared';
import type { ProfileInfo, ApiStatus } from '../../shared';
import {
    getSettings,
    save,
    resetSettings,
    deletePromptPreset,
    deleteSchemaPreset,
    presetRegistry,
} from '../../data';
import { $, $$, on } from './base';
import {
    openDrawerForEdit,
    openDrawerForDuplicate,
    openDrawerForCreate,
} from './preset-drawer';
import type { PromptPreset, SchemaPreset } from '../../types';

// =============================================================================
// HTML TEMPLATES
// =============================================================================

/**
 * Render API status banner.
 */
function renderApiStatusBanner(status: ApiStatus): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const statusClass = status.isReady
        ? 'ct-api-banner--ready'
        : 'ct-api-banner--error';
    const icon = status.isReady ? 'fa-circle-check' : 'fa-circle-xmark';
    const typeLabel = status.apiType === 'cc' ? 'Chat' : 'Text';

    return `
        <div class="ct-api-banner ${statusClass}">
            <div class="ct-api-banner__left">
                <i class="fa-solid ${icon}"></i>
                <span class="ct-api-banner__name">${DOMPurify.sanitize(status.displayName)}</span>
                <span class="ct-badge ct-badge--small">${typeLabel}</span>
            </div>
            <div class="ct-api-banner__right">
                <span class="ct-api-banner__model" title="${DOMPurify.sanitize(status.model)}">${DOMPurify.sanitize(status.modelDisplay)}</span>
                <span class="ct-api-banner__limits">${status.maxOutput.toLocaleString()}t max</span>
            </div>
        </div>
        ${
            status.error
                ? `
            <div class="ct-api-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>${DOMPurify.sanitize(status.error)}</span>
            </div>
        `
                : ''
        }
    `;
}

/**
 * Render selected profile info card.
 */
function renderProfileInfo(profile: ProfileInfo | null): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;

    if (!profile) {
        return `
            <div class="ct-profile-info ct-profile-info--empty">
                <i class="fa-solid fa-circle-question"></i>
                <span>Select a profile above</span>
            </div>
        `;
    }

    const typeLabel = profile.mode === 'cc' ? 'Chat' : 'Text';

    return `
        <div class="ct-profile-info ${!profile.isSupported ? 'ct-profile-info--error' : ''}">
            <div class="ct-profile-info__row">
                <span class="ct-profile-info__label">API</span>
                <span class="ct-profile-info__value">${DOMPurify.sanitize(profile.api)}</span>
            </div>
            <div class="ct-profile-info__row">
                <span class="ct-profile-info__label">Model</span>
                <span class="ct-profile-info__value" title="${DOMPurify.sanitize(profile.model)}">${DOMPurify.sanitize(truncateModel(profile.model))}</span>
            </div>
            <div class="ct-profile-info__row">
                <span class="ct-profile-info__label">Type</span>
                <span class="ct-badge ct-badge--small">${typeLabel}</span>
            </div>
            ${
                profile.presetName
                    ? `
                <div class="ct-profile-info__row">
                    <span class="ct-profile-info__label">Preset</span>
                    <span class="ct-profile-info__value">${DOMPurify.sanitize(profile.presetName)}</span>
                </div>
            `
                    : ''
            }
            ${
                !profile.isSupported
                    ? `
                <div class="ct-profile-info__error">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>${profile.validationError || 'Profile configuration is invalid'}</span>
                </div>
            `
                    : ''
            }
        </div>
    `;
}

/**
 * Truncate model name for display.
 */
function truncateModel(model: string): string {
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

/**
 * Update the API status banner based on current selection.
 */
function updateApiStatusBanner(modal: HTMLElement, useProfile: boolean): void {
    const banner = $(`#${MODULE_NAME}_api_status_banner`, modal);
    if (!banner) return;

    let profileId: string | null = null;
    if (useProfile) {
        const profileSelect = $(
            `#${MODULE_NAME}_profile_select`,
            modal,
        ) as HTMLSelectElement | null;
        profileId = profileSelect?.value || null;
    }

    const status = getApiStatus(profileId);
    banner.innerHTML = renderApiStatusBanner(status);
}

function renderPresetItem(
    preset: PromptPreset | SchemaPreset,
    type: 'prompt' | 'schema',
): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const stagesText =
        preset.stages.length > 0
            ? preset.stages.map((s) => STAGE_LABELS[s]).join(', ')
            : 'All stages';

    const isBuiltin = preset.isBuiltin;

    return `
        <div class="ct-preset-item ${isBuiltin ? 'ct-preset-item--builtin' : ''}"
             data-id="${preset.id}"
             data-type="${type}">
            <div class="ct-preset-info">
                <span class="ct-preset-name">
                    ${DOMPurify.sanitize(preset.name)}
                    ${isBuiltin ? '<span class="ct-badge ct-badge--small">builtin</span>' : ''}
                </span>
                <span class="ct-preset-stages">${stagesText}</span>
            </div>
            <div class="ct-preset-actions">
                <button class="ct-preset-duplicate ct-btn ct-btn--icon menu_button"
                        type="button"
                        title="${isBuiltin ? 'Duplicate to create editable copy' : 'Duplicate preset'}">
                    <i class="fa-solid fa-copy"></i>
                </button>
                ${
                    !isBuiltin
                        ? `
                    <button class="ct-preset-edit ct-btn ct-btn--icon menu_button"
                            type="button"
                            title="Edit preset">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="ct-preset-delete ct-btn ct-btn--icon menu_button"
                            type="button"
                            title="Delete preset">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `
                        : ''
                }
            </div>
        </div>
    `;
}

/**
 * Render settings modal content.
 */
export function renderSettingsModal(): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const settings = getSettings();
    const profiles = getAvailableProfiles();
    const apiStatus = getApiStatus(
        settings.generationMode === 'profile' ? settings.profileId : null,
    );

    const promptPresets = settings.promptPresets;
    const schemaPresets = settings.schemaPresets;

    return `
        <div id="${MODULE_NAME}_settings_modal" class="ct-settings-modal">
            <div class="ct-settings-header">
                <h2>
                    <i class="fa-solid fa-cog"></i>
                    ${DISPLAY_NAME} Settings
                </h2>
            </div>

            <div class="ct-settings-body">
                <div class="ct-settings-columns">
                    <!-- Left Column: Generation Settings -->
                    <div class="ct-settings-column">
                        <section class="ct-settings-section">
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
                                    ? `
                                <div class="ct-gen-mode-toggle">
                                    <label class="ct-gen-mode-option ${settings.generationMode === 'current' ? 'ct-gen-mode-option--active' : ''}" data-mode="current">
                                        <input type="radio" name="${MODULE_NAME}_gen_mode" value="current" ${settings.generationMode === 'current' ? 'checked' : ''}>
                                        <i class="fa-solid fa-sliders"></i>
                                        <span>Current ST Settings</span>
                                    </label>
                                    <label class="ct-gen-mode-option ${settings.generationMode === 'profile' ? 'ct-gen-mode-option--active' : ''}" data-mode="profile">
                                        <input type="radio" name="${MODULE_NAME}_gen_mode" value="profile" ${settings.generationMode === 'profile' ? 'checked' : ''}>
                                        <i class="fa-solid fa-plug"></i>
                                        <span>Connection Profile</span>
                                    </label>
                                </div>

                                <!-- Profile Selection -->
                                <div id="${MODULE_NAME}_profile_section" class="ct-profile-section ${settings.generationMode === 'current' ? 'ct-hidden' : ''}">
                                    ${
                                        profiles.length > 0
                                            ? `
                                        <div class="ct-setting-item">
                                            <label class="ct-setting-label">Select Profile</label>
                                            <select id="${MODULE_NAME}_profile_select" class="ct-select text_pole">
                                                <option value="">-- Select a profile --</option>
                                                ${profiles
                                                    .map(
                                                        (p) => `
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
                                            : `
                                        <div class="ct-profile-empty">
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
                            <details class="ct-collapsible">
                                <summary>Response Length Override</summary>
                                <div class="ct-setting-item">
                                    <label class="ct-setting-label">
                                        <input type="checkbox"
                                               id="${MODULE_NAME}_max_tokens_enabled"
                                               ${settings.maxTokensOverride !== null ? 'checked' : ''} />
                                        <span>Override max response tokens</span>
                                    </label>
                                    <input type="number"
                                           id="${MODULE_NAME}_max_tokens"
                                           class="ct-number-input text_pole"
                                           value="${settings.maxTokensOverride ?? 4096}"
                                           min="100"
                                           max="32000"
                                           step="100"
                                           ${settings.maxTokensOverride === null ? 'disabled' : ''} />
                                    <span class="ct-setting-hint">
                                        Leave unchecked to use the profile's preset settings
                                    </span>
                                </div>
                            </details>
                        </section>

                        <!-- System Prompt -->
                        <section class="ct-settings-section">
                            <h3>
                                <i class="fa-solid fa-terminal"></i>
                                System Prompt
                            </h3>
                            <p class="ct-setting-desc">
                                The system prompt is sent with every generation. Your additions are appended after the base prompt.
                            </p>

                            <div class="ct-setting-item">
                                <label class="ct-setting-label">Your Additions</label>
                                <textarea id="${MODULE_NAME}_user_system_prompt"
                                          class="ct-textarea text_pole"
                                          rows="4"
                                          placeholder="Add custom instructions...">${DOMPurify.sanitize(settings.userSystemPrompt)}</textarea>
                            </div>

                            <details class="ct-collapsible">
                                <summary>Base Prompt (Read-only)</summary>
                                <pre class="ct-readonly-text">${DOMPurify.sanitize(settings.baseSystemPrompt)}</pre>
                            </details>
                        </section>

                        <!-- Refinement Prompt -->
                        <section class="ct-settings-section">
                            <h3>
                                <i class="fa-solid fa-rotate"></i>
                                Refinement Prompt
                            </h3>
                            <p class="ct-setting-desc">
                                Instructions for refinement iterations. Your additions are appended after the base.
                            </p>

                            <div class="ct-setting-item">
                                <label class="ct-setting-label">Your Additions</label>
                                <textarea id="${MODULE_NAME}_user_refinement_prompt"
                                          class="ct-textarea text_pole"
                                          rows="4"
                                          placeholder="Add custom refinement instructions...">${DOMPurify.sanitize(settings.userRefinementPrompt)}</textarea>
                            </div>

                            <details class="ct-collapsible">
                                <summary>Base Prompt (Read-only)</summary>
                                <pre class="ct-readonly-text">${DOMPurify.sanitize(settings.baseRefinementPrompt)}</pre>
                            </details>
                        </section>
                    </div>

                    <!-- Right Column: Presets & Debug -->
                    <div class="ct-settings-column">
                        <!-- Presets -->
                        <section class="ct-settings-section">
                            <h3>
                                <i class="fa-solid fa-bookmark"></i>
                                Presets
                            </h3>

                            <div class="ct-presets-tabs">
                                <button class="ct-presets-tab ct-presets-tab--active"
                                        data-tab="prompt"
                                        type="button">
                                    Prompt Presets
                                </button>
                                <button class="ct-presets-tab"
                                        data-tab="schema"
                                        type="button">
                                    Schema Presets
                                </button>
                            </div>

                            <div id="${MODULE_NAME}_presets_prompt" class="ct-presets-list">
                                ${promptPresets.map((p) => renderPresetItem(p, 'prompt')).join('')}
                            </div>

                            <div id="${MODULE_NAME}_presets_schema" class="ct-presets-list ct-hidden">
                                ${schemaPresets.map((p) => renderPresetItem(p, 'schema')).join('')}
                            </div>

                            <div class="ct-presets-actions">
                                <button id="${MODULE_NAME}_create_prompt_preset"
                                        class="ct-btn ct-btn--small menu_button menu_button--primary ct-create-preset-btn"
                                        data-type="prompt"
                                        type="button">
                                    <i class="fa-solid fa-plus"></i>
                                    New Prompt
                                </button>
                                <button id="${MODULE_NAME}_create_schema_preset"
                                        class="ct-btn ct-btn--small menu_button menu_button--primary ct-create-preset-btn ct-hidden"
                                        data-type="schema"
                                        type="button">
                                    <i class="fa-solid fa-plus"></i>
                                    New Schema
                                </button>
                            </div>
                            <div class="ct-presets-actions">
                                <button id="${MODULE_NAME}_export_presets"
                                        class="ct-btn ct-btn--small menu_button"
                                        type="button">
                                    <i class="fa-solid fa-file-export"></i>
                                    Export Custom
                                </button>
                                <button id="${MODULE_NAME}_import_presets"
                                        class="ct-btn ct-btn--small menu_button"
                                        type="button">
                                    <i class="fa-solid fa-file-import"></i>
                                    Import
                                </button>
                            </div>
                        </section>

                        <!-- Keyboard Shortcuts -->
                        <section class="ct-settings-section">
                            <h3>
                                <i class="fa-solid fa-keyboard"></i>
                                Keyboard Shortcuts
                            </h3>
                            <div class="ct-shortcuts-list">
                                <div class="ct-shortcut">
                                    <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
                                    <span>Run current stage</span>
                                </div>
                                <div class="ct-shortcut">
                                    <kbd>Escape</kbd>
                                    <span>Cancel generation</span>
                                </div>
                            </div>
                        </section>

                        <!-- Debug -->
                        <section class="ct-settings-section">
                            <h3>
                                <i class="fa-solid fa-bug"></i>
                                Debug
                            </h3>

                            <div class="ct-setting-item">
                                <label class="ct-setting-label">
                                    <input type="checkbox"
                                           id="${MODULE_NAME}_debug_mode"
                                           ${settings.debugMode ? 'checked' : ''} />
                                    <span>Enable debug logging</span>
                                </label>
                            </div>

                            <div class="ct-debug-actions">
                                <button id="${MODULE_NAME}_view_logs"
                                        class="ct-btn ct-btn--small menu_button"
                                        type="button">
                                    <i class="fa-solid fa-list"></i>
                                    View Logs
                                </button>
                                <button id="${MODULE_NAME}_reset_settings"
                                        class="ct-btn ct-btn--small ct-btn--danger menu_button"
                                        type="button">
                                    <i class="fa-solid fa-rotate-left"></i>
                                    Reset All
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            <div class="ct-settings-footer">
                <span class="ct-version">v${VERSION}</span>
                <button id="${MODULE_NAME}_settings_close"
                        class="ct-btn ct-btn--primary menu_button"
                        type="button">
                    <i class="fa-solid fa-check"></i>
                    Save & Close
                </button>
            </div>
        </div>
    `;
}

/**
 * Open settings modal.
 */
export async function openSettingsModal(): Promise<void> {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const context = SillyTavern.getContext();

    const content = renderSettingsModal();

    const popup = new context.Popup(
        DOMPurify.sanitize(content),
        context.POPUP_TYPE.TEXT,
        '',
        {
            wide: true,
            large: true,
            allowVerticalScrolling: true,
            okButton: false,
            cancelButton: false,
        },
    );

    popup.show();

    // Wait for DOM
    await new Promise((resolve) => setTimeout(resolve, 0));

    const modal = $(`#${MODULE_NAME}_settings_modal`);
    if (!modal) return;

    // Bind events
    const cleanup = bindSettingsModalEvents(modal);

    // Handle close
    const closeBtn = $(`#${MODULE_NAME}_settings_close`, modal);
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            saveSettings();
            cleanup();

            // Find and click popup close button
            const dialog = modal.closest('.popup');
            const popupCloseBtn = dialog?.querySelector(
                '.popup-button-cancel, .popup-button-ok',
            ) as HTMLElement;
            popupCloseBtn?.click();
        });
    }
}

/**
 * Save current settings from form.
 */
function saveSettings(): void {
    const settings = getSettings();

    // Generation mode
    const modeRadio = document.querySelector(
        `input[name="${MODULE_NAME}_gen_mode"]:checked`,
    ) as HTMLInputElement | null;
    if (modeRadio) {
        settings.generationMode = modeRadio.value as 'current' | 'profile';
    }

    // Profile selection
    const profileSelect = $(
        `#${MODULE_NAME}_profile_select`,
    ) as HTMLSelectElement | null;
    if (profileSelect) {
        settings.profileId = profileSelect.value || null;
    }

    // Max tokens override
    const maxTokensEnabled = $(
        `#${MODULE_NAME}_max_tokens_enabled`,
    ) as HTMLInputElement;
    const maxTokensInput = $(`#${MODULE_NAME}_max_tokens`) as HTMLInputElement;
    if (maxTokensEnabled && maxTokensInput) {
        settings.maxTokensOverride = maxTokensEnabled.checked
            ? parseInt(maxTokensInput.value, 10)
            : null;
    }

    // System prompt
    const userSystemPrompt = $(
        `#${MODULE_NAME}_user_system_prompt`,
    ) as HTMLTextAreaElement;
    if (userSystemPrompt) {
        settings.userSystemPrompt = userSystemPrompt.value;
    }

    // Refinement prompt
    const userRefinementPrompt = $(
        `#${MODULE_NAME}_user_refinement_prompt`,
    ) as HTMLTextAreaElement;
    if (userRefinementPrompt) {
        settings.userRefinementPrompt = userRefinementPrompt.value;
    }

    // Debug mode
    const debugMode = $(`#${MODULE_NAME}_debug_mode`) as HTMLInputElement;
    if (debugMode) {
        settings.debugMode = debugMode.checked;
        setDebugMode(debugMode.checked);
    }

    save();
    toast.success('Settings saved');
}

/**
 * Bind settings modal events.
 */
function bindSettingsModalEvents(modal: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];

    // Generation mode toggle
    const modeOptions = $$('.ct-gen-mode-option', modal);
    const profileSection = $(`#${MODULE_NAME}_profile_section`, modal);

    for (const option of modeOptions) {
        cleanups.push(
            on(option, 'click', () => {
                const mode = (option as HTMLElement).dataset.mode;

                // Update active styling
                modeOptions.forEach((o) =>
                    o.classList.remove('ct-gen-mode-option--active'),
                );
                option.classList.add('ct-gen-mode-option--active');

                // Show/hide profile section
                if (profileSection) {
                    profileSection.classList.toggle(
                        'ct-hidden',
                        mode === 'current',
                    );
                }

                // Update API status banner
                updateApiStatusBanner(modal, mode === 'profile');
            }),
        );
    }

    // Profile selection
    const profileSelect = $(
        `#${MODULE_NAME}_profile_select`,
        modal,
    ) as HTMLSelectElement | null;
    const profileInfoContainer = $(
        `#${MODULE_NAME}_profile_info_container`,
        modal,
    );

    if (profileSelect && profileInfoContainer) {
        cleanups.push(
            on(profileSelect, 'change', () => {
                const profiles = getAvailableProfiles();
                const selected = profiles.find(
                    (p) => p.id === profileSelect.value,
                );
                profileInfoContainer.innerHTML = renderProfileInfo(
                    selected || null,
                );

                // Update API status banner
                updateApiStatusBanner(modal, true);
            }),
        );
    }

    // Max tokens toggle
    const maxTokensEnabled = $(
        `#${MODULE_NAME}_max_tokens_enabled`,
        modal,
    ) as HTMLInputElement;
    const maxTokensInput = $(
        `#${MODULE_NAME}_max_tokens`,
        modal,
    ) as HTMLInputElement;
    if (maxTokensEnabled && maxTokensInput) {
        cleanups.push(
            on(maxTokensEnabled, 'change', () => {
                maxTokensInput.disabled = !maxTokensEnabled.checked;
            }),
        );
    }

    // Preset tabs
    const presetTabs = $$('.ct-presets-tab', modal);
    const promptList = $(`#${MODULE_NAME}_presets_prompt`, modal);
    const schemaList = $(`#${MODULE_NAME}_presets_schema`, modal);
    const createPromptBtn = $(`#${MODULE_NAME}_create_prompt_preset`, modal);
    const createSchemaBtn = $(`#${MODULE_NAME}_create_schema_preset`, modal);

    for (const tab of presetTabs) {
        cleanups.push(
            on(tab, 'click', () => {
                const tabType = (tab as HTMLElement).dataset.tab;

                // Update active tab
                presetTabs.forEach((t) =>
                    t.classList.remove('ct-presets-tab--active'),
                );
                tab.classList.add('ct-presets-tab--active');

                // Show/hide lists
                if (promptList && schemaList) {
                    promptList.classList.toggle(
                        'ct-hidden',
                        tabType !== 'prompt',
                    );
                    schemaList.classList.toggle(
                        'ct-hidden',
                        tabType !== 'schema',
                    );
                }

                // Show/hide create buttons
                if (createPromptBtn && createSchemaBtn) {
                    createPromptBtn.classList.toggle(
                        'ct-hidden',
                        tabType !== 'prompt',
                    );
                    createSchemaBtn.classList.toggle(
                        'ct-hidden',
                        tabType !== 'schema',
                    );
                }
            }),
        );
    }

    // Helper to refresh a preset list
    const refreshPresetList = (
        type: 'prompt' | 'schema',
        listEl: HTMLElement,
    ) => {
        const presets =
            type === 'prompt'
                ? presetRegistry.getPromptPresets()
                : presetRegistry.getSchemaPresets();

        listEl.innerHTML = presets
            .map((p) =>
                renderPresetItem(p as PromptPreset & SchemaPreset, type),
            )
            .join('');
    };

    // Create preset buttons
    if (createPromptBtn && promptList) {
        cleanups.push(
            on(createPromptBtn, 'click', () => {
                openDrawerForCreate('prompt', {
                    onSave: () => refreshPresetList('prompt', promptList),
                });
            }),
        );
    }

    if (createSchemaBtn && schemaList) {
        cleanups.push(
            on(createSchemaBtn, 'click', () => {
                openDrawerForCreate('schema', {
                    onSave: () => refreshPresetList('schema', schemaList),
                });
            }),
        );
    }

    // Preset action buttons (event delegation for edit, duplicate, delete)
    const handlePresetClick = async (
        e: Event,
        listType: 'prompt' | 'schema',
        listEl: HTMLElement,
    ) => {
        const target = e.target as HTMLElement;
        const item = target.closest('.ct-preset-item') as HTMLElement;
        if (!item) return;

        const id = item.dataset.id;
        if (!id) return;

        // Handle Edit - opens drawer
        if (target.closest('.ct-preset-edit')) {
            openDrawerForEdit(listType, id, {
                onSave: () => refreshPresetList(listType, listEl),
            });
            return;
        }

        // Handle Duplicate - opens drawer in duplicate mode
        if (target.closest('.ct-preset-duplicate')) {
            openDrawerForDuplicate(listType, id, {
                onSave: () => refreshPresetList(listType, listEl),
            });
            return;
        }

        // Handle Delete
        if (target.closest('.ct-preset-delete')) {
            const confirm = await popup.confirm(
                'Delete Preset',
                'Are you sure you want to delete this preset?',
            );
            if (!confirm) return;

            if (listType === 'prompt') {
                deletePromptPreset(id);
            } else {
                deleteSchemaPreset(id);
            }
            item.remove();
            toast.success('Preset deleted');
        }
    };

    if (promptList) {
        cleanups.push(
            on(promptList, 'click', (e) =>
                handlePresetClick(e, 'prompt', promptList),
            ),
        );
    }

    if (schemaList) {
        cleanups.push(
            on(schemaList, 'click', (e) =>
                handlePresetClick(e, 'schema', schemaList),
            ),
        );
    }

    // Export presets
    const exportBtn = $(`#${MODULE_NAME}_export_presets`, modal);
    if (exportBtn) {
        cleanups.push(
            on(exportBtn, 'click', () => {
                const settings = getSettings();
                const customPrompts = settings.promptPresets.filter(
                    (p) => !p.isBuiltin,
                );
                const customSchemas = settings.schemaPresets.filter(
                    (p) => !p.isBuiltin,
                );

                const data = {
                    version: VERSION,
                    promptPresets: customPrompts,
                    schemaPresets: customSchemas,
                };

                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json',
                });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = `${MODULE_NAME}_presets.json`;
                a.click();

                URL.revokeObjectURL(url);
                toast.success('Presets exported');
            }),
        );
    }

    // Import presets
    const importBtn = $(`#${MODULE_NAME}_import_presets`, modal);
    if (importBtn) {
        cleanups.push(
            on(importBtn, 'click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';

                input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;

                    try {
                        const text = await file.text();
                        const data = JSON.parse(text);

                        const settings = getSettings();
                        let importCount = 0;

                        if (Array.isArray(data.promptPresets)) {
                            for (const preset of data.promptPresets) {
                                if (!preset.isBuiltin) {
                                    preset.id = crypto.randomUUID(); // Generate new ID
                                    settings.promptPresets.push(preset);
                                    importCount++;
                                }
                            }
                        }

                        if (Array.isArray(data.schemaPresets)) {
                            for (const preset of data.schemaPresets) {
                                if (!preset.isBuiltin) {
                                    preset.id = crypto.randomUUID();
                                    settings.schemaPresets.push(preset);
                                    importCount++;
                                }
                            }
                        }

                        save();
                        toast.success(`Imported ${importCount} presets`);

                        // Refresh lists
                        if (promptList) {
                            promptList.innerHTML = settings.promptPresets
                                .map((p) => renderPresetItem(p, 'prompt'))
                                .join('');
                        }
                        if (schemaList) {
                            schemaList.innerHTML = settings.schemaPresets
                                .map((p) => renderPresetItem(p, 'schema'))
                                .join('');
                        }
                    } catch (error) {
                        toast.error('Failed to import presets');
                        console.error('Import error:', error);
                    }
                };

                input.click();
            }),
        );
    }

    // View logs
    const viewLogsBtn = $(`#${MODULE_NAME}_view_logs`, modal);
    if (viewLogsBtn) {
        cleanups.push(
            on(viewLogsBtn, 'click', () => {
                toast.info('Check browser console for logs');
            }),
        );
    }

    // Reset settings
    const resetBtn = $(`#${MODULE_NAME}_reset_settings`, modal);
    if (resetBtn) {
        cleanups.push(
            on(resetBtn, 'click', async () => {
                const confirm = await popup.confirm(
                    'Reset Settings',
                    'This will reset all settings to defaults. Custom presets will be kept. Continue?',
                );
                if (!confirm) return;

                resetSettings();
                toast.success('Settings reset to defaults');

                // Close and reopen to refresh
                const dialog = modal.closest('.popup');
                const closeBtn = dialog?.querySelector(
                    '.popup-button-cancel, .popup-button-ok',
                ) as HTMLElement;
                closeBtn?.click();

                // Reopen
                setTimeout(() => openSettingsModal(), 100);
            }),
        );
    }

    return () => {
        cleanups.forEach((fn) => fn());
    };
}
