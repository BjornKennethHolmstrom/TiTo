// Modified main.js
(function(window) {
    'use strict';

    // Wait for all required dependencies to be loaded
    function checkDependencies() {
        const required = [
            'titoDatabase', 
            'titoState', 
            'titoTranslator', 
            'titoProjectManager',
            'titoTimeEntryManager',
            'titoTimerFeature',
            'translations'
        ];

        const missing = required.filter(dep => !window[dep]);
        if (missing.length > 0) {
            throw new Error(`Missing required dependencies: ${missing.join(', ')}`);
        }
    }

    // Global error handler
    function showError(message) {
        console.error(message);
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-message';
        errorContainer.textContent = message;
        document.body.appendChild(errorContainer);
        
        setTimeout(() => {
            errorContainer.remove();
        }, 5000);
    }

    // Initialize UI components with proper dependency injection
    async function initializeUI() {
        try {
            checkDependencies();

            // Initialize translation manager first
            await window.titoTranslator.initialize();

            // Define required containers
            const containers = {
                timer: document.getElementById('timerDisplay'),
                projects: document.getElementById('projectManagement'),
                timeEntries: document.getElementById('timeEntries'),
                reports: document.getElementById('reports'),
                goals: document.getElementById('goals'),
                themeSwitcher: document.querySelector('.theme-switcher'),
                languageSwitcher: document.querySelector('.language-switcher')
            };

            // Convert NodeList to Array for available containers
            const availableContainers = Array.from(document.querySelectorAll('[id], .theme-switcher, .language-switcher'))
                .map(el => el.id || el.className)
                .join(', ');

            // Validate containers with specific error messages
            Object.entries(containers).forEach(([name, container]) => {
                if (!container) {
                    console.error(`Container not found: ${name}`);
                    console.log('Available containers:', availableContainers);
                    throw new Error(`Required container not found: ${name}`);
                }
            });

            // Initialize components
            const components = {
                timer: new TimerDisplay(
                    window.titoTimerFeature,
                    window.titoState,
                    window.titoTranslator,
                    containers.timer
                ),
                projects: new ProjectList(
                    window.titoProjectManager,
                    window.titoState,
                    window.titoTranslator,
                    containers.projects
                ),
                timeEntries: new TimeEntries(
                    window.titoTimeEntryManager, // Use the global instance
                    window.titoState,
                    window.titoTranslator,
                    containers.timeEntries
                ),
                reports: new Reports(
                    window.titoTimeEntryManager, // Use the global instance
                    window.titoState,
                    window.titoTranslator,
                    containers.reports
                ),
                goals: new Goals(
                    window.titoTimeEntryManager, // Use the global instance
                    window.titoState,
                    window.titoTranslator,
                    containers.goals
                ),
                theme: new ThemeSwitcher(
                    window.titoThemesFeature,
                    window.titoState,
                    window.titoTranslator,
                    containers.themeSwitcher
                ),
                language: new LanguageSwitcher(
                    window.titoSettingsFeature,
                    window.titoState,
                    window.titoTranslator,
                    containers.languageSwitcher
                )
            };

            return components;
        } catch (error) {
            console.error('Error initializing UI:', error);
            showError('Failed to initialize application: ' + error.message);
            throw error;
        }
    }

    // Initialize event listeners after UI components are ready
    function initializeEventListeners(components) {
        // Tab switching
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.dataset.tab;
                
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                
                document.querySelectorAll('.tab-content').forEach(c => {
                    c.classList.remove('active');
                    c.hidden = true;
                });
                
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                
                const targetContent = document.getElementById(targetId);
                if (targetContent) {
                    targetContent.classList.add('active');
                    targetContent.hidden = false;
                }
            });
        });

        // Modal handling
        initializeModals();

        // Handle keyboard shortcuts
        initializeKeyboardShortcuts(components);
    }

    // Initialize modals
    function initializeModals() {
        const infoButton = document.querySelector('.info-icon');
        const helpButton = document.querySelector('.help-icon');
        const closeButtons = document.querySelectorAll('.modal .close');
        const modals = document.querySelectorAll('.modal');

        if (infoButton) {
            infoButton.addEventListener('click', () => {
                document.getElementById('infoModal').style.display = 'block';
            });
        }

        if (helpButton) {
            helpButton.addEventListener('click', () => {
                document.getElementById('helpModal').style.display = 'block';
            });
        }

        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                button.closest('.modal').style.display = 'none';
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Handle Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modals.forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });
    }

    // Initialize keyboard shortcuts
    function initializeKeyboardShortcuts(components) {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not in input/textarea
            if (e.target.matches('input, textarea')) return;

            // Start/Stop timer (Space)
            if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                if (components.timer) {
                    components.timer.handleStartStop();
                }
            }
        });
    }

    // Main initialization
    async function initializeApp() {
        try {
            // Wait for database to be ready
            await window.titoDatabase.ready;

            // Initialize UI components
            const components = await initializeUI();

            // Initialize event listeners
            initializeEventListeners(components);

            // Load initial data
            const projects = await window.titoProjectManager.getAllProjects();
            if (projects.length > 0) {
                window.titoProjectManager.setCurrentProject(projects[0]);
            }

            console.info('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            showError('Failed to initialize application: ' + error.message);
        }
    }

    // Initialize app when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

})(window);
