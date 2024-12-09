// src/ui/components/Settings/index.js
class Settings {
    constructor(settingsFeature, stateManager, translationManager, container) {
        this.settingsFeature = settingsFeature;
        this.state = stateManager;
        this.translator = translationManager;
        this.container = container;
        
        // Initialize DOM references
        this.elements = {
            sections: new Map(),
            inputs: new Map(),
            saveButton: null,
            resetButton: null,
            exportButton: null,
            importButton: null,
            importInput: null,
            errorMessage: null,
            unsavedChangesAlert: null
        };

        // Initialize component
        this.initialize();
    }

    initialize() {
        // Create base structure
        this.container.innerHTML = this.createSettingsHTML();
        
        // Cache element references
        this.cacheElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Subscribe to state changes
        this.setupStateSubscriptions();

        // Load initial settings
        this.loadSettings();
    }

    createSettingsHTML() {
        return `
            <div class="settings-container">
                <div class="settings-header">
                    <h2 data-i18n="settings">Settings</h2>
                    <div class="settings-actions">
                        <button class="save-button" data-i18n="save">Save</button>
                        <button class="reset-button" data-i18n="reset">Reset</button>
                    </div>
                </div>

                <div class="settings-error hidden"></div>

                <div class="settings-content">
                    <!-- General Settings -->
                    <section id="generalSettings" class="settings-section">
                        <h3 data-i18n="generalSettings">General Settings</h3>
                        <div class="setting-group">
                            <label for="language" data-i18n="language">Language</label>
                            <select id="language" name="general.language">
                                <option value="en">English</option>
                                <option value="es">Español</option>
                                <option value="se">Svenska</option>
                                <option value="eu">Euskara</option>
                                <option value="fr">Française</option>
                                <option value="de">Deutsch</option>
                                <option value="ja">日本語</option>
                            </select>
                        </div>

                        <div class="setting-group">
                            <label for="startPage" data-i18n="startPage">Start Page</label>
                            <select id="startPage" name="general.startPage">
                                <option value="timer" data-i18n="timer">Timer</option>
                                <option value="projects" data-i18n="projects">Projects</option>
                                <option value="reports" data-i18n="reports">Reports</option>
                            </select>
                        </div>
                    </section>

                    <!-- Timer Settings -->
                    <section id="timerSettings" class="settings-section">
                        <h3 data-i18n="timerSettings">Timer Settings</h3>
                        <div class="setting-group">
                            <label class="checkbox-label">
                                <input type="checkbox" name="timer.showSeconds">
                                <span data-i18n="showSeconds">Show Seconds</span>
                            </label>
                        </div>

                        <div class="setting-group">
                            <label for="roundTimeTo" data-i18n="roundTimeTo">Round Time To</label>
                            <select id="roundTimeTo" name="timer.roundTimeTo">
                                <option value="0" data-i18n="noRounding">No Rounding</option>
                                <option value="5">5 min</option>
                                <option value="15">15 min</option>
                                <option value="30">30 min</option>
                            </select>
                        </div>
                    </section>

                    <!-- Time Entries Settings -->
                    <section id="timeEntriesSettings" class="settings-section">
                        <h3 data-i18n="timeEntriesSettings">Time Entries Settings</h3>
                        <div class="setting-group">
                            <label for="entriesPerPage" data-i18n="entriesPerPage">Entries Per Page</label>
                            <select id="entriesPerPage" name="timeEntries.entriesPerPage">
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="20">20</option>
                                <option value="30">30</option>
                            </select>
                        </div>

                        <div class="setting-group">
                            <label for="defaultSortOrder" data-i18n="defaultSortOrder">Default Sort Order</label>
                            <select id="defaultSortOrder" name="timeEntries.defaultSortOrder">
                                <option value="newest" data-i18n="newest">Newest First</option>
                                <option value="oldest" data-i18n="oldest">Oldest First</option>
                            </select>
                        </div>
                    </section>

                    <!-- Import/Export -->
                    <section id="dataManagement" class="settings-section">
                        <h3 data-i18n="dataManagement">Data Management</h3>
                        <div class="setting-actions">
                            <button class="export-button" data-i18n="exportSettings">Export Settings</button>
                            <div class="import-container">
                                <input type="file" id="importFile" accept=".json" class="hidden">
                                <button class="import-button" data-i18n="importSettings">Import Settings</button>
                            </div>
                        </div>
                    </section>
                </div>

                <div class="unsaved-changes-alert hidden">
                    <span data-i18n="unsavedChanges">You have unsaved changes</span>
                    <div class="alert-actions">
                        <button class="save-button" data-i18n="save">Save</button>
                        <button class="cancel-button" data-i18n="cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }

    cacheElements() {
        // Cache section elements
        this.elements.sections = new Map([
            ['general', this.container.querySelector('#generalSettings')],
            ['timer', this.container.querySelector('#timerSettings')],
            ['timeEntries', this.container.querySelector('#timeEntriesSettings')],
            ['data', this.container.querySelector('#dataManagement')]
        ]);

        // Cache form inputs
        this.container.querySelectorAll('input, select').forEach(input => {
            this.elements.inputs.set(input.name, input);
        });

        // Cache action buttons
        this.elements.saveButton = this.container.querySelector('.settings-actions .save-button');
        this.elements.resetButton = this.container.querySelector('.settings-actions .reset-button');
        this.elements.exportButton = this.container.querySelector('.export-button');
        this.elements.importButton = this.container.querySelector('.import-button');
        this.elements.importInput = this.container.querySelector('#importFile');

        // Cache message elements
        this.elements.errorMessage = this.container.querySelector('.settings-error');
        this.elements.unsavedChangesAlert = this.container.querySelector('.unsaved-changes-alert');
    }

    setupEventListeners() {
        // Save button
        this.elements.saveButton.addEventListener('click', () => this.saveSettings());

        // Reset button
        this.elements.resetButton.addEventListener('click', () => this.resetSettings());

        // Export button
        this.elements.exportButton.addEventListener('click', () => this.exportSettings());

        // Import button and file input
        this.elements.importButton.addEventListener('click', () => {
            this.elements.importInput.click();
        });

        this.elements.importInput.addEventListener('change', (e) => {
            this.importSettings(e.target.files[0]);
        });

        // Input change handlers
        this.elements.inputs.forEach((input, name) => {
            input.addEventListener('change', () => this.handleSettingChange(name, this.getInputValue(input)));
        });

        // Unsaved changes alert
        const alertActions = this.elements.unsavedChangesAlert.querySelector('.alert-actions');
        alertActions.querySelector('.save-button').addEventListener('click', () => this.saveSettings());
        alertActions.querySelector('.cancel-button').addEventListener('click', () => this.loadSettings());
    }

    setupStateSubscriptions() {
        // Subscribe to settings changes
        this.state.subscribe('settings.current', settings => {
            this.updateInputValues(settings);
        });

        // Subscribe to unsaved changes
        this.state.subscribe('settings.unsavedChanges', hasChanges => {
            this.toggleUnsavedChangesAlert(hasChanges);
        });

        // Subscribe to errors
        this.state.subscribe('settings.error', error => {
            if (error) this.showError(error);
        });
    }

    async loadSettings() {
        try {
            await this.settingsFeature.loadSettings();
        } catch (error) {
            this.showError(error.message);
        }
    }

    async saveSettings() {
        try {
            const settings = this.gatherCurrentSettings();
            await this.settingsFeature.saveSettings(settings);
            this.toggleUnsavedChangesAlert(false);
        } catch (error) {
            this.showError(error.message);
        }
    }

    async resetSettings() {
        if (confirm(this.translator.translate('confirmResetSettings'))) {
            try {
                await this.settingsFeature.resetSettings();
            } catch (error) {
                this.showError(error.message);
            }
        }
    }

    exportSettings() {
        try {
            this.settingsFeature.exportSettings();
        } catch (error) {
            this.showError(error.message);
        }
    }

    async importSettings(file) {
        if (!file) return;

        if (confirm(this.translator.translate('confirmImportSettings'))) {
            try {
                await this.settingsFeature.importSettings(file);
            } catch (error) {
                this.showError(error.message);
            }
        }

        // Reset file input
        this.elements.importInput.value = '';
    }

    handleSettingChange(name, value) {
        try {
            this.settingsFeature.updateSetting(name, value);
        } catch (error) {
            this.showError(error.message);
        }
    }

    // Utility methods
    getInputValue(input) {
        if (input.type === 'checkbox') {
            return input.checked;
        }
        return input.value;
    }

    setInputValue(input, value) {
        if (input.type === 'checkbox') {
            input.checked = value;
        } else {
            input.value = value;
        }
    }

    updateInputValues(settings) {
        this.elements.inputs.forEach((input, name) => {
            const value = this.getNestedValue(settings, name);
            if (value !== undefined) {
                this.setInputValue(input, value);
            }
        });
    }

    gatherCurrentSettings() {
        const settings = {};
        this.elements.inputs.forEach((input, name) => {
            this.setNestedValue(settings, name, this.getInputValue(input));
        });
        return settings;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    setNestedValue(obj, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        const target = parts.reduce((acc, part) => {
            if (!acc[part]) acc[part] = {};
            return acc[part];
        }, obj);
        target[last] = value;
        return obj;
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        
        setTimeout(() => {
            this.elements.errorMessage.classList.add('hidden');
        }, 5000);
    }

    toggleUnsavedChangesAlert(show) {
        if (show) {
            this.elements.unsavedChangesAlert.classList.remove('hidden');
        } else {
            this.elements.unsavedChangesAlert.classList.add('hidden');
        }
    }

    updateTranslations() {
        // Update all elements with data-i18n attribute
        this.container.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.translator.translate(key);
        });
    }

    destroy() {
        // Remove event listeners
        this.elements.inputs.forEach(input => {
            input.removeEventListener('change', this.handleSettingChange);
        });

        // Remove state subscriptions (if implemented)
    }
}
