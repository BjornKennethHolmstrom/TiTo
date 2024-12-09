// src/ui/components/ThemeSwitcher/index.js
class ThemeSwitcher {
    constructor(themesFeature, stateManager, translationManager, container) {
        this.themesFeature = themesFeature;
        this.state = stateManager;
        this.translator = translationManager;
        this.container = container;

        this.elements = {
            button: null,
            dropdown: null,
            themeIcon: null,
            autoDetectOption: null,
            customizeButton: null,
            customizerModal: null
        };

        this.initialize();
    }

    initialize() {
        // Create component structure
        this.container.innerHTML = `
            <div class="theme-switcher">
                <button type="button" 
                    class="theme-button" 
                    aria-haspopup="true" 
                    aria-expanded="false"
                    aria-label="${this.translator.translate('changeTheme')}">
                    <svg class="theme-icon theme-light" viewBox="0 0 24 24" width="20" height="20">
                        <circle cx="12" cy="12" r="5" fill="currentColor"/>
                        <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <svg class="theme-icon theme-dark" viewBox="0 0 24 24" width="20" height="20">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor"/>
                    </svg>
                    <svg class="theme-icon theme-system" viewBox="0 0 24 24" width="20" height="20">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
                        <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
                
                <div class="theme-dropdown hidden" role="menu">
                    <button type="button" 
                        class="theme-option" 
                        data-theme="auto" 
                        role="menuitemradio">
                        <svg class="theme-icon theme-system" viewBox="0 0 24 24" width="16" height="16">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
                            <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <span data-i18n="systemTheme">System</span>
                        <span class="theme-check">✓</span>
                    </button>
                    <button type="button" 
                        class="theme-option" 
                        data-theme="light" 
                        role="menuitemradio">
                        <svg class="theme-icon theme-light" viewBox="0 0 24 24" width="16" height="16">
                            <circle cx="12" cy="12" r="5" fill="currentColor"/>
                            <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <span data-i18n="lightTheme">Light</span>
                        <span class="theme-check">✓</span>
                    </button>
                    <button type="button" 
                        class="theme-option" 
                        data-theme="dark" 
                        role="menuitemradio">
                        <svg class="theme-icon theme-dark" viewBox="0 0 24 24" width="16" height="16">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor"/>
                        </svg>
                        <span data-i18n="darkTheme">Dark</span>
                        <span class="theme-check">✓</span>
                    </button>
                </div>
            </div>
        `;

        // Cache element references
        this.cacheElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Subscribe to state changes
        this.setupStateSubscriptions();

        // Initial theme update
        this.updateThemeDisplay(this.themesFeature.getCurrentTheme());
    }

    cacheElements() {
        this.elements.button = this.container.querySelector('.theme-button');
        this.elements.dropdown = this.container.querySelector('.theme-dropdown');
        this.elements.themeOptions = this.container.querySelectorAll('.theme-option');
    }

    setupEventListeners() {
        // Toggle dropdown
        this.elements.button.addEventListener('click', () => this.toggleDropdown());

        // Theme selection
        this.elements.themeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                this.handleThemeChange(theme);
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Keyboard navigation
        this.container.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
    }

    setupStateSubscriptions() {
        this.state.subscribe('theme.current', theme => {
            this.updateThemeDisplay(theme);
        });

        this.state.subscribe('theme.autoDetect', autoDetect => {
            this.updateAutoDetectState(autoDetect);
        });
    }

    async handleThemeChange(theme) {
        try {
            if (theme === 'auto') {
                await this.themesFeature.toggleAutoDetect();
            } else {
                await this.themesFeature.setTheme(theme, false);
            }
            this.closeDropdown();
        } catch (error) {
            console.error('Error changing theme:', error);
        }
    }

    updateThemeDisplay(theme) {
        // Update button icon
        this.elements.button.querySelectorAll('.theme-icon').forEach(icon => {
            icon.classList.add('hidden');
        });
        const activeIcon = this.elements.button.querySelector(
            `.theme-icon.theme-${theme === 'auto' ? 'system' : theme}`
        );
        if (activeIcon) activeIcon.classList.remove('hidden');

        // Update selected state in dropdown
        this.elements.themeOptions.forEach(option => {
            const check = option.querySelector('.theme-check');
            const isSelected = option.dataset.theme === theme;
            check.classList.toggle('hidden', !isSelected);
            option.setAttribute('aria-checked', isSelected);
        });

        // Update aria-label
        this.elements.button.setAttribute(
            'aria-label',
            this.translator.translate(
                theme === 'auto' ? 'systemTheme' :
                theme === 'light' ? 'lightTheme' : 'darkTheme'
            )
        );
    }

    updateAutoDetectState(autoDetect) {
        const systemOption = this.elements.dropdown.querySelector('[data-theme="auto"]');
        if (systemOption) {
            const check = systemOption.querySelector('.theme-check');
            check.classList.toggle('hidden', !autoDetect);
            systemOption.setAttribute('aria-checked', autoDetect);
        }
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
        const firstOption = this.elements.dropdown.querySelector('.theme-option');
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
        const options = Array.from(this.elements.themeOptions);
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
                if (document.activeElement.classList.contains('theme-option')) {
                    this.handleThemeChange(document.activeElement.dataset.theme);
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

    updateTranslations() {
        this.container.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.translator.translate(key);
        });
    }

    destroy() {
        document.removeEventListener('click', this.closeDropdown);
    }
}
