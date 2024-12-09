// ui/components/TimerDisplay/index.js
class TimerDisplay {
    constructor(timerFeature, stateManager, translationManager, container) {
        this.timerFeature = titoTimerFeature;
        this.state = stateManager;
        this.translator = translationManager;
        this.container = container;
        
        // Create DOM elements
        this.elements = {
            timeDisplay: null,
            projectDisplay: null,
            startStopButton: null,
            errorMessage: null
        };

        // Initialize the component
        this.initialize();
    }

    initialize() {
        // Create component structure
        this.container.innerHTML = `
            <div class="timer-section">
                <h2 class="timer-heading" data-i18n="timerHeading">Timer</h2>
                
                <div class="button-container">
                    <button id="startStopButton" class="timer-button" aria-label="${this.translator.translate('startTimer')}">
                        <img src="icons/start-light.svg" class="icon-light" alt="Start">
                        <img src="icons/start-dark.svg" class="icon-dark" alt="Start">
                    </button>
                </div>

                <div id="timeDisplay" class="time-display" aria-live="polite" aria-atomic="true">
                    00:00:00
                </div>

                <div id="timerProjectDisplay" class="project-display" aria-live="polite" aria-atomic="true"></div>
                
                <div id="timerError" class="error-message hidden"></div>
            </div>
        `;

        // Cache element references
        this.elements = {
            timeDisplay: this.container.querySelector('#timeDisplay'),
            projectDisplay: this.container.querySelector('#timerProjectDisplay'),
            startStopButton: this.container.querySelector('#startStopButton'),
            errorMessage: this.container.querySelector('#timerError')
        };

        // Add event listeners
        this.elements.startStopButton.addEventListener('click', () => this.handleStartStop());
        
        // Subscribe to state changes
        this.state.subscribe('timer.isRunning', isRunning => this.updateTimerState(isRunning));
        this.state.subscribe('timer.elapsedTime', time => this.updateTimeDisplay(time));
        this.state.subscribe('timer.error', error => this.showError(error));
    }

    handleStartStop() {
        try {
            if (this.timerFeature.isRunning()) {
                this.timerFeature.stop();
            } else {
                this.timerFeature.start();
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    updateTimerState(isRunning) {
        const button = this.elements.startStopButton;
        const lightIcon = button.querySelector('.icon-light');
        const darkIcon = button.querySelector('.icon-dark');

        if (isRunning) {
            lightIcon.src = 'icons/stop-light.svg';
            darkIcon.src = 'icons/stop-dark.svg';
            lightIcon.alt = darkIcon.alt = this.translator.translate('stopTimer');
            button.setAttribute('aria-label', this.translator.translate('stopTimer'));
        } else {
            lightIcon.src = 'icons/start-light.svg';
            darkIcon.src = 'icons/start-dark.svg';
            lightIcon.alt = darkIcon.alt = this.translator.translate('startTimer');
            button.setAttribute('aria-label', this.translator.translate('startTimer'));
        }
    }

    updateTimeDisplay(elapsedTime) {
        if (!this.elements.timeDisplay) return;

        const formatted = this.formatTime(elapsedTime);
        this.elements.timeDisplay.textContent = formatted;

        // Update project display if timer is running
        if (this.timerFeature.isRunning()) {
            const projectName = this.timerFeature.getCurrentProjectName();
            if (projectName) {
                this.elements.projectDisplay.textContent = 
                    `${this.translator.translate('timerRunningFor')}: ${projectName}`;
                this.elements.projectDisplay.classList.remove('hidden');
            }
        } else {
            this.elements.projectDisplay.textContent = '';
            this.elements.projectDisplay.classList.add('hidden');
        }
    }

    formatTime(ms) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    showError(error) {
        if (!error) {
            this.elements.errorMessage.classList.add('hidden');
            return;
        }

        this.elements.errorMessage.textContent = error;
        this.elements.errorMessage.classList.remove('hidden');

        // Auto-hide error after 5 seconds
        setTimeout(() => {
            this.elements.errorMessage.classList.add('hidden');
        }, 5000);
    }

    // Public methods for external control
    destroy() {
        // Clean up event listeners and subscriptions
        this.elements.startStopButton.removeEventListener('click', this.handleStartStop);
        // State manager unsubscribe would be handled here if implemented
    }

    updateTranslations() {
        this.container.querySelector('[data-i18n="timerHeading"]').textContent = 
            this.translator.translate('timerHeading');
        this.updateTimerState(this.timerFeature.isRunning());
    }
}
