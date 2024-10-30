// src/core/timer.js
export class Timer {
    constructor() {
        this.isRunning = false;
        this.startTime = null;
        this.elapsedTime = 0;
        this.timerInterval = null;
        this.timerProject = null;
        this.callbacks = {
            onTick: () => {},
            onStart: () => {},
            onStop: () => {},
            onReset: () => {}
        };
    }

    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    start() {
        if (!this.timerProject) {
            throw new Error('No project selected for timer');
        }

        this.isRunning = true;
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            if (!this.isPaused && this.isRunning) {
                const currentTime = Date.now();
                this.elapsedTime = currentTime - this.startTime;
                this.callbacks.onTick(this.elapsedTime);
            }
        }, 1000);

        this.callbacks.onStart();
    }

    stop() {
        if (!this.isRunning) {
            throw new Error('Timer is not running');
        }

        clearInterval(this.timerInterval);
        this.isRunning = false;
        const stopTime = Date.now();
        const duration = stopTime - this.startTime;
        
        this.reset();
        this.callbacks.onStop(this.startTime, stopTime, duration);
    }

    reset() {
        this.elapsedTime = 0;
        this.startTime = null;
        this.isRunning = false;
        this.timerProject = null;
        clearInterval(this.timerInterval);
        this.callbacks.onReset();
    }

    setProject(projectId) {
        this.timerProject = projectId;
    }

    getProject() {
        return this.timerProject;
    }

    isRunning() {
        return this.isRunning;
    }
}

// src/main.js
import { Timer } from './core/timer';

// Create singleton instance
const timer = new Timer();

// Set up callbacks
timer.setCallbacks({
    onTick: (elapsedTime) => {
        const timeDisplay = document.getElementById('timeDisplay');
        if (timeDisplay) {
            timeDisplay.textContent = formatDuration(elapsedTime);
        }
    },
    onStart: () => {
        updateStartStopButton();
        updateTimerProjectDisplay();
    },
    onStop: async (startTime, stopTime, duration) => {
        try {
            await saveTimeEntry(startTime, stopTime);
            currentPage = 1;
            await loadTimeEntries();
            const timeEntryList = document.getElementById('timeEntryList');
            if (timeEntryList) {
                timeEntryList.scrollTop = 0;
            }
            visualizeProjectData();
        } catch (error) {
            log(LogLevel.ERROR, 'Error saving time entry:', error);
            showError('Failed to save time entry when stopping timer');
        }
    },
    onReset: () => {
        const timeDisplay = document.getElementById('timeDisplay');
        if (timeDisplay) {
            timeDisplay.textContent = '00:00:00';
        }
        updateStartStopButton();
        updateTimerProjectDisplay();
    }
});
