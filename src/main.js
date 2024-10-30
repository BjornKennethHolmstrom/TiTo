// src/main.js
import { Database } from './core/database';
import { ProjectManager } from './core/projectManager';
import { TimeEntryManager } from './core/timeEntryManager';
import { Timer } from './core/timer';
import { TranslationManager } from './core/translationManager';
import { TimerDisplay } from './ui/components/timerDisplay';
import { ProjectList } from './ui/components/projectList';
import { TimeEntryList } from './ui/components/timeEntryList';
import { Pagination } from './ui/components/pagination';

// Initialize core services
const database = new Database();
const translationManager = new TranslationManager();
const projectManager = new ProjectManager(database);
const timeEntryManager = new TimeEntryManager(database);
const timer = new Timer();

// Initialize UI components
const timerDisplay = new TimerDisplay(translationManager);
const projectList = new ProjectList('projectList', {
    onAddProject: async (name) => {
        try {
            await projectManager.addProject(name);
            await loadProjects();
        } catch (error) {
            showError(translationManager.translate('projectNameEmpty'));
        }
    },
    onSelectProject: async (projectId) => {
        const project = await projectManager.getProject(projectId);
        projectManager.setCurrentProject(project);
        timer.setProject(projectId);
        await loadTimeEntries();
    },
    onDeleteProject: async (projectId) => {
        if (confirm(translationManager.translate('confirmDeleteProject'))) {
            await projectManager.deleteProject(projectId);
            await loadProjects();
        }
    },
    onReorderProjects: async (fromIndex, toIndex) => {
        await projectManager.updateProjectOrder(fromIndex, toIndex);
        await loadProjects();
    }
}, translationManager);

const timeEntryList = new TimeEntryList('timeEntryList', {
    onAddManualEntry: async () => {
        const currentProject = projectManager.getCurrentProject();
        if (!currentProject) {
            showError(translationManager.translate('selectProjectFirst'));
            return;
        }
        await timeEntryManager.addEntry({
            projectId: currentProject.id,
            start: new Date(),
            end: new Date()
        });
        await loadTimeEntries();
    },
    onRemoveAllEntries: async () => {
        if (confirm(translationManager.translate('confirmDeleteTimeEntry'))) {
            const currentProject = projectManager.getCurrentProject();
            if (currentProject) {
                await timeEntryManager.deleteAllEntriesForProject(currentProject.id);
                await loadTimeEntries();
            }
        }
    }
}, translationManager);

// Add language switcher
function addLanguageSwitcher() {
    const languageSwitch = document.createElement('select');
    languageSwitch.id = 'languageSwitch';
    
    const languages = {
        'en': 'English',
        'es': 'Español',
        'se': 'Svenska',
        'eu': 'Euskara',
        'fr': 'Française',
        'de': 'Deutsch',
        'ja': '日本語'
    };

    Object.entries(languages).forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        languageSwitch.appendChild(option);
    });

    languageSwitch.value = translationManager.getCurrentLanguage();
    languageSwitch.addEventListener('change', (e) => {
        translationManager.setLanguage(e.target.value);
        updateUI();
    });

    const container = document.querySelector('.title-container');
    if (container) {
        container.appendChild(languageSwitch);
    }
}

// Update UI with new translations
function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (element.tagName === 'INPUT' && element.type === 'checkbox') {
            const label = element.nextSibling;
            if (label && label.nodeType === Node.TEXT_NODE) {
                label.textContent = translationManager.translate(key);
            }
        } else {
            element.textContent = translationManager.translate(key);
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = translationManager.translate(key);
    });

    // Refresh all components
    projectList.render(projectManager.getAllProjects(), projectManager.getCurrentProject()?.id);
    loadTimeEntries();
}

// Initialize the application
async function initializeApp() {
    try {
        await database.ready;
        addLanguageSwitcher();
        const projects = await projectManager.getAllProjects();
        if (projects.length > 0) {
            projectManager.setCurrentProject(projects[0]);
        }
        updateUI();
        
        // Set up timer callbacks
        timer.setCallbacks({
            onTick: (elapsedTime) => timerDisplay.updateTime(elapsedTime),
            onStart: () => {
                timerDisplay.updateStartStopButton(true);
                timerDisplay.updateProjectDisplay(projectManager.getCurrentProject()?.name);
            },
            onStop: async (startTime, stopTime) => {
                const currentProject = projectManager.getCurrentProject();
                if (!currentProject) {
                    showError(translationManager.translate('noProjectForTimer'));
                    return;
                }
                await timeEntryManager.addEntry({
                    projectId: currentProject.id,
                    start: startTime,
                    end: stopTime
                });
                await loadTimeEntries();
            },
            onReset: () => {
                timerDisplay.updateStartStopButton(false);
                timerDisplay.updateProjectDisplay(null);
            }
        });
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showError(translationManager.translate('initializationError'));
    }
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Example usage in timer callbacks
timer.setCallbacks({
    onStop: async (startTime, stopTime) => {
        try {
            const currentProject = projectManager.getCurrentProject();
            if (!currentProject) {
                throw new Error('No project selected');
            }

            await timeEntryManager.addEntry({
                projectId: currentProject.id,
                start: startTime,
                end: stopTime
            });

            // Update UI...
        } catch (error) {
            console.error('Error saving time entry:', error);
        }
    }
});

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
