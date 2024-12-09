// src/core/state.js
(function(window) {
    'use strict';

    class StateManager {
        constructor() {
            // Initial state structure
            this.state = {
                timer: {
                    isRunning: false,
                    startTime: null,
                    elapsedTime: 0,
                    currentProjectId: null,
                    loading: false,
                    error: null
                },
                projects: {
                    items: [],
                    currentProjectId: null,
                    loading: false,
                    error: null
                },
                timeEntries: {
                    items: [],
                    filteredItems: [],
                    currentPage: 1,
                    entriesPerPage: 10,
                    totalPages: 1,
                    sortOrder: 'newest',
                    dateRange: {
                        start: null,
                        end: null
                    },
                    loading: false,
                    error: null,
                    filters: {
                        description: '',
                        dateRange: null,
                        projectId: null
                    }
                },
                goals: {
                    enabled: localStorage.getItem('timeGoalsEnabled') === 'true',
                    items: [],
                    overall: null,
                    progress: {
                        byProject: {},
                        overall: 0
                    },
                    notifications: [],
                    loading: false,
                    error: null
                },
                theme: {
                    current: localStorage.getItem('theme') || 'light',
                    systemPreference: null,
                    autoDetect: localStorage.getItem('themeAutoDetect') === 'true',
                    loading: false,
                    error: null
                },
                settings: {
                    current: null,
                    previousSettings: null,
                    unsavedChanges: false,
                    loading: false,
                    error: null
                },
                ui: {
                    currentTab: 'overallTime',
                    modals: {
                        info: false,
                        help: false
                    },
                    notifications: []
                }
            };

            this.subscribers = new Map();
            this.nextSubscriberId = 1;

            // Debug mode for development
            this.debugMode = false;
            
            // Initialize debug mode from URL parameter
            if (window.location.search.includes('debug=true')) {
                this.enableDebugMode();
            }
        }

        // Enable debug logging
        enableDebugMode() {
            this.debugMode = true;
            console.info('State Manager Debug Mode Enabled');
        }

        // Debug log helper
        debugLog(action, path, value) {
            if (this.debugMode) {
                console.log(`[State] ${action}:`, { path, value });
            }
        }

        // Subscription management
        subscribe(selector, callback) {
            if (typeof callback !== 'function') {
                console.error('Subscriber callback must be a function');
                return () => {};
            }

            if (!this.subscribers.has(selector)) {
                this.subscribers.set(selector, new Map());
            }

            const id = this.nextSubscriberId++;
            this.subscribers.get(selector).set(id, callback);

            // Initial call with current state
            const selectedState = this.select(selector);
            try {
                callback(selectedState);
            } catch (error) {
                console.error(`Error in subscriber callback for ${selector}:`, error);
            }

            this.debugLog('Subscribe', selector, { id, subscribersCount: this.subscribers.get(selector).size });

            // Return unsubscribe function
            return () => {
                const selectorSubscribers = this.subscribers.get(selector);
                if (selectorSubscribers) {
                    selectorSubscribers.delete(id);
                    if (selectorSubscribers.size === 0) {
                        this.subscribers.delete(selector);
                    }
                    this.debugLog('Unsubscribe', selector, { id });
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
            this.debugLog('Update', selector, value);

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

            // Special handling for persistent state
            if (selector.startsWith('theme.') || 
                selector.startsWith('goals.enabled') || 
                selector.startsWith('settings.')) {
                this.persistState(selector, current[lastPart]);
            }
        }

        // Batch updates
        batchUpdate(updates) {
            this.debugLog('Batch Update', 'multiple', updates);

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

                // Handle persistent state
                if (selector.startsWith('theme.') || 
                    selector.startsWith('goals.enabled') || 
                    selector.startsWith('settings.')) {
                    const value = this.select(selector);
                    this.persistState(selector, value);
                }
            });
        }

        // Notify relevant subscribers
        notifySubscribers(updatedSelector) {
            this.subscribers.forEach((callbacks, selector) => {
                if (selector === updatedSelector || 
                    updatedSelector.startsWith(selector + '.') || 
                    selector.startsWith(updatedSelector + '.')) {
                    const selectedState = this.select(selector);
                    callbacks.forEach(callback => {
                        try {
                            callback(selectedState);
                        } catch (error) {
                            console.error(`Error in subscriber callback for ${selector}:`, error);
                        }
                    });
                }
            });
        }

        // Persist state to localStorage
        persistState(selector, value) {
            try {
                switch (selector) {
                    case 'theme.current':
                        localStorage.setItem('theme', value);
                        document.documentElement.setAttribute('data-theme', value);
                        break;
                    case 'theme.autoDetect':
                        localStorage.setItem('themeAutoDetect', value);
                        break;
                    case 'goals.enabled':
                        localStorage.setItem('timeGoalsEnabled', value);
                        document.body.classList.toggle('goals-enabled', value);
                        break;
                    case 'settings.current':
                        localStorage.setItem('titoSettings', JSON.stringify(value));
                        break;
                    default:
                        if (this.debugMode) {
                            console.log(`No persistence handler for selector: ${selector}`);
                        }
                }
            } catch (error) {
                console.error(`Error persisting state for ${selector}:`, error);
            }
        }

        // Reset state
        reset() {
            this.debugLog('Reset', 'all', null);

            // Create fresh state
            const newState = new StateManager().state;

            // Keep certain values
            newState.theme.current = this.state.theme.current;
            newState.theme.autoDetect = this.state.theme.autoDetect;
            newState.goals.enabled = this.state.goals.enabled;

            this.state = newState;

            // Notify all subscribers
            this.subscribers.forEach((callbacks, selector) => {
                const selectedState = this.select(selector);
                callbacks.forEach(callback => {
                    try {
                        callback(selectedState);
                    } catch (error) {
                        console.error(`Error in subscriber callback for ${selector}:`, error);
                    }
                });
            });
        }

        // Get full state (for debugging)
        getState() {
            return { ...this.state };
        }

        // Debug helper to log all subscriptions
        logSubscriptions() {
            if (this.debugMode) {
                console.log('Current Subscriptions:');
                this.subscribers.forEach((callbacks, selector) => {
                    console.log(`${selector}: ${callbacks.size} subscribers`);
                });
            }
        }
    }

    // Create global instance
    window.titoState = new StateManager();

})(window);
