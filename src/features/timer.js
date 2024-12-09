// src/features/timer.js
(function(window) {
    'use strict';

    class TimerFeature {
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
            if (!window.titoTimeEntryManager) {
                throw new Error('Time Entry Manager not found');
            }

            // Initialize service references
            this.db = window.titoDatabase;
            this.state = window.titoState;
            this.translator = window.titoTranslator;
            this.timeEntryManager = window.titoTimeEntryManager;

            // Timer properties
            this.timerInterval = null;

            // Debug mode
            this.debugMode = window.location.search.includes('debug=true');

            // Initialize state
            this.initializeState();

            // Handle page visibility changes
            this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
            document.addEventListener('visibilitychange', this.handleVisibilityChange);

            // Handle before unload to save timer state
            window.addEventListener('beforeunload', () => this.saveTimerState());

            // Try to restore timer state
            this.restoreTimerState();
        }

        initializeState() {
            this.state.update('timer', {
                isRunning: false,
                startTime: null,
                currentTime: null,
                elapsedTime: 0,
                projectId: null,
                loading: false,
                error: null
            });
        }

        start() {
            try {
                const currentProjectId = this.state.select('projects.currentProjectId');
                if (!currentProjectId) {
                    throw new Error(this.translator.translate('selectProjectFirst'));
                }

                const now = Date.now();
                this.state.batchUpdate([
                    ['timer.isRunning', true],
                    ['timer.startTime', now],
                    ['timer.currentTime', now],
                    ['timer.projectId', currentProjectId],
                    ['timer.error', null]
                ]);

                // Start interval for updating elapsed time
                this.timerInterval = setInterval(() => {
                    const currentTime = Date.now();
                    const startTime = this.state.select('timer.startTime');
                    
                    this.state.batchUpdate([
                        ['timer.currentTime', currentTime],
                        ['timer.elapsedTime', currentTime - startTime]
                    ]);
                }, 1000);

                this.saveTimerState();
                this.debugLog('Timer started', { projectId: currentProjectId });

            } catch (error) {
                this.state.update('timer.error', error.message);
                throw error;
            }
        }

        async stop() {
            try {
                if (!this.state.select('timer.isRunning')) {
                    throw new Error(this.translator.translate('timerNotRunning'));
                }

                // Clear interval first to prevent updates during saving
                this.clearInterval();

                this.state.update('timer.loading', true);

                const timerState = this.state.select('timer');
                
                // Save time entry
                await this.timeEntriesFeature.addEntry({
                    start: new Date(timerState.startTime),
                    end: new Date(timerState.currentTime)
                });

                // Reset timer state
                this.reset();
                
                // Clear saved state
                localStorage.removeItem('titoTimerState');

                this.debugLog('Timer stopped');

            } catch (error) {
                this.state.batchUpdate([
                    ['timer.loading', false],
                    ['timer.error', error.message]
                ]);
                throw error;
            }
        }

        reset() {
            this.clearInterval();
            
            this.state.batchUpdate([
                ['timer.isRunning', false],
                ['timer.startTime', null],
                ['timer.currentTime', null],
                ['timer.elapsedTime', 0],
                ['timer.projectId', null],
                ['timer.loading', false],
                ['timer.error', null]
            ]);

            localStorage.removeItem('titoTimerState');
            this.debugLog('Timer reset');
        }

        handleVisibilityChange() {
            if (document.hidden) {
                // Page is hidden, save state and clear interval
                if (this.state.select('timer.isRunning')) {
                    this.clearInterval();
                    this.saveTimerState();
                }
            } else {
                // Page is visible again
                if (this.state.select('timer.isRunning')) {
                    // Recalculate elapsed time
                    const currentTime = Date.now();
                    const startTime = this.state.select('timer.startTime');
                    
                    this.state.batchUpdate([
                        ['timer.currentTime', currentTime],
                        ['timer.elapsedTime', currentTime - startTime]
                    ]);

                    // Restart interval
                    this.timerInterval = setInterval(() => {
                        const currentTime = Date.now();
                        const startTime = this.state.select('timer.startTime');
                        
                        this.state.batchUpdate([
                            ['timer.currentTime', currentTime],
                            ['timer.elapsedTime', currentTime - startTime]
                        ]);
                    }, 1000);
                }
            }
        }

        saveTimerState() {
            if (this.state.select('timer.isRunning')) {
                const state = {
                    isRunning: this.state.select('timer.isRunning'),
                    startTime: this.state.select('timer.startTime'),
                    projectId: this.state.select('timer.projectId')
                };
                localStorage.setItem('titoTimerState', JSON.stringify(state));
                this.debugLog('Timer state saved');
            }
        }

        restoreTimerState() {
            const savedState = localStorage.getItem('titoTimerState');
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    if (state.isRunning && state.startTime && state.projectId) {
                        this.state.batchUpdate([
                            ['timer.isRunning', true],
                            ['timer.startTime', state.startTime],
                            ['timer.projectId', state.projectId]
                        ]);

                        // Update elapsed time
                        const currentTime = Date.now();
                        this.state.batchUpdate([
                            ['timer.currentTime', currentTime],
                            ['timer.elapsedTime', currentTime - state.startTime]
                        ]);

                        // Start interval
                        this.timerInterval = setInterval(() => {
                            const currentTime = Date.now();
                            this.state.batchUpdate([
                                ['timer.currentTime', currentTime],
                                ['timer.elapsedTime', currentTime - state.startTime]
                            ]);
                        }, 1000);

                        this.debugLog('Timer state restored');
                    }
                } catch (error) {
                    console.error('Error restoring timer state:', error);
                    localStorage.removeItem('titoTimerState');
                }
            }
        }

        clearInterval() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }

        getCurrentProject() {
            return this.state.select('timer.projectId');
        }

        getCurrentProjectName() {
            const projectId = this.getCurrentProject();
            if (!projectId) return null;

            const projects = this.state.select('projects.items');
            const project = projects.find(p => p.id === projectId);
            return project ? project.name : null;
        }

        formatTime(duration) {
            const hours = Math.floor(duration / 3600000);
            const minutes = Math.floor((duration % 3600000) / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);
            
            return {
                hours: String(hours).padStart(2, '0'),
                minutes: String(minutes).padStart(2, '0'),
                seconds: String(seconds).padStart(2, '0'),
                formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            };
        }

        getElapsedTime() {
            return this.state.select('timer.elapsedTime');
        }

        isRunning() {
            return this.state.select('timer.isRunning');
        }

        isLoading() {
            return this.state.select('timer.loading');
        }

        getError() {
            return this.state.select('timer.error');
        }

        debugLog(action, data = null) {
            if (this.debugMode) {
                console.log(`[Timer] ${action}:`, data);
            }
        }

        destroy() {
            this.clearInterval();
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
            window.removeEventListener('beforeunload', this.saveTimerState);
        }
    }

    // Create global instance
    window.titoTimerFeature = new TimerFeature();

})(window);
