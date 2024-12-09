// src/ui/components/LanguageSwitcher/index.js
class LanguageSwitcher {
    constructor(settingsFeature, stateManager, translationManager, container) {
        this.settingsFeature = settingsFeature;
        this.state = stateManager;
        this.translator = translationManager;
        this.container = container;

        this.languages = [
            { code: 'en', name: 'English', flag: '🇬🇧' },
            { code: 'es', name: 'Español', flag: '🇪🇸' },
            { code: 'se', name: 'Svenska', flag: '🇸🇪' },
            { code: 'eu', name: 'Euskara', flag: '🇪🇺' },
            { code: 'fr', name: 'Française', flag: '🇫🇷' },
            { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
            { code: 'ja', name: '日本語', flag: '🇯🇵' }
        ];

        this.elements = {
            button: null,
            dropdown: null,
            currentLang: null
        };

        this.initialize();
    }

    initialize() {
        // Create component structure
        this.container.innerHTML = `
            <div class="language-switcher">
                <button type="button" class="lang-button" aria-haspopup="true" aria-expanded="false">
                    <span class="current-lang"></span>
                    <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12">
                        <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none"/>
                    </svg>
                </button>
                <div class="lang-dropdown hidden" role="menu">
                    ${this.languages.map(lang => `
                        <button type="button" class="lang-option" data-lang="${lang.code}" role="menuitem">
                            <span class="lang-flag">${lang.flag}</span>
                            <span class="lang-name">${lang.name}</span>
                            <span class="lang-check hidden">✓</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Cache elements
        this.elements.button = this.container.querySelector('.lang-button');
        this.elements.dropdown = this.container.querySelector('.lang-dropdown');
        this.elements.currentLang = this.container.querySelector('.current-lang');

        // Set up event listeners
        this.setupEventListeners();

        // Subscribe to state changes
        this.setupStateSubscriptions();

        // Set initial language
        this.updateCurrentLanguage(this.translator.getCurrentLanguage());
    }

    setupEventListeners() {
        // Toggle dropdown
        this.elements.button.addEventListener('click', () => {
            this.toggleDropdown();
        });

        // Handle language selection
        this.elements.dropdown.addEventListener('click', (e) => {
            const option = e.target.closest('.lang-option');
            if (option) {
                const langCode = option.dataset.lang;
                this.handleLanguageChange(langCode);
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Keyboard navigation
        this.container.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
    }

    setupStateSubscriptions() {
        this.state.subscribe('settings.current.general.language', (language) => {
            this.updateCurrentLanguage(language);
        });
    }

    async handleLanguageChange(langCode) {
        try {
            // Update settings through the settings feature
            await this.settingsFeature.updateSettings('general.language', langCode);
            
            // Close dropdown
            this.closeDropdown();
        } catch (error) {
            console.error('Error changing language:', error);
        }
    }

    updateCurrentLanguage(langCode) {
        const language = this.languages.find(l => l.code === langCode);
        if (!language) return;

        // Update current language display
        this.elements.currentLang.innerHTML = `
            <span class="lang-flag">${language.flag}</span>
            <span class="lang-name">${language.name}</span>
        `;

        // Update checkmarks in dropdown
        this.elements.dropdown.querySelectorAll('.lang-option').forEach(option => {
            const check = option.querySelector('.lang-check');
            if (option.dataset.lang === langCode) {
                check.classList.remove('hidden');
                option.setAttribute('aria-current', 'true');
            } else {
                check.classList.add('hidden');
                option.removeAttribute('aria-current');
            }
        });
    }

    toggleDropdown() {
        const isExpanded = this.elements.button.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        this.elements.dropdown.classList.remove('hidden');
        this.elements.button.setAttribute('aria-expanded', 'true');
        
        // Focus first option
        const firstOption = this.elements.dropdown.querySelector('.lang-option');
        if (firstOption) {
            firstOption.focus();
        }
    }

    closeDropdown() {
        this.elements.dropdown.classList.add('hidden');
        this.elements.button.setAttribute('aria-expanded', 'false');
    }

    handleKeyboardNavigation(e) {
        const isExpanded = this.elements.button.getAttribute('aria-expanded') === 'true';
        const options = Array.from(this.elements.dropdown.querySelectorAll('.lang-option'));
        const currentIndex = options.findIndex(option => option === document.activeElement);

        switch (e.key) {
            case 'Escape':
                if (isExpanded) {
                    this.closeDropdown();
                    this.elements.button.focus();
                }
                break;

            case 'ArrowDown':
                e.preventDefault();
                if (!isExpanded) {
                    this.openDropdown();
                } else if (currentIndex < options.length - 1) {
                    options[currentIndex + 1].focus();
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (isExpanded && currentIndex > 0) {
                    options[currentIndex - 1].focus();
                }
                break;

            case 'Enter':
            case ' ':
                e.preventDefault();
                if (document.activeElement.classList.contains('lang-option')) {
                    this.handleLanguageChange(document.activeElement.dataset.lang);
                } else if (document.activeElement === this.elements.button) {
                    this.toggleDropdown();
                }
                break;

            case 'Tab':
                if (isExpanded) {
                    this.closeDropdown();
                }
                break;
        }
    }

    destroy() {
        // Remove event listeners
        document.removeEventListener('click', this.closeDropdown);
        this.container.removeEventListener('keydown', this.handleKeyboardNavigation);
    }
}
