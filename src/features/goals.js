// src/features/goals.js
(function(window) {
    'use strict';

    class GoalsFeature {
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
            if (!window.titoProjectManager) {
                throw new Error('Project Manager not found');
            }

            // Initialize service references
            this.db = window.titoDatabase;
            this.state = window.titoState;
            this.translator = window.titoTranslator;
            this.timeEntryManager = window.titoTimeEntryManager;
            this.projectManager = window.titoProjectManager;

            // Initialize state
            this.state.update('goals', {
                enabled: localStorage.getItem('timeGoalsEnabled') === 'true',
                items: [],
                overall: null,
                progress: {
                    byProject: {},
                    overall: 0
                },
                notifications: []
            });

            // Debug mode
            this.debugMode = window.location.search.includes('debug=true');
        }

        async initialize() {
            try {
                await this.loadGoals();
                await this.updateAllProgress();
                this.debugLog('Goals feature initialized');
            } catch (error) {
                console.error('Failed to initialize goals:', error);
                throw error;
            }
        }

        async loadGoals() {
            try {
                this.state.update('goals.loading', true);
                
                // Load all goals from database
                const projectGoals = await this.db.getAll('timeGoals');
                const overallGoal = projectGoals.find(g => g.id === 'overall');
                const itemGoals = projectGoals.filter(g => g.id !== 'overall');

                this.state.batchUpdate([
                    ['goals.items', itemGoals],
                    ['goals.overall', overallGoal],
                    ['goals.loading', false]
                ]);

                this.debugLog('Goals loaded', { projectGoals: itemGoals, overallGoal });
            } catch (error) {
                console.error('Error loading goals:', error);
                this.state.update('goals.error', this.translator.translate('errorLoadingGoals'));
                throw error;
            }
        }

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

                // Save to database
                await this.db.add('timeGoals', goal);

                // Update state
                const currentGoals = this.state.select('goals.items');
                this.state.update('goals.items', [...currentGoals, goal]);

                await this.updateProjectProgress(projectId);
                this.checkGoalProgress(projectId);

                this.debugLog('Project goal set', goal);
            } catch (error) {
                console.error('Error setting project goal:', error);
                this.state.update('goals.error', error.message);
                throw error;
            } finally {
                this.state.update('goals.loading', false);
            }
        }

        async setOverallGoal(hours, period) {
            try {
                this.state.update('goals.loading', true);

                if (!this.validateGoalInput(hours, period)) {
                    throw new Error(this.translator.translate('invalidGoalInput'));
                }

                const goal = {
                    id: 'overall',
                    hours: parseFloat(hours),
                    period,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // Save to database
                await this.db.add('timeGoals', goal);

                // Update state
                this.state.update('goals.overall', goal);

                await this.updateOverallProgress();
                this.checkOverallProgress();

                this.debugLog('Overall goal set', goal);
            } catch (error) {
                console.error('Error setting overall goal:', error);
                this.state.update('goals.error', error.message);
                throw error;
            } finally {
                this.state.update('goals.loading', false);
            }
        }

        async removeGoal(goalId) {
            try {
                await this.db.delete('timeGoals', goalId);

                if (goalId === 'overall') {
                    this.state.batchUpdate([
                        ['goals.overall', null],
                        ['goals.progress.overall', 0]
                    ]);
                } else {
                    const currentGoals = this.state.select('goals.items');
                    this.state.update('goals.items', 
                        currentGoals.filter(g => g.projectId !== goalId)
                    );
                    
                    // Remove progress
                    const progress = this.state.select('goals.progress.byProject');
                    delete progress[goalId];
                    this.state.update('goals.progress.byProject', progress);
                }

                this.debugLog('Goal removed', { goalId });
            } catch (error) {
                console.error('Error removing goal:', error);
                this.state.update('goals.error', this.translator.translate('errorRemovingGoal'));
                throw error;
            }
        }

        async updateProjectProgress(projectId) {
            const goals = this.state.select('goals.items');
            const goal = goals.find(g => g.projectId === projectId);

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
            await Promise.all(goals.map(goal => this.updateProjectProgress(goal.projectId)));
            await this.updateOverallProgress();
        }

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

            return { start, end: now };
        }

        getProjectName(projectId) {
            const projects = this.projectManager.getAllProjects();
            const project = projects.find(p => p.id === projectId);
            return project ? project.name : this.translator.translate('unknownProject');
        }

        debugLog(action, data = null) {
            if (this.debugMode) {
                console.log(`[Goals] ${action}:`, data);
            }
        }
    }

    // Create global instance
    window.titoGoalsFeature = new GoalsFeature();

})(window);
