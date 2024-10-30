// src/features/timer.js
export class TimerFeature {
    constructor(timeEntryManager, projectManager, stateManager, translationManager) {
        this.timeEntryManager = timeEntryManager;
        this.projectManager = projectManager;
        this.state = stateManager;
        this.translator = translationManager;
        this.timerInterval = null;

        this.initializeState();
        this.setupSubscriptions();
    }

    initializeState() {
        this.state.batchUpdate([
            ['timer', {
                isRunning: false,
                startTime: null,
                currentTime: null,
                elapsedTime: 0,
                projectId: null,
                loading: false,
                error: null
            }]
        ]);
    }

    setupSubscriptions() {
        // Reset timer if current project is deleted
        this.state.subscribe('projects.items', (projects) => {
            const currentProjectId = this.state.select('timer.projectId');
            if (currentProjectId && !projects.find(p => p.id === currentProjectId)) {
                this.reset();
            }
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

        } catch (error) {
            this.state.update('timer.error', error.message);
            throw error;
        }
    }

    async stop() {
        try {
            const timerState = this.state.select('timer');
            if (!timerState.isRunning) {
                throw new Error(this.translator.translate('timerNotRunning'));
            }

            // Clear interval first to prevent updates during saving
            this.clearInterval();

            this.state.update('timer.loading', true);

            // Save time entry
            await this.timeEntryManager.addEntry({
                projectId: timerState.projectId,
                start: new Date(timerState.startTime),
                end: new Date(timerState.currentTime),
                duration: timerState.elapsedTime
            });

            // Reset timer state
            this.reset();
            
            // Update project statistics if needed
            await this.projectManager.updateProjectStatistics(timerState.projectId);

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
    }

    clearInterval() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    getCurrentProjectName() {
        const projectId = this.state.select('timer.projectId');
        if (!projectId) return null;

        const projects = this.state.select('projects.items');
        const project = projects.find(p => p.id === projectId);
        return project ? project.name : null;
    }

    getFormattedTime() {
        const elapsedTime = this.state.select('timer.elapsedTime');
        return this.formatDuration(elapsedTime);
    }

    // Utility function for time formatting
    formatDuration(duration) {
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

    // Manual time entry methods
    async addManualEntry(entry) {
        try {
            this.state.update('timer.loading', true);

            // Validate entry
            this.validateManualEntry(entry);

            // Calculate duration
            const start = new Date(entry.start);
            const end = new Date(entry.end);
            const duration = end.getTime() - start.getTime();

            // Add entry
            await this.timeEntryManager.addEntry({
                projectId: this.state.select('projects.currentProjectId'),
                start,
                end,
                duration,
                description: entry.description
            });

            this.state.batchUpdate([
                ['timer.loading', false],
                ['timer.error', null]
            ]);

        } catch (error) {
            this.state.batchUpdate([
                ['timer.loading', false],
                ['timer.error', error.message]
            ]);
            throw error;
        }
    }

    validateManualEntry(entry) {
        if (!entry.start || !entry.end) {
            throw new Error(this.translator.translate('invalidTimeRange'));
        }

        const start = new Date(entry.start);
        const end = new Date(entry.end);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error(this.translator.translate('invalidDateFormat'));
        }

        if (start >= end) {
            throw new Error(this.translator.translate('startAfterEnd'));
        }

        if (end > new Date()) {
            throw new Error(this.translator.translate('futureTimeEntry'));
        }

        return true;
    }

    // State checks
    isRunning() {
        return this.state.select('timer.isRunning');
    }

    isLoading() {
        return this.state.select('timer.loading');
    }

    getError() {
        return this.state.select('timer.error');
    }

    // Cleanup
    destroy() {
        this.clearInterval();
    }
}

