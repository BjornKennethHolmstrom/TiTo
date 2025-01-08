// src/features/themes.js
(function(window) {
    'use strict';

    class ThemesFeature {
        constructor() {
            // Check dependencies
            if (!window.titoDatabase) {
                throw new Error('Database service not found');
            }
            if (!window.titoState) {
                throw new Error('State Manager not found');
            }
            if (!window.titoTranslator) {
                throw new Error('Translation Manager not found');
            }

            // Initialize service references
            this.db = window.titoDatabase;
            this.state = window.titoState;
            this.translator = window.titoTranslator;

            // Default themes configuration
            this.themes = {
                light: {
                    id: 'light',
                    name: 'Light',
                    colors: {
                        primary: '#007bff',
                        'primary-dark': '#0056b3',
                        'primary-light': '#e6f2ff',
                        secondary: '#4CAF50',
                        'secondary-dark': '#45a049',
                        accent: '#0799c5',
                        'accent-light': '#66d3f4',
                        'background-main': '#f4f4f4',
                        'background-card': '#fff',
                        'background-alt': '#f8f8f8',
                        'text-primary': '#333',
                        'text-secondary': '#555',
                        'text-tertiary': '#666',
                        border: '#ddd',
                        'button-danger': '#e74c3c',
                        'button-danger-dark': '#c0392b',
                        'button-clear': '#7B0323',
                        'button-clear-dark': '#5E0219',
                        hover: '#f0f0f0',
                        active: '#e0e0e0',
                        'chart-bar': 'rgba(75, 192, 192, 0.6)',
                        'chart-border': 'rgba(75, 192, 192, 1)',
                        shadow: 'rgba(0, 0, 0, 0.1)',
                        'modal-overlay': 'rgba(0, 0, 0, 0.4)',
                        success: '#28a745',
                        warning: '#ffc107',
                        error: '#dc3545',
                        info: '#17a2b8'
                    }
                },
                dark: {
                    id: 'dark',
                    name: 'Dark',
                    colors: {
                        primary: '#4dabf7',
                        'primary-dark': '#339af0',
                        'primary-light': '#1c7ed6',
                        secondary: '#69db7c',
                        'secondary-dark': '#51cf66',
                        accent: '#3bc9db',
                        'accent-light': '#66d9e8',
                        'background-main': '#121212',
                        'background-card': '#1e1e1e',
                        'background-alt': '#2c2c2c',
                        'text-primary': '#e0e0e0',
                        'text-secondary': '#a0a0a0',
                        'text-tertiary': '#808080',
                        border: '#333',
                        'button-danger': '#ff6b6b',
                        'button-danger-dark': '#f03e3e',
                        'button-clear': '#ffa8a8',
                        'button-clear-dark': '#ff8787',
                        hover: '#2a2a2a',
                        active: '#3a3a3a',
                        'chart-bar': 'rgba(100, 255, 218, 0.6)',
                        'chart-border': 'rgba(100, 255, 218, 1)',
                        shadow: 'rgba(0, 0, 0, 0.3)',
                        'modal-overlay': 'rgba(0, 0, 0, 0.7)',
                        success: '#2ecc71',
                        warning: '#f1c40f',
                        error: '#e74c3c',
                        info: '#3498db'
                    }
                }
            };

            // Initialize state
            this.initializeState();
            this.setupSystemThemeDetection();
            this.loadSavedTheme();

            // Debug mode
            this.debugMode = window.location.search.includes('debug=true');
        }

        initializeState() {
            this.state.update('theme', {
                current: 'light',
                customThemes: [],
                systemPreference: null,
                autoDetect: true,
                loading: false,
                error: null
            });
        }

        setupSystemThemeDetection() {
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQuery.addEventListener('change', (e) => {
                    if (this.state.select('theme.autoDetect')) {
                        this.setTheme(e.matches ? 'dark' : 'light', true);
                    }
                });

                // Store initial system preference
                this.state.update('theme.systemPreference', 
                    mediaQuery.matches ? 'dark' : 'light'
                );
            }
        }

        loadSavedTheme() {
            try {
                // Load custom themes
                const savedCustomThemes = localStorage.getItem('customThemes');
                if (savedCustomThemes) {
                    const customThemes = JSON.parse(savedCustomThemes);
                    this.state.update('theme.customThemes', customThemes);
                    // Add custom themes to available themes
                    customThemes.forEach(theme => {
                        this.themes[theme.id] = theme;
                    });
                }

                // Load theme preference
                const savedTheme = localStorage.getItem('theme');
                const autoDetect = localStorage.getItem('themeAutoDetect') === 'true';
                
                this.state.update('theme.autoDetect', autoDetect);

                if (autoDetect) {
                    this.setTheme(this.state.select('theme.systemPreference'), true);
                } else if (savedTheme && this.themes[savedTheme]) {
                    this.setTheme(savedTheme, false);
                } else {
                    this.setTheme('light', false);
                }

                this.debugLog('Saved theme loaded');
            } catch (error) {
                console.error('Error loading saved theme:', error);
                this.state.update('theme.error', this.translator.translate('errorLoadingTheme'));
            }
        }

        setTheme(themeId, auto = false) {
            try {
                if (!this.themes[themeId]) {
                    throw new Error(this.translator.translate('invalidTheme'));
                }

                this.state.batchUpdate([
                    ['theme.current', themeId],
                    ['theme.autoDetect', auto],
                    ['theme.error', null]
                ]);

                // Save preferences
                localStorage.setItem('theme', themeId);
                localStorage.setItem('themeAutoDetect', auto);

                // Apply theme
                this.applyTheme(themeId);
                this.debugLog('Theme set', { themeId, auto });

            } catch (error) {
                this.state.update('theme.error', error.message);
                throw error;
            }
        }

        applyTheme(themeId) {
            const theme = this.themes[themeId];
            if (!theme) return;

            // Update CSS variables
            const root = document.documentElement;
            Object.entries(theme.colors).forEach(([key, value]) => {
                root.style.setProperty(`--color-${key}`, value);
            });

            // Update data attribute for CSS selectors
            root.setAttribute('data-theme', themeId);

            // Emit theme change event
            window.dispatchEvent(new CustomEvent('themechange', { 
                detail: { theme: themeId } 
            }));
        }

        addCustomTheme(theme) {
            try {
                if (!theme.id || !theme.name || !theme.colors) {
                    throw new Error(this.translator.translate('invalidThemeFormat'));
                }

                // Validate colors
                const requiredColors = Object.keys(this.themes.light.colors);
                const missingColors = requiredColors.filter(color => !theme.colors[color]);
                if (missingColors.length > 0) {
                    throw new Error(this.translator.translate('missingThemeColors'));
                }

                // Check for duplicate ID
                if (this.themes[theme.id]) {
                    throw new Error(this.translator.translate('themeIdExists'));
                }

                // Add to themes
                this.themes[theme.id] = theme;

                // Update state
                const customThemes = [...this.state.select('theme.customThemes'), theme];
                this.state.update('theme.customThemes', customThemes);

                // Save to localStorage
                localStorage.setItem('customThemes', JSON.stringify(customThemes));

                this.debugLog('Custom theme added', theme);
                return theme;
            } catch (error) {
                this.state.update('theme.error', error.message);
                throw error;
            }
        }

        removeCustomTheme(themeId) {
            try {
                // Can't remove built-in themes
                if (themeId === 'light' || themeId === 'dark') {
                    throw new Error(this.translator.translate('cantRemoveBuiltinTheme'));
                }

                // Check if theme exists and is custom
                const customThemes = this.state.select('theme.customThemes');
                if (!customThemes.find(t => t.id === themeId)) {
                    throw new Error(this.translator.translate('themeNotFound'));
                }

                // Switch to default theme if removing current theme
                if (this.state.select('theme.current') === themeId) {
                    this.setTheme('light', false);
                }

                // Remove from themes
                delete this.themes[themeId];

                // Update state
                const updatedThemes = customThemes.filter(t => t.id !== themeId);
                this.state.update('theme.customThemes', updatedThemes);

                // Save to localStorage
                localStorage.setItem('customThemes', JSON.stringify(updatedThemes));

                this.debugLog('Custom theme removed', { themeId });

            } catch (error) {
                this.state.update('theme.error', error.message);
                throw error;
            }
        }

        getThemesList() {
            return Object.values(this.themes).map(theme => ({
                id: theme.id,
                name: theme.name,
                isBuiltin: theme.id === 'light' || theme.id === 'dark',
                isCurrent: theme.id === this.state.select('theme.current')
            }));
        }

        getCurrentTheme() {
            const themeId = this.state.select('theme.current');
            return this.themes[themeId];
        }

        getThemeColors(themeId = null) {
            const theme = themeId ? this.themes[themeId] : this.getCurrentTheme();
            return theme ? theme.colors : null;
        }

        toggleAutoDetect() {
            const currentAuto = this.state.select('theme.autoDetect');
            const newAuto = !currentAuto;
            
            if (newAuto) {
                this.setTheme(this.state.select('theme.systemPreference'), true);
            }
            
            this.state.update('theme.autoDetect', newAuto);
            localStorage.setItem('themeAutoDetect', newAuto);

            this.debugLog('Auto detect toggled', newAuto);
        }

        generateThemeCSS(themeId) {
            const theme = this.themes[themeId];
            if (!theme) return '';

            return `:root[data-theme="${themeId}"] {\n${
                Object.entries(theme.colors)
                    .map(([key, value]) => `  --color-${key}: ${value};`)
                    .join('\n')
            }\n}`;
        }

        debugLog(action, data = null) {
            if (this.debugMode) {
                console.log(`[Themes] ${action}:`, data);
            }
        }
    }

    // Create global instance
    window.titoThemesFeature = new ThemesFeature();

})(window);
