// src/app.js (modified for offline-first)
(function() {
    // Initialize core services
    const stateManager = new StateManager();
    const translationManager = new TranslationManager();

    // Initialize features
    const features = {
        timer: new TimerFeature(stateManager, translationManager),
        projects: new ProjectsFeature(stateManager, translationManager),
        timeEntries: new TimeEntriesFeature(stateManager, translationManager),
        reports: new ReportsFeature(stateManager, translationManager),
        goals: new GoalsFeature(stateManager, translationManager),
        themes: new ThemesFeature(stateManager, translationManager),
        settings: new SettingsFeature(stateManager, translationManager)
    };

    // Initialize UI components
    const ui = {
        timerDisplay: null,
        projectList: null,
        timeEntries: null,
        reports: null,
        goals: null,
        themeSwitcher: null,
        settings: null,
        languageSwitcher: null
    };

    // Application state
    let currentView = 'timer';
    let initialized = false;

    // Initialize application
    async function initializeApp() {
        try {
            // Initialize database first
            await initializeDatabase();

            // Load settings
            await features.settings.loadSettings();

            // Initialize features
            await features.themes.loadSavedTheme();
            await features.projects.loadProjects();
            await features.goals.initialize();

            // Initialize UI
            initializeUI();
            
            // Mark as initialized
            initialized = true;
            
            // Show initial view
            showView(features.settings.getSetting('general.startPage') || 'timer');
        } catch (error) {
            console.error('Initialization error:', error);
            showError(translationManager.translate('initializationError'));
        }
    }

    // Initialize IndexedDB database
    async function initializeDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TimeTrackerDB', 2);

            request.onerror = () => reject(new Error('Failed to open database'));
            request.onsuccess = () => resolve();

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create stores if they don't exist
                if (!db.objectStoreNames.contains('projects')) {
                    const projectStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
                    projectStore.createIndex('name', 'name', { unique: true });
                }

                if (!db.objectStoreNames.contains('timeEntries')) {
                    const timeEntryStore = db.createObjectStore('timeEntries', { keyPath: 'id', autoIncrement: true });
                    timeEntryStore.createIndex('projectId', 'projectId', { unique: false });
                }

                if (!db.objectStoreNames.contains('timeGoals')) {
                    const timeGoalsStore = db.createObjectStore('timeGoals', { keyPath: 'id', autoIncrement: true });
                    timeGoalsStore.createIndex('projectId', 'projectId', { unique: false });
                }
            };
        });
    }

    // Initialize UI components
    function initializeUI() {
        // Initialize timer-related components
        ui.timerDisplay = new TimerDisplay(
            features.timer,
            stateManager,
            translationManager,
            document.getElementById('timer-display')
        );

        // Initialize project-related components
        ui.projectList = new ProjectList(
            features.projects,
            stateManager,
            translationManager,
            document.getElementById('project-list')
        );

        // Initialize time entries components
        ui.timeEntries = new TimeEntries(
            features.timeEntries,
            stateManager,
            translationManager,
            document.getElementById('time-entries')
        );

        // Initialize reporting components
        ui.reports = new Reports(
            features.reports,
            stateManager,
            translationManager,
            document.getElementById('reports')
        );

        // Initialize goals components
        ui.goals = new Goals(
            features.goals,
            stateManager,
            translationManager,
            document.getElementById('goals')
        );

        // Initialize theme switcher
        ui.themeSwitcher = new ThemeSwitcher(
            features.themes,
            stateManager,
            translationManager,
            document.getElementById('theme-switcher')
        );

        // Initialize settings components
        ui.settings = new Settings(
            features.settings,
            stateManager,
            translationManager,
            document.getElementById('settings')
        );

        // Initialize language switcher
        ui.languageSwitcher = new LanguageSwitcher(
            features.settings,
            stateManager,
            translationManager,
            document.getElementById('language-switcher')
        );

        // Initialize navigation
        initializeNavigation();

        // Initialize global event listeners
        initializeEventListeners();

        // Initialize keyboard shortcuts
        initializeKeyboardShortcuts();
    }

    function initializeNavigation() {
        const navItems = document.querySelectorAll('[data-view]');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                showView(e.target.closest('[data-view]').dataset.view);
            });
        });

        // Mobile navigation toggle
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenuToggle && mobileMenu) {
            mobileMenuToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }
    }

    function initializeEventListeners() {
        // Handle theme changes
        window.addEventListener('themechange', (e) => {
            ui.themeSwitcher.updateDisplay(e.detail.theme);
        });

        // Handle language changes
        window.addEventListener('languagechange', (e) => {
            ui.languageSwitcher.updateDisplay(e.detail.language);
            updateUITranslations();
        });

        // Handle settings changes
        window.addEventListener('settingschange', (e) => {
            applySettings(e.detail.settings);
        });

        // Handle visibility changes (for timer accuracy)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                features.timer.onHidden();
            } else {
                features.timer.onVisible();
            }
        });

        // Handle before unload (save pending changes)
        window.addEventListener('beforeunload', (e) => {
            if (features.settings.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    function initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not in input/textarea
            if (e.target.matches('input, textarea')) return;

            // Start/Stop timer (Space)
            if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                if (features.timer.isRunning()) {
                    features.timer.stop();
                } else {
                    features.timer.start();
                }
            }

            // Quick add time entry (Ctrl/Cmd + N)
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyN') {
                e.preventDefault();
                ui.timeEntries.showAddEntryForm();
            }

            // Quick navigation
            if ((e.ctrlKey || e.metaKey) && e.altKey) {
                switch (e.code) {
                    case 'KeyT': // Timer view
                        e.preventDefault();
                        showView('timer');
                        break;
                    case 'KeyP': // Projects view
                        e.preventDefault();
                        showView('projects');
                        break;
                    case 'KeyR': // Reports view
                        e.preventDefault();
                        showView('reports');
                        break;
                    case 'KeyS': // Settings view
                        e.preventDefault();
                        showView('settings');
                        break;
                }
            }
        });
    }

    function updateUITranslations() {
        // Update all translatable elements
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.dataset.i18n;
            element.textContent = translationManager.translate(key);
        });

        // Update all translatable placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.dataset.i18nPlaceholder;
            element.placeholder = translationManager.translate(key);
        });

        // Update all translatable titles
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.dataset.i18nTitle;
            element.title = translationManager.translate(key);
        });
    }

    // Show view
    function showView(view) {
        if (!initialized) return;

        // Hide all views
        document.querySelectorAll('.view').forEach(el => {
            el.style.display = 'none';
        });

        // Show selected view
        const viewElement = document.getElementById(`${view}-view`);
        if (viewElement) {
            viewElement.style.display = 'block';
            currentView = view;

            // Update navigation
            updateNavigation();
        }
    }

    function applySettings(settings) {
        // Apply general settings
        document.documentElement.lang = settings.general.language;
        
        // Apply timer settings
        ui.timerDisplay.updateSettings(settings.timer);
        
        // Apply time entries settings
        ui.timeEntries.updateSettings(settings.timeEntries);
        
        // Apply project settings
        ui.projectList.updateSettings(settings.projects);
        
        // Apply report settings
        ui.reports.updateSettings(settings.reports);
    }

    // Show error
    function showError(message) {
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = message;
            
            errorContainer.appendChild(errorMessage);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                errorMessage.remove();
            }, 5000);
        }
    }

    // Start initialization when DOM is loaded
    document.addEventListener('DOMContentLoaded', initializeApp);
})();
