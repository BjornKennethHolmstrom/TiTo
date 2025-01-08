// src/core/translationManager.js
(function(window) {
    'use strict';

    class TranslationManager {
        constructor() {
            // Set default language
            this.currentLanguage = localStorage.getItem('titoLanguage') || 'en';
            this.fallbackLanguage = 'en';
            this.isInitialized = false;
            this.callbacks = new Set();

            // Bind methods
            this.translate = this.translate.bind(this);
            this.setLanguage = this.setLanguage.bind(this);
            this.getCurrentLanguage = this.getCurrentLanguage.bind(this);
        }

        async initialize() {
            try {
                // Verify translations are available
                if (typeof window.translations === 'undefined') {
                    throw new Error('Translations not loaded. Make sure translations.js is included before translationManager.js');
                }

                // Load language preference from localStorage
                const savedLanguage = localStorage.getItem('titoLanguage');
                if (savedLanguage && window.translations[savedLanguage]) {
                    this.currentLanguage = savedLanguage;
                }

                // Initialize language observer for system changes
                this.initializeLanguageObserver();

                // Add language-specific attributes to document
                document.documentElement.lang = this.currentLanguage;
                document.documentElement.setAttribute('data-language', this.currentLanguage);

                this.isInitialized = true;
                return true;

            } catch (error) {
                console.error('Failed to initialize TranslationManager:', error);
                throw error;
            }
        }

        translate(key, vars = null) {
            try {
                if (!this.isInitialized) {
                    console.warn('TranslationManager not initialized. Using key as fallback.');
                    return key;
                }

                // Get translation from current language or fallback to English
                let translation = this.getTranslationForKey(key);

                // Replace variables if provided
                if (vars) {
                    translation = this.replaceVariables(translation, vars);
                }

                return translation;
            } catch (error) {
                console.error(`Translation error for key "${key}":`, error);
                return key; // Return the key itself as fallback
            }
        }

        getTranslationForKey(key) {
            const translations = window.translations;

            // Try current language
            if (translations[this.currentLanguage]?.[key]) {
                return translations[this.currentLanguage][key];
            }

            // Try fallback language
            if (translations[this.fallbackLanguage]?.[key]) {
                return translations[this.fallbackLanguage][key];
            }

            // Return key if no translation found
            console.warn(`No translation found for key "${key}" in ${this.currentLanguage} or ${this.fallbackLanguage}`);
            return key;
        }

        replaceVariables(text, vars) {
            return Object.entries(vars).reduce((str, [key, value]) => {
                const regex = new RegExp(`{${key}}`, 'g');
                return str.replace(regex, value);
            }, text);
        }

        setLanguage(lang) {
            if (!window.translations[lang]) {
                console.error(`Language "${lang}" not available`);
                return false;
            }

            this.currentLanguage = lang;
            localStorage.setItem('titoLanguage', lang);
            
            // Update document attributes
            document.documentElement.lang = lang;
            document.documentElement.setAttribute('data-language', lang);
            
            // Notify all language change observers
            this.notifyLanguageChange();

            return true;
        }

        getCurrentLanguage() {
            return this.currentLanguage;
        }

        getAvailableLanguages() {
            return Object.keys(window.translations).map(code => ({
                code,
                name: this.getLanguageName(code)
            }));
        }

        getLanguageName(code) {
            const names = {
                en: 'English',
                es: 'Español',
                se: 'Svenska',
                eu: 'Euskara',
                fr: 'Française',
                de: 'Deutsch',
                ja: '日本語'
            };
            return names[code] || code;
        }

        onLanguageChange(callback) {
            if (typeof callback !== 'function') {
                console.error('Language change callback must be a function');
                return;
            }

            this.callbacks.add(callback);
            return () => this.callbacks.delete(callback);
        }

        notifyLanguageChange() {
            this.callbacks.forEach(callback => {
                try {
                    callback(this.currentLanguage);
                } catch (error) {
                    console.error('Error in language change callback:', error);
                }
            });

            // Dispatch event for broader application awareness
            window.dispatchEvent(new CustomEvent('titoLanguageChange', {
                detail: { language: this.currentLanguage }
            }));
        }

        initializeLanguageObserver() {
            // Handle potential browser language changes
            if (window.navigator.language) {
                const browserLanguage = window.navigator.language.split('-')[0];
                if (browserLanguage !== this.currentLanguage && window.translations[browserLanguage]) {
                    console.info(`Browser language (${browserLanguage}) differs from current language (${this.currentLanguage})`);
                }
            }
        }

        updateTranslations(container = document) {
            if (!this.isInitialized) {
                console.warn('TranslationManager not initialized. Skipping translation update.');
                return;
            }

            // Update elements with data-i18n attribute
            container.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                element.textContent = this.translate(key);
            });

            // Update elements with data-i18n-placeholder attribute
            container.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
                const key = element.getAttribute('data-i18n-placeholder');
                element.placeholder = this.translate(key);
            });

            // Update elements with data-i18n-title attribute
            container.querySelectorAll('[data-i18n-title]').forEach(element => {
                const key = element.getAttribute('data-i18n-title');
                element.title = this.translate(key);
            });

            // Update aria-label attributes with data-i18n-aria-label
            container.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
                const key = element.getAttribute('data-i18n-aria-label');
                element.setAttribute('aria-label', this.translate(key));
            });
        }
    }

    // Create global instance
    window.titoTranslator = new TranslationManager();

})(window);
