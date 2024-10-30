// src/features/settings.js
export class SettingsFeature {
    constructor(stateManager, translationManager) {
        this.state = stateManager;
        this.translator = translationManager;

        // Default settings configuration
        this.defaultSettings = {
            general: {
                language: 'en',
                startPage: 'timer',
                showNotifications: true,
                confirmBeforeDelete: true
            },
            timer: {
                showSeconds: true,
                autoStartOnProjectSelect: false,
                roundTimeTo: 0, // 0 = no rounding, 5 = 5 minutes, 15 = 15 minutes
                defaultDuration: 30, // minutes for manual entries
            },
            timeEntries: {
                entriesPerPage: 10,
                defaultSortOrder: 'newest',
                showDescriptions: true,
                groupByDay: false
            },
            projects: {
                showInactive: false,
                colorCoding: true,
                defaultGoalPeriod: 'weekly'
            },
            reports: {
                defaultType: 'weekly',
                defaultDateRange: 'thisMonth',
                includeInactiveProjects: false,
                defaultColumns: ['period', 'project', 'description', 'timeSpent', 'totalTime']
            },
            export: {
                defaultFormat: 'csv',
                includeMetadata: true,
                dateFormat: 'YYYY-MM-DD',
                timeFormat: '24h'
            },
            backup: {
                autoBackup: false,
                backupInterval: 'daily', // daily, weekly, monthly
                keepBackups: 5, // number of backups to keep
                backupLocation: 'local' // local, download
            }
        };

        this.initializeState();
        this.loadSettings();
        this.setupSubscriptions();
    }

    initializeState() {
        this.state.batchUpdate([
            ['settings', {
                current: this.defaultSettings,
                previousSettings: null,
                unsavedChanges: false,
                loading: false,
                error: null
            }]
        ]);
    }

    setupSubscriptions() {
        // Watch for settings changes to mark unsaved changes
        this.state.subscribe('settings.current', (settings) => {
            const previousSettings = this.state.select('settings.previousSettings');
            if (previousSettings) {
                const hasChanges = !this.areSettingsEqual(settings, previousSettings);
                this.state.update('settings.unsavedChanges', hasChanges);
            }
        });

        // Apply certain settings immediately when changed
        this.state.subscribe('settings.current.general.language', (language) => {
            localStorage.setItem('titoLanguage', language);
            // Emit event for language change
            window.dispatchEvent(new CustomEvent('languagechange', { 
                detail: { language } 
            }));
        });
    }

    async loadSettings() {
        try {
            this.state.update('settings.loading', true);

            // Load settings from localStorage
            const savedSettings = localStorage.getItem('titoSettings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                const validated = this.validateSettings(parsed);
                
                this.state.batchUpdate([
                    ['settings.current', validated],
                    ['settings.previousSettings', validated],
                    ['settings.loading', false],
                    ['settings.error', null]
                ]);
            } else {
                // Use default settings if none saved
                await this.saveSettings(this.defaultSettings);
            }
        } catch (error) {
            this.state.batchUpdate([
                ['settings.loading', false],
                ['settings.error', this.translator.translate('errorLoadingSettings')]
            ]);
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings(settings = null) {
        try {
            this.state.update('settings.loading', true);

            const settingsToSave = settings || this.state.select('settings.current');
            const validated = this.validateSettings(settingsToSave);

            // Save to localStorage
            localStorage.setItem('titoSettings', JSON.stringify(validated));

            this.state.batchUpdate([
                ['settings.current', validated],
                ['settings.previousSettings', validated],
                ['settings.unsavedChanges', false],
                ['settings.loading', false],
                ['settings.error', null]
            ]);

            // Emit event for settings change
            window.dispatchEvent(new CustomEvent('settingschange', { 
                detail: { settings: validated } 
            }));

            return validated;
        } catch (error) {
            this.state.batchUpdate([
                ['settings.loading', false],
                ['settings.error', this.translator.translate('errorSavingSettings')]
            ]);
            throw error;
        }
    }

    async updateSettings(path, value) {
        try {
            const current = this.state.select('settings.current');
            const updated = this.setNestedValue(current, path, value);
            const validated = this.validateSettings(updated);

            this.state.update('settings.current', validated);

            return validated;
        } catch (error) {
            this.state.update('settings.error', error.message);
            throw error;
        }
    }

    async resetSettings(section = null) {
        try {
            let resetSettings;
            if (section) {
                const current = this.state.select('settings.current');
                resetSettings = {
                    ...current,
                    [section]: this.defaultSettings[section]
                };
            } else {
                resetSettings = this.defaultSettings;
            }

            await this.saveSettings(resetSettings);
            return resetSettings;
        } catch (error) {
            this.state.update('settings.error', error.message);
            throw error;
        }
    }

    exportSettings() {
        try {
            const settings = this.state.select('settings.current');
            const exportData = {
                settings,
                metadata: {
                    version: '1.10.0',
                    exportDate: new Date().toISOString(),
                    platform: 'web'
                }
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'tito-settings.json';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            this.state.update('settings.error', this.translator.translate('errorExportingSettings'));
            throw error;
        }
    }

    async importSettings(file) {
        try {
            this.state.update('settings.loading', true);

            const content = await this.readFile(file);
            const imported = JSON.parse(content);

            // Validate imported settings
            if (!imported.settings) {
                throw new Error(this.translator.translate('invalidSettingsFile'));
            }

            // Merge with defaults to ensure all required settings exist
            const merged = this.mergeWithDefaults(imported.settings);
            
            await this.saveSettings(merged);
            return merged;
        } catch (error) {
            this.state.batchUpdate([
                ['settings.loading', false],
                ['settings.error', this.translator.translate('errorImportingSettings')]
            ]);
            throw error;
        }
    }

    // Backup management
    async createBackup() {
        try {
            const settings = this.state.select('settings.current');
            const backup = {
                settings,
                metadata: {
                    version: '1.10.0',
                    timestamp: new Date().toISOString(),
                    type: 'backup'
                }
            };

            // Store in localStorage with timestamp
            const backups = this.getBackups();
            const timestamp = new Date().toISOString();
            backups[timestamp] = backup;

            // Remove old backups if needed
            const maxBackups = settings.backup.keepBackups;
            const timestamps = Object.keys(backups).sort();
            while (timestamps.length > maxBackups) {
                delete backups[timestamps.shift()];
            }

            localStorage.setItem('titoSettingsBackups', JSON.stringify(backups));
            return backup;
        } catch (error) {
            this.state.update('settings.error', this.translator.translate('errorCreatingBackup'));
            throw error;
        }
    }

    getBackups() {
        try {
            const backupsJson = localStorage.getItem('titoSettingsBackups');
            return backupsJson ? JSON.parse(backupsJson) : {};
        } catch (error) {
            console.error('Error getting backups:', error);
            return {};
        }
    }

    async restoreBackup(timestamp) {
        try {
            const backups = this.getBackups();
            const backup = backups[timestamp];
            if (!backup) {
                throw new Error(this.translator.translate('backupNotFound'));
            }

            await this.saveSettings(backup.settings);
            return backup.settings;
        } catch (error) {
            this.state.update('settings.error', this.translator.translate('errorRestoringBackup'));
            throw error;
        }
    }

    // Utility functions
    validateSettings(settings) {
        // Deep clone to avoid modifying input
        const validated = JSON.parse(JSON.stringify(settings));

        // Ensure all required settings exist
        Object.entries(this.defaultSettings).forEach(([section, defaults]) => {
            if (!validated[section]) {
                validated[section] = defaults;
            } else {
                Object.entries(defaults).forEach(([key, value]) => {
                    if (validated[section][key] === undefined) {
                        validated[section][key] = value;
                    }
                });
            }
        });

        // Validate specific settings
        if (!['en', 'es', 'se', 'eu', 'fr', 'de', 'ja'].includes(validated.general.language)) {
            validated.general.language = this.defaultSettings.general.language;
        }

        if (validated.timer.roundTimeTo && ![0, 5, 15, 30].includes(validated.timer.roundTimeTo)) {
            validated.timer.roundTimeTo = this.defaultSettings.timer.roundTimeTo;
        }

        if (validated.timeEntries.entriesPerPage < 1) {
            validated.timeEntries.entriesPerPage = this.defaultSettings.timeEntries.entriesPerPage;
        }

        return validated;
    }

    mergeWithDefaults(settings) {
        const merged = JSON.parse(JSON.stringify(this.defaultSettings));
        
        Object.entries(settings).forEach(([section, values]) => {
            if (merged[section]) {
                merged[section] = { ...merged[section], ...values };
            }
        });

        return this.validateSettings(merged);
    }

    setNestedValue(obj, path, value) {
        const copy = JSON.parse(JSON.stringify(obj));
        const parts = path.split('.');
        let current = copy;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!(parts[i] in current)) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
        return copy;
    }

    areSettingsEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    // Getters
    getSetting(path) {
        const parts = path.split('.');
        let value = this.state.select('settings.current');
        
        for (const part of parts) {
            if (value === undefined) return undefined;
            value = value[part];
        }
        
        return value;
    }

    getDefaultSetting(path) {
        const parts = path.split('.');
        let value = this.defaultSettings;
        
        for (const part of parts) {
            if (value === undefined) return undefined;
            value = value[part];
        }
        
        return value;
    }

    hasUnsavedChanges() {
        return this.state.select('settings.unsavedChanges');
    }

    isLoading() {
        return this.state.select('settings.loading');
    }

    getError() {
        return this.state.select('settings.error');
    }
}

