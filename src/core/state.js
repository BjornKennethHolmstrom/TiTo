// src/core/state.js
export class StateManager {
    constructor() {
        this.state = {
            timer: {
                isRunning: false,
                startTime: null,
                elapsedTime: 0,
                currentProjectId: null
            },
            projects: {
                items: [],
                currentProjectId: null,
                loading: false,
                error: null
            },
            timeEntries: {
                items: [],
                currentPage: 1,
                entriesPerPage: 10,
                totalPages: 1,
                sortOrder: 'newest',
                loading: false,
                error: null
            },
            ui: {
                darkMode: localStorage.getItem('darkMode') === 'true',
                language: localStorage.getItem('titoLanguage') || 'en',
                timeGoalsEnabled: localStorage.getItem('timeGoalsEnabled') === 'true',
                currentTab: 'overallTime',
                dateRange: {
                    start: new Date(),
                    end: new Date(),
                    quickSelect: 'today'
                }
            },
            timeGoals: {
                items: [],
                loading: false,
                error: null
            }
        };

        this.subscribers = new Map();
        this.nextSubscriberId = 1;
    }

    // Subscription management
    subscribe(selector, callback) {
        const id = this.nextSubscriberId++;
        if (!this.subscribers.has(selector)) {
            this.subscribers.set(selector, new Map());
        }
        this.subscribers.get(selector).set(id, callback);
        
        // Initial call with current state
        const selectedState = this.select(selector);
        callback(selectedState);
        
        // Return unsubscribe function
        return () => {
            const selectorSubscribers = this.subscribers.get(selector);
            if (selectorSubscribers) {
                selectorSubscribers.delete(id);
                if (selectorSubscribers.size === 0) {
                    this.subscribers.delete(selector);
                }
            }
        };
    }

    // State selection
    select(selector) {
        const parts = selector.split('.');
        return parts.reduce((obj, key) => obj?.[key], this.state);
    }

    // State updates
    update(selector, value) {
        const parts = selector.split('.');
        const lastPart = parts.pop();
        let current = this.state;
        
        // Navigate to the correct part of the state
        for (const part of parts) {
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }

        // Update the value
        if (typeof value === 'function') {
            current[lastPart] = value(current[lastPart]);
        } else {
            current[lastPart] = value;
        }

        // Notify subscribers
        this.notifySubscribers(selector);
        
        // Special handling for persistent UI state
        if (selector.startsWith('ui.')) {
            this.persistUIState(selector, current[lastPart]);
        }
    }

    // Notify relevant subscribers
    notifySubscribers(updatedSelector) {
        this.subscribers.forEach((callbacks, selector) => {
            if (selector === updatedSelector || 
                updatedSelector.startsWith(selector + '.') || 
                selector.startsWith(updatedSelector + '.')) {
                const selectedState = this.select(selector);
                callbacks.forEach(callback => callback(selectedState));
            }
        });
    }

    // Batch updates
    batchUpdate(updates) {
        const affectedSelectors = new Set();
        
        updates.forEach(([selector, value]) => {
            const parts = selector.split('.');
            const lastPart = parts.pop();
            let current = this.state;
            
            for (const part of parts) {
                if (!(part in current)) {
                    current[part] = {};
                }
                current = current[part];
            }

            if (typeof value === 'function') {
                current[lastPart] = value(current[lastPart]);
            } else {
                current[lastPart] = value;
            }

            affectedSelectors.add(selector);
        });

        // Notify subscribers only once per unique selector
        affectedSelectors.forEach(selector => {
            this.notifySubscribers(selector);
            if (selector.startsWith('ui.')) {
                const value = this.select(selector);
                this.persistUIState(selector, value);
            }
        });
    }

    // UI state persistence
    persistUIState(selector, value) {
        switch (selector) {
            case 'ui.darkMode':
                localStorage.setItem('darkMode', value);
                document.documentElement.setAttribute('data-theme', value ? 'dark' : 'light');
                break;
            case 'ui.language':
                localStorage.setItem('titoLanguage', value);
                break;
            case 'ui.timeGoalsEnabled':
                localStorage.setItem('timeGoalsEnabled', value);
                document.body.classList.toggle('goals-enabled', value);
                break;
        }
    }

    // State reset
    reset() {
        this.state = this.getInitialState();
        this.subscribers.forEach((callbacks, selector) => {
            const selectedState = this.select(selector);
            callbacks.forEach(callback => callback(selectedState));
        });
    }

    // Get full state (useful for debugging)
    getState() {
        return { ...this.state };
    }

    // Example action creators
    actions = {
        startTimer: (projectId) => {
            this.batchUpdate([
                ['timer.isRunning', true],
                ['timer.startTime', Date.now()],
                ['timer.currentProjectId', projectId]
            ]);
        },

        stopTimer: () => {
            this.batchUpdate([
                ['timer.isRunning', false],
                ['timer.startTime', null],
                ['timer.elapsedTime', 0],
                ['timer.currentProjectId', null]
            ]);
        },

        setCurrentProject: (projectId) => {
            this.batchUpdate([
                ['projects.currentProjectId', projectId],
                ['timeEntries.currentPage', 1] // Reset pagination when switching projects
            ]);
        },

        updateTimeEntryPagination: (page, entriesPerPage) => {
            this.batchUpdate([
                ['timeEntries.currentPage', page],
                ['timeEntries.entriesPerPage', entriesPerPage]
            ]);
        },

        toggleDarkMode: () => {
            this.update('ui.darkMode', current => !current);
        },

        setLanguage: (language) => {
            this.update('ui.language', language);
        },

        setDateRange: (start, end, quickSelect) => {
            this.batchUpdate([
                ['ui.dateRange.start', start],
                ['ui.dateRange.end', end],
                ['ui.dateRange.quickSelect', quickSelect]
            ]);
        }
    };
}
