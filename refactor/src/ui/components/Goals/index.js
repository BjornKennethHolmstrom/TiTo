// src/ui/components/Goals/index.js
class Goals {
    constructor(goalsFeature, stateManager, translationManager, container) {
        this.goalsFeature = goalsFeature;
        this.state = stateManager;
        this.translator = translationManager;
        this.container = container;

        this.elements = {
            addProjectGoal: null,
            projectSelect: null,
            hoursInput: null,
            periodSelect: null,
            overallHoursInput: null,
            overallPeriodSelect: null,
            projectGoalsList: null,
            errorMessage: null,
            notifications: null
        };

        this.initialize();
    }

    initialize() {
        // Create component structure
        this.container.innerHTML = this.createGoalsHTML();
        
        // Cache element references
        this.cacheElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Subscribe to state changes
        this.setupStateSubscriptions();

        // Load initial goals
        this.loadGoals();
    }

    createGoalsHTML() {
        return `
            <div class="goals-container">
                <div class="goals-header">
                    <h2 data-i18n="timeGoals">Time Goals</h2>
                    <div class="goals-toggle">
                        <label class="toggle-label">
                            <input type="checkbox" id="goalsEnabled">
                            <span data-i18n="enableGoals">Enable Goals</span>
                        </label>
                    </div>
                </div>

                <div class="goals-content hidden">
                    <!-- Overall Goal Section -->
                    <section class="overall-goal-section">
                        <h3 data-i18n="overallGoal">Overall Goal</h3>
                        <div class="goal-form">
                            <input type="number" 
                                id="overallHours" 
                                class="hours-input" 
                                min="0" 
                                step="0.5" 
                                placeholder="${this.translator.translate('hoursPlaceholder')}">
                            <select id="overallPeriod" class="period-select">
                                <option value="daily" data-i18n="daily">Daily</option>
                                <option value="weekly" data-i18n="weekly">Weekly</option>
                                <option value="monthly" data-i18n="monthly">Monthly</option>
                            </select>
                            <button type="button" class="set-goal-button" data-i18n="setGoal">
                                Set Goal
                            </button>
                        </div>
                        <div class="overall-goal-display"></div>
                    </section>

                    <!-- Project Goals Section -->
                    <section class="project-goals-section">
                        <h3 data-i18n="projectGoals">Project Goals</h3>
                        <div class="goal-form">
                            <select id="projectSelect" class="project-select">
                                <option value="" data-i18n="selectProject">Select Project</option>
                            </select>
                            <input type="number" 
                                id="projectHours" 
                                class="hours-input" 
                                min="0" 
                                step="0.5" 
                                placeholder="${this.translator.translate('hoursPlaceholder')}">
                            <select id="projectPeriod" class="period-select">
                                <option value="daily" data-i18n="daily">Daily</option>
                                <option value="weekly" data-i18n="weekly">Weekly</option>
                                <option value="monthly" data-i18n="monthly">Monthly</option>
                            </select>
                            <button type="button" class="add-goal-button" data-i18n="addGoal">
                                Add Goal
                            </button>
                        </div>
                        <div class="project-goals-list"></div>
                    </section>
                </div>

                <div class="goals-error hidden"></div>
                <div class="goals-notifications"></div>
            </div>
        `;
    }

    cacheElements() {
        // Form elements
        this.elements.goalsEnabled = this.container.querySelector('#goalsEnabled');
        this.elements.goalsContent = this.container.querySelector('.goals-content');
        
        // Overall goal elements
        this.elements.overallHoursInput = this.container.querySelector('#overallHours');
        this.elements.overallPeriodSelect = this.container.querySelector('#overallPeriod');
        this.elements.overallGoalDisplay = this.container.querySelector('.overall-goal-display');
        
        // Project goal elements
        this.elements.projectSelect = this.container.querySelector('#projectSelect');
        this.elements.projectHoursInput = this.container.querySelector('#projectHours');
        this.elements.projectPeriodSelect = this.container.querySelector('#projectPeriod');
        this.elements.projectGoalsList = this.container.querySelector('.project-goals-list');
        
        // Message elements
        this.elements.errorMessage = this.container.querySelector('.goals-error');
        this.elements.notifications = this.container.querySelector('.goals-notifications');
    }

    setupEventListeners() {
        // Goals toggle
        this.elements.goalsEnabled.addEventListener('change', (e) => {
            this.toggleGoals(e.target.checked);
        });

        // Overall goal form
        this.container.querySelector('.set-goal-button').addEventListener('click', () => {
            this.handleSetOverallGoal();
        });

        // Project goal form
        this.container.querySelector('.add-goal-button').addEventListener('click', () => {
            this.handleAddProjectGoal();
        });
    }

    setupStateSubscriptions() {
        this.state.subscribe('goals.enabled', enabled => {
            this.elements.goalsEnabled.checked = enabled;
            this.elements.goalsContent.classList.toggle('hidden', !enabled);
        });

        this.state.subscribe('goals.items', goals => {
            this.renderProjectGoals(goals);
        });

        this.state.subscribe('goals.overall', goal => {
            this.renderOverallGoal(goal);
        });

        this.state.subscribe('goals.progress', progress => {
            this.updateGoalProgress(progress);
        });

        this.state.subscribe('goals.notifications', notifications => {
            this.renderNotifications(notifications);
        });

        this.state.subscribe('projects.items', projects => {
            this.updateProjectSelect(projects);
        });
    }

    async loadGoals() {
        try {
            await this.goalsFeature.loadTimeGoals();
        } catch (error) {
            this.showError(error.message);
        }
    }

    async toggleGoals(enabled) {
        try {
            await this.goalsFeature.toggleGoals(enabled);
        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleSetOverallGoal() {
        const hours = this.elements.overallHoursInput.value;
        const period = this.elements.overallPeriodSelect.value;

        if (!hours || hours <= 0) {
            this.showError(this.translator.translate('invalidHours'));
            return;
        }

        try {
            await this.goalsFeature.setOverallGoal(parseFloat(hours), period);
            
            // Clear form
            this.elements.overallHoursInput.value = '';
        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleAddProjectGoal() {
        const projectId = this.elements.projectSelect.value;
        const hours = this.elements.projectHoursInput.value;
        const period = this.elements.projectPeriodSelect.value;

        if (!projectId) {
            this.showError(this.translator.translate('selectProject'));
            return;
        }

        if (!hours || hours <= 0) {
            this.showError(this.translator.translate('invalidHours'));
            return;
        }

        try {
            await this.goalsFeature.setProjectGoal(parseInt(projectId), parseFloat(hours), period);
            
            // Clear form
            this.elements.projectSelect.value = '';
            this.elements.projectHoursInput.value = '';
        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleRemoveGoal(goalId) {
        try {
            await this.goalsFeature.removeGoal(goalId);
        } catch (error) {
            this.showError(error.message);
        }
    }

    renderOverallGoal(goal) {
        if (!goal) {
            this.elements.overallGoalDisplay.innerHTML = '';
            return;
        }

        this.elements.overallGoalDisplay.innerHTML = `
            <div class="goal-card">
                <div class="goal-header">
                    <span class="goal-title" data-i18n="overallGoal">Overall Goal</span>
                    <button type="button" class="remove-goal-button" data-goal-id="overall">×</button>
                </div>
                <div class="goal-details">
                    <span class="goal-target">
                        ${goal.hours} ${this.translator.translate('hoursGoal')} 
                        ${this.translator.translate(goal.period)}
                    </span>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${goal.progress || 0}%"></div>
                    </div>
                    <span class="progress-text">${Math.round(goal.progress || 0)}%</span>
                </div>
            </div>
        `;

        // Add remove event listener
        this.elements.overallGoalDisplay.querySelector('.remove-goal-button')
            .addEventListener('click', () => this.handleRemoveGoal('overall'));
    }

    renderProjectGoals(goals) {
        this.elements.projectGoalsList.innerHTML = goals.map(goal => `
            <div class="goal-card">
                <div class="goal-header">
                    <span class="goal-title">${goal.projectName}</span>
                    <button type="button" class="remove-goal-button" data-goal-id="${goal.projectId}">×</button>
                </div>
                <div class="goal-details">
                    <span class="goal-target">
                        ${goal.hours} ${this.translator.translate('hoursGoal')} 
                        ${this.translator.translate(goal.period)}
                    </span>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${goal.progress || 0}%"></div>
                    </div>
                    <span class="progress-text">${Math.round(goal.progress || 0)}%</span>
                </div>
            </div>
        `).join('');

        // Add remove event listeners
        this.elements.projectGoalsList.querySelectorAll('.remove-goal-button')
            .forEach(button => {
                button.addEventListener('click', () => {
                    this.handleRemoveGoal(button.dataset.goalId);
                });
            });
    }

    updateGoalProgress(progress) {
        // Update overall goal progress
        const overallFill = this.elements.overallGoalDisplay
            .querySelector('.progress-fill');
        const overallText = this.elements.overallGoalDisplay
            .querySelector('.progress-text');
            
        if (overallFill && overallText) {
            overallFill.style.width = `${progress.overall || 0}%`;
            overallText.textContent = `${Math.round(progress.overall || 0)}%`;
        }

        // Update project goals progress
        Object.entries(progress.byProject).forEach(([projectId, value]) => {
            const goalCard = this.elements.projectGoalsList
                .querySelector(`[data-goal-id="${projectId}"]`)
                ?.closest('.goal-card');
                
            if (goalCard) {
                const fill = goalCard.querySelector('.progress-fill');
                const text = goalCard.querySelector('.progress-text');
                
                fill.style.width = `${value || 0}%`;
                text.textContent = `${Math.round(value || 0)}%`;
            }
        });
    }

    updateProjectSelect(projects) {
        const currentValue = this.elements.projectSelect.value;
        
        this.elements.projectSelect.innerHTML = `
            <option value="" data-i18n="selectProject">
                ${this.translator.translate('selectProject')}
            </option>
            ${projects.map(project => `
                <option value="${project.id}">${project.name}</option>
            `).join('')}
        `;

        if (currentValue) {
            this.elements.projectSelect.value = currentValue;
        }
    }

    renderNotifications(notifications) {
        this.elements.notifications.innerHTML = notifications.map(notification => `
            <div class="notification ${notification.type}" role="alert">
                <span class="notification-message">${notification.message}</span>
                <button type="button" class="notification-dismiss" data-notification-id="${notification.id}">
                    ×
                </button>
            </div>
        `).join('');

        // Add dismiss event listeners
        this.elements.notifications.querySelectorAll('.notification-dismiss')
            .forEach(button => {
                button.addEventListener('click', () => {
                    this.goalsFeature.removeNotification(button.dataset.notificationId);
                });
            });
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        
        setTimeout(() => {
            this.elements.errorMessage.classList.add('hidden');
        }, 5000);
    }

    updateTranslations() {
        this.container.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.translator.translate(key);
        });
    }

    destroy() {
        // Remove event listeners
    }
}
