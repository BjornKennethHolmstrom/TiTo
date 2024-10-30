// src/features/goals.js
export class GoalsFeature {
    constructor(timeEntryManager, projectManager, stateManager, translationManager) {
        this.timeEntryManager = timeEntryManager;
        this.projectManager = projectManager;
        this.state = stateManager;
        this.translator = translationManager;

        this.initializeState();
        this.setupSubscriptions();
    }

    initializeState() {
        this.state.batchUpdate([
            ['goals', {
                enabled: localStorage.getItem('timeGoalsEnabled') === 'true',
                items: [], // Project-specific goals
                overall: null, // Overall goal
                progress: {
                    byProject: {},
                    overall: 0
                },
                notifications: [],
                loading: false,
                error: null
            }]
        ]);
    }

    setupSubscriptions() {
        // Update progress when time entries change
        this.state.subscribe('timeEntries.items', () => {
            this.updateAllProgress();
        });

        // Enable/disable goals
        this.state.subscribe('goals.enabled', (enabled) => {
            localStorage.setItem('timeGoalsEnabled', enabled);
            document.body.classList.toggle('goals-enabled', enabled);
        });
    }

    // Goal management
    async setProjectGoal(projectId, hours, period) {
        try {
            this.state.update('goals.loading', true);

            const project = await this.projectManager.getProject(projectId);
            if (!project) {
                throw new Error(this.translator.translate('projectNotFound'));
            }

            if (!this.validateGoalInput(hours, period)) {
                throw new Error(this.translator.translate('invalidGoalInput'));
            }

            const goal = {
                projectId,
                hours: parseFloat(hours),
                period,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Update goals array
            const currentGoals = this.state.select('goals.items');
            const existingIndex = currentGoals.findIndex(g => g.projectId === projectId);

            let updatedGoals;
            if (existingIndex !== -1) {
                updatedGoals = [
                    ...currentGoals.slice(0, existingIndex),
                    goal,
                    ...currentGoals.slice(existingIndex + 1)
                ];
            } else {
                updatedGoals = [...currentGoals, goal];
            }

            this.state.batchUpdate([
                ['goals.items', updatedGoals],
                ['goals.loading', false],
                ['goals.error', null]
            ]);

            await this.updateProjectProgress(projectId);
            this.checkGoalProgress(projectId);

        } catch (error) {
            this.state.batchUpdate([
                ['goals.loading', false],
                ['goals.error', error.message]
            ]);
            throw error;
        }
    }

    async setOverallGoal(hours, period) {
        try {
            this.state.update('goals.loading', true);

            if (!this.validateGoalInput(hours, period)) {
                throw new Error(this.translator.translate('invalidGoalInput'));
            }

            const goal = {
                hours: parseFloat(hours),
                period,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.state.batchUpdate([
                ['goals.overall', goal],
                ['goals.loading', false],
                ['goals.error', null]
            ]);

            await this.updateOverallProgress();
            this.checkOverallProgress();

        } catch (error) {
            this.state.batchUpdate([
                ['goals.loading', false],
                ['goals.error', error.message]
            ]);
            throw error;
        }
    }

    async removeProjectGoal(projectId) {
        try {
            const currentGoals = this.state.select('goals.items');
            const updatedGoals = currentGoals.filter(g => g.projectId !== projectId);

            this.state.batchUpdate([
                ['goals.items', updatedGoals],
                ['goals.progress.byProject', {
                    ...this.state.select('goals.progress.byProject'),
                    [projectId]: null
                }]
            ]);
        } catch (error) {
            this.state.update('goals.error', error.message);
            throw error;
        }
    }

    async removeOverallGoal() {
        try {
            this.state.batchUpdate([
                ['goals.overall', null],
                ['goals.progress.overall', 0]
            ]);
        } catch (error) {
            this.state.update('goals.error', error.message);
            throw error;
        }
    }

    // Progress calculation
    async updateProjectProgress(projectId) {
        const goal = this.state.select('goals.items')
            .find(g => g.projectId === projectId);

        if (!goal) return;

        const timeSpent = await this.calculateTimeSpentForPeriod(
            projectId,
            goal.period
        );

        const progress = (timeSpent / (goal.hours * 3600000)) * 100;

        this.state.update('goals.progress.byProject', current => ({
            ...current,
            [projectId]: Math.min(progress, 100)
        }));
    }

    async updateOverallProgress() {
        const goal = this.state.select('goals.overall');
        if (!goal) return;

        const timeSpent = await this.calculateOverallTimeSpentForPeriod(goal.period);
        const progress = (timeSpent / (goal.hours * 3600000)) * 100;

        this.state.update('goals.progress.overall', Math.min(progress, 100));
    }

    async updateAllProgress() {
        const goals = this.state.select('goals.items');
        const promises = goals.map(goal => this.updateProjectProgress(goal.projectId));
        await Promise.all(promises);
        await this.updateOverallProgress();
    }

    // Time calculations
    async calculateTimeSpentForPeriod(projectId, period) {
        const { start, end } = this.getPeriodDates(period);
        const entries = await this.timeEntryManager.getEntriesInDateRange(
            start,
            end,
            [projectId]
        );

        return entries.reduce((total, entry) => total + entry.duration, 0);
    }

    async calculateOverallTimeSpentForPeriod(period) {
        const { start, end } = this.getPeriodDates(period);
        const entries = await this.timeEntryManager.getEntriesInDateRange(
            start,
            end
        );

        return entries.reduce((total, entry) => total + entry.duration, 0);
    }

    // Progress monitoring and notifications
    checkGoalProgress(projectId) {
        const progress = this.state.select('goals.progress.byProject')[projectId];
        if (!progress) return;

        if (progress >= 100) {
            this.addNotification({
                type: 'success',
                message: this.translator.translate('goalAchieved', {
                    project: this.getProjectName(projectId)
                })
            });
        } else if (progress >= 90) {
            this.addNotification({
                type: 'warning',
                message: this.translator.translate('goalNearlyAchieved', {
                    project: this.getProjectName(projectId),
                    progress: Math.floor(progress)
                })
            });
        }
    }

    checkOverallProgress() {
        const progress = this.state.select('goals.progress.overall');
        if (progress >= 100) {
            this.addNotification({
                type: 'success',
                message: this.translator.translate('overallGoalAchieved')
            });
        } else if (progress >= 90) {
            this.addNotification({
                type: 'warning',
                message: this.translator.translate('overallGoalNearlyAchieved', {
                    progress: Math.floor(progress)
                })
            });
        }
    }

    // Notification management
    addNotification(notification) {
        const notifications = this.state.select('goals.notifications');
        this.state.update('goals.notifications', [
            ...notifications,
            {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                ...notification
            }
        ]);

        // Auto-remove notification after 5 seconds
        setTimeout(() => {
            this.removeNotification(notification.id);
        }, 5000);
    }

    removeNotification(id) {
        const notifications = this.state.select('goals.notifications');
        this.state.update(
            'goals.notifications',
            notifications.filter(n => n.id !== id)
        );
    }

    // Utility functions
    validateGoalInput(hours, period) {
        if (!hours || isNaN(hours) || hours <= 0) {
            return false;
        }

        if (!['daily', 'weekly', 'monthly'].includes(period)) {
            return false;
        }

        return true;
    }

    getPeriodDates(period) {
        const now = new Date();
        let start = new Date(now);
        
        switch (period) {
            case 'daily':
                start.setHours(0, 0, 0, 0);
                break;
            case 'weekly':
                start.setDate(now.getDate() - now.getDay());
                start.setHours(0, 0, 0, 0);
                break;
            case 'monthly':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                break;
            default:
                throw new Error(this.translator.translate('invalidPeriod'));
        }

        return {
            start,
            end: now
        };
    }

    getProjectName(projectId) {
        const projects = this.state.select('projects.items');
        return projects.find(p => p.id === projectId)?.name || 
            this.translator.translate('unknownProject');
    }

    // Export goals data
    async exportGoalsData() {
        const goals = {
            overall: this.state.select('goals.overall'),
            projects: await Promise.all(
                this.state.select('goals.items').map(async goal => {
                    const timeSpent = await this.calculateTimeSpentForPeriod(
                        goal.projectId,
                        goal.period
                    );
                    return {
                        ...goal,
                        projectName: this.getProjectName(goal.projectId),
                        timeSpent,
                        progress: this.state.select('goals.progress.byProject')[goal.projectId]
                    };
                })
            )
        };

        if (goals.overall) {
            const overallTimeSpent = await this.calculateOverallTimeSpentForPeriod(
                goals.overall.period
            );
            goals.overall = {
                ...goals.overall,
                timeSpent: overallTimeSpent,
                progress: this.state.select('goals.progress.overall')
            };
        }

        return goals;
    }
}
