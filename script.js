// script.js

// Define log levels
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

let currentLogLevel = LogLevel.INFO;

// Logging function
function log(level, message, ...args) {
    if (level >= currentLogLevel) {
        const logMethod = level === LogLevel.ERROR ? console.error :
                          level === LogLevel.WARN ? console.warn :
                          level === LogLevel.INFO ? console.info :
                          console.log;
        logMethod(`[${new Date().toISOString()}] ${message}`, ...args);
    }
}

// Constants and Global Variables
let db;
let dbReady;
let currentProject = null;
let startTime;
let elapsedTime = 0;
let isPaused = false;
let isRunning = false;
let isTimerRunning = false;
let timerInterval;
let timerProject = null;
let projectChart = null;
let currentSortOrder = 'newest';
let currentPage = 1;
let entriesPerPage = 10;
let isAllEntries = false;
let totalPages = 1;
let dragSrcEl = null;
let currentReport = null;
let currentLanguage = 'en'; // Default language

function addLanguageSwitcher() {
    const languageSwitch = document.createElement('select');
    languageSwitch.id = 'languageSwitch';
    languageSwitch.innerHTML = `
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="se">Svenska</option>
    `;
    languageSwitch.value = currentLanguage; // Set the initial value
    languageSwitch.addEventListener('change', (e) => setLanguage(e.target.value));
    languageSwitch.style.marginTop = '20px';
    document.querySelector('.title-container').appendChild(languageSwitch);
}

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('titoLanguage', lang);
    updateUI();
}

function checkTranslationsLoaded() {
    if (typeof translations === 'undefined') {
        log(LogLevel.ERROR,'Translations not loaded. Make sure translations.js is included before script.js');
        return false;
    }
    return true;
}

// Use this function before using translations, for example:
function getTranslation(key) {
    if (!checkTranslationsLoaded()) return key;
    return translations[currentLanguage][key] || key;
}

function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (element.tagName === 'INPUT' && element.type === 'checkbox') {
            // For checkboxes, update the label text
            if (element.nextSibling && element.nextSibling.nodeType === Node.TEXT_NODE) {
                element.nextSibling.textContent = getTranslation(key);
            }
        } else {
            element.textContent = getTranslation(key);
        }
    });
    
    // Update placeholder texts
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = getTranslation(key);
    });
    
    // Update button texts
    document.querySelectorAll('button[data-i18n]').forEach(button => {
        const key = button.getAttribute('data-i18n');
        button.textContent = getTranslation(key);
    });
    
    // Refresh charts and other dynamic content
    if (currentProject) {
        loadTimeEntries();
    }
    visualizeProjectData();
}

/* Initialization functions */
document.addEventListener('DOMContentLoaded', function() {
    initializeDB();
    initializeUI();
    startTimerDisplayUpdate();
    initializeKeyboardNavigation();

    const savedLanguage = localStorage.getItem('titoLanguage');
    if (savedLanguage) {
        setLanguage(savedLanguage);
    } else {
        updateUI(); // Use default language
    }

    dbReady
        .then(() => loadProjects())
        .then(() => {
            if (currentProject) {
                return loadTimeEntries();
            }
        })
        .catch(error => {
            log(LogLevel.ERROR, 'Error initializing app:', error);
            showError('Failed to initialize the app. Please refresh the page.');
        });
});

function initializeDB() {
    dbReady = new Promise((resolve, reject) => {
        let request = indexedDB.open('TimeTrackerDB', 1);

        request.onerror = function(event) {
            log(LogLevel.ERROR, 'Error opening IndexedDB:', event);
            reject('Failed to open IndexedDB');
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            log(LogLevel.INFO, 'IndexedDB opened successfully');
            resolve();
        };

        request.onupgradeneeded = function(event) {
            db = event.target.result;
            let projectStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
            projectStore.createIndex('name', 'name', { unique: true });

            let timeEntryStore = db.createObjectStore('timeEntries', { keyPath: 'id', autoIncrement: true });
            timeEntryStore.createIndex('projectId', 'projectId', { unique: false });
            timeEntryStore.createIndex('description', 'description', { unique: false });
            log(LogLevel.INFO, 'IndexedDB upgrade completed');
        };
    });
}

function initializeUI() {
    const infoButton = document.querySelector('.info-icon');
    const addProjectButton = document.getElementById('addProjectButton');
    const playPauseButton = document.getElementById('playPauseButton');
    const stopButton = document.getElementById('stopButton');
    const addManualEntryButton = document.getElementById('addManualEntryButton');
    const clearDatabaseButton = document.getElementById('clearDatabaseButton');
    const newProjectNameInput = document.getElementById('newProjectName');
    const exportDatabaseButton = document.getElementById('exportDatabaseButton');
    const importDatabaseButton = document.getElementById('importDatabaseButton');
    const importFileInput = document.getElementById('importFileInput');

    if (infoButton) {
        infoButton.addEventListener('click', openModal);
    }

    if (addManualEntryButton) {
        addManualEntryButton.addEventListener('click', addManualEntry);
    }

    if (addProjectButton) {
        addProjectButton.addEventListener('click', addProject);
    }

    if (playPauseButton) {
        playPauseButton.addEventListener('click', togglePlayPause);
    }

    if (stopButton) {
        stopButton.addEventListener('click', stopTimer);
    }

    if (clearDatabaseButton) {
        clearDatabaseButton.addEventListener('click', clearDatabase);
    }

    if (newProjectNameInput) {
        newProjectNameInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                addProject();
            }
        });
    }
 
    if (exportDatabaseButton) {
        exportDatabaseButton.addEventListener('click', exportDatabase);
    }

    if (importDatabaseButton) {
        importDatabaseButton.addEventListener('click', () => importFileInput.click());
    }

    if (importFileInput) {
        importFileInput.addEventListener('change', importDatabase);
    }

    const removeAllEntriesButton = document.getElementById('removeAllEntriesButton');
    if (removeAllEntriesButton) {
        removeAllEntriesButton.addEventListener('click', removeAllTimeEntries);
    }

    document.getElementById('firstPageButton').addEventListener('click', goToFirstPage);
    document.getElementById('prevPageButton').addEventListener('click', goToPrevPage);
    document.getElementById('nextPageButton').addEventListener('click', goToNextPage);
    document.getElementById('lastPageButton').addEventListener('click', goToLastPage);

    const entriesPerPageSelect = document.getElementById('entriesPerPageSelect');
    const customEntriesPerPage = document.getElementById('customEntriesPerPage');

    if (entriesPerPageSelect) {
        entriesPerPageSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            if (selectedValue === 'custom') {
                customEntriesPerPage.style.display = 'inline-block';
                customEntriesPerPage.value = entriesPerPage;
            } else {
                customEntriesPerPage.style.display = 'none';
                if (selectedValue === 'all') {
                    isAllEntries = true;
                } else {
                    isAllEntries = false;
                    entriesPerPage = parseInt(selectedValue, 10);
                }
                currentPage = 1;
                loadTimeEntries();
            }
        });
    }

    if (customEntriesPerPage) {
        customEntriesPerPage.addEventListener('change', function() {
            const customValue = parseInt(this.value, 10);
            if (customValue > 0) {
                entriesPerPage = customValue;
                isAllEntries = false;
                currentPage = 1;
                loadTimeEntries();
            }
        });
    }

    const tabs = document.querySelectorAll('.tab');
    const tabSections = document.querySelectorAll('.tab-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');
            
            // Remove active class from all tabs and sections
            tabs.forEach(t => t.classList.remove('active'));
            tabSections.forEach(s => s.classList.remove('active'));

            // Add active class to clicked tab and corresponding section
            tab.classList.add('active');
            document.getElementById(`${targetId}Section`).classList.add('active');

            // Trigger chart update if necessary
            if (targetId === 'timeRange') {
                visualizeProjectData();
            } else if (targetId === 'reports') {
                // If you need to do any initialization for the reports tab, do it here
            }
        });
    });

    // Add event listener for chart date range selection
    const applyDateRangeButton = document.getElementById('applyDateRange');
    if (applyDateRangeButton) {
        applyDateRangeButton.addEventListener('click', function() {
            visualizeProjectData();
        });
    } else {
        log(LogLevel.WARN, 'Apply date range button not found');
    }

    // Set default date range (e.g., last 7 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Set to beginning of the day
    
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const quickDateRange = document.getElementById('quickDateRange');
    
    if (startDateInput && endDateInput && quickDateRange) {
        startDateInput.value = formatDate(today);
        endDateInput.value = formatDate(today);
        quickDateRange.value = 'today';  // Set the dropdown to 'today'
    } else {
        log(LogLevel.WARN, 'Date input fields or quick date range select not found');
    }

    function setTodayDates() {
        const today = new Date();
        const todayString = formatDate(today);
        if (startDateInput && endDateInput) {
            startDateInput.value = todayString;
            endDateInput.value = todayString;
        }
    }

    setTodayDates(); // Set initial dates

    if (quickDateRange) {
        quickDateRange.addEventListener('change', function() {
            const selectedValue = this.value;
            const today = new Date();

            if (startDateInput && endDateInput) {
                switch(selectedValue) {
                    case 'today':
                        setTodayDates();
                        break;
                    case 'thisWeek':
                        const firstDayOfWeek = new Date(today);
                        firstDayOfWeek.setDate(today.getDate() - today.getDay());  // Set to last Sunday
                        startDateInput.value = formatDate(firstDayOfWeek);
                        endDateInput.value = formatDate(today);
                        break;
                    case 'thisMonth':
                        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                        startDateInput.value = formatDate(firstDayOfMonth);
                        endDateInput.value = formatDate(today);
                        break;
                    case 'last7Days':
                        const sevenDaysAgo = new Date(today);
                        sevenDaysAgo.setDate(today.getDate() - 6);  // 7 days including today
                        startDateInput.value = formatDate(sevenDaysAgo);
                        endDateInput.value = formatDate(today);
                        break;
                    case 'last30Days':
                        const thirtyDaysAgo = new Date(today);
                        thirtyDaysAgo.setDate(today.getDate() - 29);  // 30 days including today
                        startDateInput.value = formatDate(thirtyDaysAgo);
                        endDateInput.value = formatDate(today);
                        break;
                    case 'custom':
                        // Do nothing, let the user select custom dates
                        break;
                }

                // Trigger visualization update
                visualizeProjectData();
            } else {
                log(LogLevel.WARN, 'Date input fields not found when updating quick date range');
            }
        });
    } else {
        log(LogLevel.WARN, 'Quick date range select not found');
    }
    initializePaginationControls();
    initializeReportFeature();
    initializeModal();

    addLanguageSwitcher();

    // Initialize UI with default language
    updateUI();
}

function initializeModal() {
    console.log("Initializing modal");
    const infoButton = document.querySelector('.info-icon');
    const modal = document.getElementById('infoModal');
    const closeButton = modal.querySelector('.close');

    if (!infoButton || !modal || !closeButton) {
        console.error("Modal elements not found:", { infoButton, modal, closeButton });
        return;
    }

    infoButton.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);

    // Close the modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    console.log("Modal initialization complete");
}

/* Project related functions */
function addProject() {
    const projectName = document.getElementById('newProjectName').value.trim();
    if (!projectName) {
        showError(getTranslation('projectNameEmpty'));
        return;
    }

    dbReady.then(() => {
        let transaction = db.transaction(['projects'], 'readwrite');
        let store = transaction.objectStore('projects');
        
        let countRequest = store.count();
        countRequest.onsuccess = function() {
            let newOrder = countRequest.result;
            let request = store.add({ name: projectName, order: newOrder });

            request.onsuccess = function() {
                document.getElementById('newProjectName').value = '';
                loadProjects();
            };

            request.onerror = function(event) {
                log(LogLevel.ERROR, 'Error adding project:', event);
                showError('Failed to add project. It might already exist.');
            };
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error:', error);
        showError('Failed to add project due to a database error.');
    });
}

function loadProjects() {
    dbReady.then(() => {
        let transaction = db.transaction(['projects'], 'readonly');
        let store = transaction.objectStore('projects');
        let request = store.getAll();

        request.onsuccess = function(event) {
            let projects = event.target.result;
            projects.sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort by order
            renderProjectList(projects);
            
            if (projects.length === 0) {
                currentProject = null;
                clearTimeEntryList();
            } else if (!currentProject || !projects.some(p => p.id === currentProject.id)) {
                setCurrentProject(projects[0]);
            } else {
                loadTimeEntries();
            }
        };

        request.onerror = function(event) {
            log(LogLevel.ERROR, 'Error loading projects:', event);
            showError('Error loading projects!');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error in loadProjects:', error);
        showError('Failed to load project due to a database error.');
    });
}

function renderProjectList(projects) {
    log(LogLevel.INFO, 'Rendering projects:', projects);

    const projectListElement = document.getElementById('projectList');
    if (!projectListElement) {
        log(LogLevel.ERROR, 'Project list element not found');
        showError('Project list element not found when rendering projects');
        return;
    }
    projectListElement.innerHTML = '';
    projectListElement.tabIndex = '0';

    projects.forEach((project, index) => {
        const listItem = document.createElement('li');
        listItem.id = `project-${project.id}`;
        listItem.dataset.projectId = project.id;
        listItem.draggable = true;

        const projectName = document.createElement('span');
        projectName.textContent = project.name;
        projectName.className = 'project-name';
        projectName.contentEditable = true;
        projectName.setAttribute('aria-label', `Edit project name: ${project.name}`);

        projectName.addEventListener('dblclick', function(event) {
            event.stopPropagation();
            this.focus();
        });

        projectName.addEventListener('blur', function() {
            updateProjectName(project.id, this.textContent.trim());
        });
        projectName.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.blur();
            }
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '🗑️';
        deleteButton.className = 'remove-project-button';
        deleteButton.setAttribute('aria-label', `Delete project ${project.name}`);
        deleteButton.title = 'Delete project';
        deleteButton.addEventListener('click', function(event) {
            event.stopPropagation();
            deleteProject(project.id);
        });

        listItem.appendChild(projectName);
        listItem.appendChild(deleteButton);

        listItem.setAttribute('tabindex', '0'); // Make the list item focusable
        listItem.addEventListener('keydown', (event) => handleProjectKeyDown(event, projects.length, index));
        projectName.addEventListener('keydown', handleProjectNameKeyDown);
        deleteButton.addEventListener('keydown', handleDeleteButtonKeyDown);

        listItem.setAttribute('aria-label', `Project: ${project.name}`);

        listItem.addEventListener('click', function(event) {
            if (event.target !== projectName && event.target !== deleteButton) {
                setCurrentProject(project);
            }
        });

        projectListElement.appendChild(listItem);

        listItem.addEventListener('dragstart', handleDragStart);
        listItem.addEventListener('dragover', handleDragOver);
        listItem.addEventListener('drop', handleDrop);
        listItem.addEventListener('dragend', handleDragEnd);

        projectListElement.appendChild(listItem);
    });

    if (currentProject) {
        const currentProjectItem = projectListElement.querySelector(`[data-project-id="${currentProject.id}"]`);
        if (currentProjectItem) {
            currentProjectItem.classList.add('selected');
            currentProjectItem.setAttribute('aria-current', 'true');
        }
    }

    projectListElement.addEventListener('keydown', (event) => {
        if (event.key === 'Tab' && !event.shiftKey) {
            // If Tab is pressed on the last project, move focus out of the list
            const lastProject = projectListElement.lastElementChild;
            if (document.activeElement === lastProject) {
                event.preventDefault();
                const timeEntrySection = document.querySelector('.time-entries-section');
                const firstFocusableElement = timeEntrySection.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (firstFocusableElement) {
                    firstFocusableElement.focus();
                }
            }
        }
    });
}

function handleProjectKeyDown(event, totalProjects, currentIndex) {
    const listItem = event.target;

    switch (event.key) {
        case 'ArrowUp':
            event.preventDefault();
            if (currentIndex > 0) {
                listItem.parentElement.children[currentIndex - 1].focus();
            }
            break;
        case 'ArrowDown':
            event.preventDefault();
            if (currentIndex < totalProjects - 1) {
                listItem.parentElement.children[currentIndex + 1].focus();
            }
            break;
        case 'Enter':
        case ' ':
            event.preventDefault();
            setCurrentProject(getProjectFromListItem(listItem));
            break;
    }
}

function handleProjectNameKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur(); // Trigger the blur event to save changes
    }
}

function handleDeleteButtonKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const projectId = event.target.closest('li').dataset.projectId;
        deleteProject(projectId);
    }
}

function getProjectFromListItem(listItem) {
    const projectId = parseInt(listItem.dataset.projectId);
    return { id: projectId, name: listItem.querySelector('.project-name').textContent };
}

function updateProjectName(projectId, newName) {
    if (!newName) {
        showError('Project name cannot be empty.');
        loadProjects(); // Reload projects to revert the empty name
        return;
    }

    dbReady.then(() => {
        let transaction = db.transaction(['projects'], 'readwrite');
        let store = transaction.objectStore('projects');
        let request = store.get(projectId);

        request.onsuccess = function(event) {
            let project = event.target.result;
            if (project) {
                project.name = newName;
                store.put(project).onsuccess = function() {
                    log(LogLevel.INFO, 'Project name updated successfully');
                    if (currentProject && currentProject.id === projectId) {
                        currentProject.name = newName;
                    }
                    loadProjects(); // Refresh the project list
                    visualizeProjectData(); // Update the chart if needed
                };
            }
        };

        request.onerror = function(event) {
            log(LogLevel.ERROR, 'Error updating project name:', event);
            showError('Error updating project name in database');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error:', error);
        showError('Failed to update project name due to a database error');
    });
}

function attachEventListeners(item) {
    const projectId = parseInt(item.dataset.projectId);
    const projectName = item.querySelector('.project-name');
    const deleteButton = item.querySelector('.remove-project-button');

    item.addEventListener('click', function(event) {
        if (event.target !== projectName && event.target !== deleteButton) {
            dbReady.then(() => {
                let transaction = db.transaction(['projects'], 'readonly');
                let store = transaction.objectStore('projects');
                let request = store.get(projectId);

                request.onsuccess = function(event) {
                    const project = event.target.result;
                    if (project) {
                        setCurrentProject(project);
                    } else {
                        log(LogLevel.ERROR, 'Project not found:', projectId);
                        showError('Error: Project not found');
                    }
                };

                request.onerror = function(event) {
                    log(LogLevel.ERROR, 'Error retrieving project:', event);
                    showError('Error retrieving project from database');
                };
            }).catch(error => {
                log(LogLevel.ERROR, 'Database error:', error);
                showError('Failed to access database when selecting project');
            });
        }
    });

    projectName.addEventListener('dblclick', function(event) {
        event.stopPropagation();
        this.focus();
    });

    projectName.addEventListener('blur', function() {
        updateProjectName(projectId, this.textContent.trim());
    });

    projectName.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.blur();
        }
    });

    deleteButton.addEventListener('click', function(event) {
        event.stopPropagation();
        deleteProject(projectId);
    });

    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
}
    
function updateProjectOrder() {
    const projectItems = document.querySelectorAll('#projectList li');
    const newOrder = Array.from(projectItems).map(item => parseInt(item.dataset.projectId));
    
    log(LogLevel.INFO, 'New project order:', newOrder);
    
    dbReady.then(() => {
        let transaction = db.transaction(['projects'], 'readwrite');
        let store = transaction.objectStore('projects');

        // First, retrieve all projects
        store.getAll().onsuccess = function(event) {
            let projects = event.target.result;
            
            // Update each project with its new order
            projects.forEach((project) => {
                const newIndex = newOrder.indexOf(project.id);
                if (newIndex !== -1) {
                    project.order = newIndex;
                    store.put(project);
                }
            });
        };

        transaction.oncomplete = function() {
            log(LogLevel.INFO, 'Project order updated in database');
            // Refresh the chart after updating project order
            visualizeProjectData();
        };

        transaction.onerror = function(event) {
            log(LogLevel.ERROR, 'Error updating project order:', event.target.error);
            showError('Error updating project order in database');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error:', error);
        showError('Failed to update project order due to a database error');
    });
}
    

function deleteProject(projectId) {
    log(LogLevel.DEBUG, 'Start of deleteProject');
    if (confirm('Are you sure you want to delete this project? All associated time entries will also be deleted.')) {
        dbReady.then(() => {
            let transaction = db.transaction(['projects', 'timeEntries'], 'readwrite');
            let projectStore = transaction.objectStore('projects');
            let timeEntryStore = transaction.objectStore('timeEntries');

            // Delete the project
            projectStore.delete(projectId).onsuccess = function() {
                log(LogLevel.INFO, 'Project deleted');
            };

            // Delete all time entries for this project
            let index = timeEntryStore.index('projectId');
            let request = index.openCursor(IDBKeyRange.only(projectId));

            request.onsuccess = function(event) {
                let cursor = event.target.result;
                if (cursor) {
                    timeEntryStore.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };

            transaction.oncomplete = function() {
                log(LogLevel.INFO, 'Project and associated time entries deleted');
                if (currentProject && currentProject.id === projectId) {
                    currentProject = null;
                    resetTimer();
                }
                if (timerProject === projectId) {
                    timerProject = null;
                    if (isTimerRunning) {
                        stopTimer();
                    }
                }
                loadProjects();
                if (currentProject) {
                    loadTimeEntries();
                } else {
                    clearTimeEntryList();
                }
            };
        }).catch(error => {
            log(LogLevel.ERROR, 'Database error:', error);
            showError('Failed to delete project due to a database error');
        });
    }
    log(LogLevel.DEBUG, 'End of deleteProject');
}

function clearTimeEntryList() {
    const timeEntryListElement = document.getElementById('timeEntryList');
    if (timeEntryListElement) {
        timeEntryListElement.innerHTML = '';
    }
}
    
function loadProjects() {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            let transaction = db.transaction(['projects'], 'readonly');
            let store = transaction.objectStore('projects');
            let request = store.getAll();

            request.onsuccess = function(event) {
                let projects = event.target.result;
                projects.sort((a, b) => (a.order || 0) - (b.order || 0));
                log(LogLevel.INFO, 'Loaded projects:', projects);
                renderProjectList(projects);
                if (projects.length === 0) {
                    currentProject = null;
                    clearTimeEntryList();
                } else if (!currentProject || !projects.some(p => p.id === currentProject.id)) {
                    setCurrentProject(projects[0]);
                }
                resolve();
            };

            request.onerror = function(event) {
                log(LogLevel.ERROR, 'Error loading projects:', event);
                reject('Error loading projects from database');
            };
        });
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error in loadProjects:', error);
        showError('Failed to load projects due to a database error');
        throw error; // Re-throw the error to be caught in the main chain
    });
}

function setCurrentProject(project) {
    log(LogLevel.DEBUG, 'Before setCurrentProject');
    currentProject = project;

    const projectItems = document.querySelectorAll('#projectList li');
    projectItems.forEach(item => item.classList.remove('selected'));

    const selectedItem = document.querySelector(`#projectList li[data-project-id="${project.id}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }

    log(LogLevel.INFO,'Current project set to:', project);

    return loadTimeEntries().catch(error => {
        log(LogLevel.ERROR, 'Error loading time entries:', error);
        showError('Failed to load time entries for the selected project');
    });

    updateTimerProjectDisplay();
    log(LogLevel.DEBUG, 'After setCurrentProject');
}

/* Time entry-related functions */
function loadTimeEntries() {
    if (!currentProject) {
        log(LogLevel.INFO, 'No current project, not loading time entries');
        return Promise.resolve();
    }

    log(LogLevel.INFO, 'Loading time entries for project:', currentProject);

    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            let transaction = db.transaction(['timeEntries'], 'readonly');
            let store = transaction.objectStore('timeEntries');
            let index = store.index('projectId');
            let request = index.getAll(currentProject.id);

            request.onsuccess = function(event) {
                const allTimeEntries = event.target.result;

                // Sort all entries by start time (newest first)
                allTimeEntries.sort((a, b) => new Date(b.start) - new Date(a.start));

                let timeEntries;
                if (isAllEntries === undefined) {
                    isAllEntries = false; // Set a default value if it's not defined
                }

                if (isAllEntries) {
                    timeEntries = allTimeEntries;
                    totalPages = 1;
                    currentPage = 1;
                } else {
                    totalPages = Math.ceil(allTimeEntries.length / entriesPerPage);
                    currentPage = Math.max(1, Math.min(currentPage, totalPages));
                    const startIndex = (currentPage - 1) * entriesPerPage;
                    const endIndex = startIndex + entriesPerPage;
                    timeEntries = allTimeEntries.slice(startIndex, endIndex);
                }

                renderTimeEntryList(timeEntries);
                updatePaginationControls();
                visualizeProjectData(allTimeEntries);

                resolve();
            };

            request.onerror = function(event) {
                log(LogLevel.ERROR, 'Error loading time entries:', event);
                reject('Error loading time entries from database');
            };
        });
    });
}

function initializePaginationControls() {
    const currentPageInput = document.getElementById('currentPageInput');
    
    currentPageInput.addEventListener('change', function() {
        const newPage = parseInt(this.value);
        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            loadTimeEntries();
        } else {
            this.value = currentPage;
        }
    });

    document.getElementById('firstPageButton').addEventListener('click', goToFirstPage);
    document.getElementById('prevPageButton').addEventListener('click', goToPrevPage);
    document.getElementById('nextPageButton').addEventListener('click', goToNextPage);
    document.getElementById('lastPageButton').addEventListener('click', goToLastPage);
}

function updatePaginationControls() {
    const firstPageButton = document.getElementById('firstPageButton');
    const prevPageButton = document.getElementById('prevPageButton');
    const nextPageButton = document.getElementById('nextPageButton');
    const lastPageButton = document.getElementById('lastPageButton');
    const currentPageInput = document.getElementById('currentPageInput');
    const totalPagesSpan = document.getElementById('totalPages');
    const paginationControls = document.querySelector('.pagination-controls');

    if (isAllEntries) {
        paginationControls.style.display = 'none';
    } else {
        paginationControls.style.display = 'flex';
        firstPageButton.disabled = currentPage === 1;
        prevPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = currentPage === totalPages;
        lastPageButton.disabled = currentPage === totalPages;
        currentPageInput.value = currentPage;
        currentPageInput.max = totalPages;
        totalPagesSpan.textContent = totalPages;
    }
}

function goToFirstPage() {
    if (currentPage !== 1) {
        currentPage = 1;
        loadTimeEntries();
    }
}

function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadTimeEntries();
    }
}

function goToNextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadTimeEntries();
    }
}

function goToLastPage() {
    if (currentPage !== totalPages) {
        currentPage = totalPages;
        loadTimeEntries();
    }
}

function renderTimeEntryList(timeEntries) {
    const timeEntryListElement = document.getElementById('timeEntryList');
    timeEntryListElement.innerHTML = '';

    timeEntries.forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.draggable = true;
        listItem.dataset.entryId = entry.id;
        listItem.id = `time-entry-${entry.id}`;
        listItem.setAttribute('aria-label', `Time entry for ${entry.projectName}`);
        listItem.setAttribute('tabindex', '0'); // Make the list item focusable
        listItem.addEventListener('keydown', handleTimeEntryKeyDown);        

        // Create inputs for start date and time
        const startDate = new Date(entry.start);
        const startDateInput = createDateInput(startDate, 'start-date', entry.projectName);
        const startDateDisplay = createDateDisplay(startDate, 'start-date-display');
        const startTimeInput = createTimeInput(startDate, 'start-time', entry.projectName);
        
        // Create inputs for end date and time
        const endDate = new Date(entry.end);
        const endDateInput = createDateInput(endDate, 'end-date', entry.projectName);
        const endDateDisplay = createDateDisplay(endDate, 'end-date-display');
        const endTimeInput = createTimeInput(endDate, 'end-time', entry.projectName);
        
        // Create span for total time
        const totalTimeSpan = document.createElement('span');
        totalTimeSpan.className = 'total-time';
        totalTimeSpan.textContent = formatDuration(entry.duration);
        totalTimeSpan.setAttribute('aria-label', `Total time: ${formatDuration(entry.duration)}`);

        const descriptionInputContainer = document.createElement('div');
        descriptionInputContainer.className = 'description-input-container';

        // Create input field for description
        const descriptionInput = document.createElement('input');
        descriptionInput.type = 'text';
        descriptionInput.className = 'description-input';
        descriptionInput.value = entry.description || '';
        descriptionInput.placeholder = 'Enter task description';
        descriptionInput.setAttribute('aria-label', `Task description for ${entry.projectName}`);

        // Create the remove button with trash can emoji
        const removeButton = document.createElement('button');
        removeButton.textContent = '🗑️';
        removeButton.className = 'remove-time-entry-button';
        removeButton.title = 'Delete entry';
        removeButton.setAttribute('aria-label', `Delete time entry for ${entry.projectName}`);
        removeButton.addEventListener('keydown', handleRemoveButtonKeyDown);

        removeButton.addEventListener('click', () => removeTimeEntry(entry.id));
        removeButton.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                removeTimeEntry(entry.id);
            }
        });

        descriptionInputContainer.appendChild(descriptionInput);
        descriptionInputContainer.appendChild(removeButton);

        // Append all elements
        listItem.appendChild(document.createTextNode(getTranslation('start') + ': '));
        listItem.appendChild(startDateInput);
        listItem.appendChild(startDateDisplay);
        listItem.appendChild(startTimeInput);
        listItem.appendChild(document.createTextNode(' ' + getTranslation('end') + ': '));
        listItem.appendChild(endDateInput);
        listItem.appendChild(endDateDisplay);
        listItem.appendChild(endTimeInput);
        listItem.appendChild(document.createTextNode(' ' + getTranslation('totalTime') + ': '));
        listItem.appendChild(totalTimeSpan);
        listItem.appendChild(descriptionInputContainer);

        // Add drag and drop event listeners
        listItem.addEventListener('dragstart', function(e) {
            // Check if the target is an input or the description
            if (e.target.tagName === 'INPUT' || e.target.classList.contains('description-input')) {
                e.preventDefault();
                return false;
            }
            handleTimeEntryDragStart.call(this, e);
        });
        listItem.addEventListener('dragover', handleTimeEntryDragOver);
        listItem.addEventListener('drop', handleTimeEntryDrop);
        listItem.addEventListener('dragend', handleTimeEntryDragEnd);

        // Add mousedown event to prevent dragging when selecting text
        listItem.addEventListener('mousedown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.classList.contains('description-input')) {
                e.stopPropagation();
                listItem.draggable = false;
            } else {
                listItem.draggable = true;
            }
        });

        // Reset draggable on mouseup
        listItem.addEventListener('mouseup', function() {
            setTimeout(() => {
                listItem.draggable = true;
            }, 0);
        });

        timeEntryListElement.appendChild(listItem);

        // Add event listeners to inputs
        [startDateInput, startTimeInput, endDateInput, endTimeInput].forEach(input => {
            input.addEventListener('change', () => updateTimeEntry(entry.id, listItem));
        });
        descriptionInput.addEventListener('input', () => updateTimeEntryDescription(entry.id, descriptionInput.value));
    });

    // Adjust the list height based on the number of entries and entries per page
    const listItemHeight = 60; // Approximate height of each list item in pixels
    const maxHeight = Math.min(timeEntries.length, entriesPerPage) * listItemHeight;
    timeEntryListElement.style.height = `${maxHeight}px`;
}

function updateEntriesPerPage() {
    const selectedValue = document.getElementById('entriesPerPageSelect').value;
    const customEntriesPerPage = document.getElementById('customEntriesPerPage');

    if (selectedValue === 'custom') {
        customEntriesPerPage.style.display = 'inline-block';
        entriesPerPage = parseInt(customEntriesPerPage.value, 10) || 20;
    } else if (selectedValue === 'all') {
        isAllEntries = true;
        entriesPerPage = Infinity;
    } else {
        isAllEntries = false;
        entriesPerPage = parseInt(selectedValue, 10);
    }

    currentPage = 1;
    loadTimeEntries();
}

function handleTimeEntryKeyDown(event) {
    const listItem = event.target;
    const timeEntryList = listItem.parentElement;
    const entries = Array.from(timeEntryList.children);
    const currentIndex = entries.indexOf(listItem);

    switch (event.key) {
        case 'ArrowUp':
            event.preventDefault();
            if (currentIndex > 0) {
                entries[currentIndex - 1].focus();
            }
            break;
        case 'ArrowDown':
            event.preventDefault();
            if (currentIndex < entries.length - 1) {
                entries[currentIndex + 1].focus();
            }
            break;
    }
}

function handleRemoveButtonKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const entryId = event.target.closest('li').dataset.entryId;
        removeTimeEntry(entryId);
    }
}

function handleTimeEntryDragStart(e) {
    this.style.opacity = '0.4';
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleTimeEntryDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleTimeEntryDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    if (dragSrcEl !== this) {
        const list = this.parentNode;
        const draggedItem = dragSrcEl.cloneNode(true);
        
        // Insert the dragged item before or after the current item
        const rect = this.getBoundingClientRect();
        const dropPosition = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
        
        if (dropPosition === 'before') {
            list.insertBefore(draggedItem, this);
        } else {
            list.insertBefore(draggedItem, this.nextSibling);
        }

        // Remove the original item
        list.removeChild(dragSrcEl);

        // Reattach event listeners
        attachTimeEntryEventListeners(draggedItem);

        // Update time entry order
        updateTimeEntryOrder();
    }

    return false;
}

function handleTimeEntryDragEnd(e) {
    this.style.opacity = '1';
    document.querySelectorAll('#timeEntryList li').forEach(function (item) {
        item.classList.remove('over');
    });
}

function attachTimeEntryEventListeners(item) {
    const entryId = parseInt(item.dataset.entryId);
    const removeButton = item.querySelector('.remove-time-entry-button');
    const inputs = item.querySelectorAll('input');

    removeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        removeTimeEntry(entryId);
    });

    inputs.forEach(input => {
        if (input.name.endsWith('-date') || input.name.endsWith('-time')) {
            input.addEventListener('change', () => updateTimeEntry(entryId, item));
        } else if (input.classList.contains('description-input')) {
            input.addEventListener('input', () => updateTimeEntryDescription(entryId, input.value));
        }
    });

    item.addEventListener('dragstart', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.classList.contains('description-input')) {
            e.preventDefault();
            return false;
        }
        handleTimeEntryDragStart.call(this, e);
    });

    item.addEventListener('dragover', handleTimeEntryDragOver);
    item.addEventListener('drop', handleTimeEntryDrop);
    item.addEventListener('dragend', handleTimeEntryDragEnd);

    item.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.classList.contains('description-input')) {
            e.stopPropagation();
            item.draggable = false;
        } else {
            item.draggable = true;
        }
    });

    item.addEventListener('mouseup', function() {
        setTimeout(() => {
            item.draggable = true;
        }, 0);
    });
}

function updateTimeEntryOrder() {
    const timeEntryItems = document.querySelectorAll('#timeEntryList li');
    const newOrder = Array.from(timeEntryItems).map(item => parseInt(item.dataset.entryId));
    
    log(LogLevel.DEBUG,'New time entry order:', newOrder);
    
    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readwrite');
        let store = transaction.objectStore('timeEntries');

        // First, retrieve all time entries for the current project
        let index = store.index('projectId');
        let request = index.getAll(currentProject.id);

        request.onsuccess = function(event) {
            let timeEntries = event.target.result;
            
            // Update each time entry with its new order
            timeEntries.forEach((entry) => {
                const newIndex = newOrder.indexOf(entry.id);
                if (newIndex !== -1) {
                    entry.order = newIndex;
                    store.put(entry);
                }
            });
        };

        transaction.oncomplete = function() {
            log(LogLevel.INFO, 'Time entry order updated in database');
        };

        transaction.onerror = function(event) {
            log(LogLevel.ERROR, 'Error updating time entry order:', event.target.error);
            showError('Error updating time entry order in database');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error:', error);
        showError('Failed to update time entry order due to a database error');
    });
}

function createDateInput(date, name, projectName) {
    const input = document.createElement('input');
    input.type = 'date';
    input.name = name;
    input.value = formatDate(date);
    input.setAttribute('aria-label', `${getTranslation(name === 'start-date' ? 'start' : 'end')} ${getTranslation('date')} for ${projectName}`);
    input.addEventListener('change', function() {
        const display = this.nextElementSibling;
        display.textContent = formatDate(new Date(this.value));
    });
    return input;
}

function createDateDisplay(date, name) {
    const span = document.createElement('span');
    span.className = 'date-display';
    span.textContent = formatDate(date);
    span.setAttribute('aria-hidden', 'true'); // Hide from screen readers as the input is already labeled
    return span;
}


function createTimeInput(date, name, projectName) {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = name;
    input.value = formatTime(date);
    input.placeholder = 'HH:MM';
    input.pattern = '([01]?[0-9]|2[0-3]):[0-5][0-9]';
    input.title = getTranslation('enterTimeFormat');
    input.setAttribute('aria-label', `${getTranslation(name === 'start-time' ? 'start' : 'end')} ${getTranslation('time')} for ${projectName}`);
    
    input.addEventListener('blur', function() {
        if (this.value && !isValidTime(this.value)) {
            showError('invalidTimeFormat');
            this.value = formatTime(new Date());
        }
    });

    return input;
}

function updateTimeEntry(id, listItem) {
    const startDate = getDateTimeFromInputs(listItem, 'start');
    const endDate = getDateTimeFromInputs(listItem, 'end');
    const duration = endDate - startDate;

    // Update total time display
    const totalTimeSpan = listItem.querySelector('.total-time');
    totalTimeSpan.textContent = formatDuration(duration);

    // Update database
    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readwrite');
        let store = transaction.objectStore('timeEntries');
        let request = store.get(id);

        request.onsuccess = function(event) {
            let entry = event.target.result;
            entry.start = startDate.toISOString();
            entry.end = endDate.toISOString();
            entry.duration = duration;

            store.put(entry).onsuccess = function() {
                log(LogLevel.INFO, 'Time entry updated successfully');
                visualizeProjectData();
            };
        };
        request.onerror = function(event) {
            log(LogLevel.ERROR, 'Error updating time entry:', event);
            showError('Error updating time entry in database');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error in updateTimeEntry:', error);
        showError('Failed to load database when updating time entry');
    });
}

function getDateTimeFromInputs(listItem, prefix) {
    const dateInput = listItem.querySelector(`[name="${prefix}-date"]`);
    const timeInput = listItem.querySelector(`[name="${prefix}-time"]`);
    const dateTimeString = `${dateInput.value}T${timeInput.value}:00`;
    return new Date(dateTimeString);
}

function updateTimeEntryDescription(id, description) {
    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readwrite');
        let store = transaction.objectStore('timeEntries');
        let request = store.get(id);

        request.onsuccess = function(event) {
            let entry = event.target.result;
            entry.description = description;

            store.put(entry).onsuccess = function() {
                log(LogLevel.INFO, 'Time entry description updated successfully');
            };
        };
        request.onerror = function(event) {
            log(LogLevel.ERROR, 'Database error in updateTimeEntryDescription:', error);
            showError('Error updating time entry description to database');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error in updateTimeEntryDescription:', error);
        showError('Failed to load database when updating time entry description');
    });
}

function saveTimeEntry(startTime, endTime) {
    log(LogLevel.DEBUG, 'Start of saveTimeEntry');
    return new Promise((resolve, reject) => {
        dbReady.then(() => {
            if (timerProject !== null) {
                let transaction = db.transaction(['timeEntries'], 'readwrite');
                let store = transaction.objectStore('timeEntries');

                let entry = {
                    projectId: timerProject,
                    start: new Date(startTime).toISOString(),
                    end: new Date(endTime).toISOString(),
                    duration: endTime - startTime,
                    description: ''
                };

                log(LogLevel.INFO, 'Saving time entry', entry);

                let request = store.add(entry);

                request.onsuccess = function() {
                    log(LogLevel.INFO, 'Time entry saved successfully');
                    resetTimer();
                    resolve();
                };

                request.onerror = function(event) {
                    log(LogLevel.ERROR, 'Error saving time entry:', event);
                    showError('Error saving time entry in database');
                    reject(event);
                };
            } else {
                log(LogLevel.ERROR, 'No project associated with the timer');
                showError('No project associated with the timer. Time entry not saved.');
                reject(new Error('No project associated with the timer'));
            }
        }).catch(error => {
            log(LogLevel.ERROR, 'Database error:', error);
            showError('Failed to load database when saving time entry');
            reject(error);
        });
    });
    log(LogLevel.DEBUG, 'End of saveTimeEntry');
}


function removeTimeEntry(id) {
    if (confirm('Are you sure you want to delete this time entry?')) {
        dbReady.then(() => {
            let transaction = db.transaction(['timeEntries'], 'readwrite');
            let store = transaction.objectStore('timeEntries');
            let request = store.delete(id);

            request.onsuccess = function() {
                log(LogLevel.INFO,'Time entry removed');
                loadTimeEntries().then(() => {
                    if (document.getElementById('timeEntryList').children.length === 0 && currentPage > 1) {
                        currentPage--;
                        loadTimeEntries();
                    }
                });
                visualizeProjectData();
            };

            request.onerror = function(event) {
                log(LogLevel.ERROR, 'Error removing time entry:', event);
                showError('Error removing time entry from database');
            };
        }).catch(error => {
            log(LogLevel.ERROR, 'Database error:', error);
            showError('Failed to open database when removing time entry');
        });
    }
}

function addManualEntry() {
    if (!currentProject) {
        alert('Please select a project first.');
        return;
    }

    const now = new Date();
    const entry = {
        projectId: currentProject.id,
        start: now.toISOString(),
        end: now.toISOString(),
        duration: 0,
        description: '',
    };

    log(LogLevel.INFO,'Adding manual entry:', entry);

    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readwrite');
        let store = transaction.objectStore('timeEntries');

        let request = store.add(entry);

        request.onsuccess = function(event) {
            log(LogLevel.INFO,'Manual time entry added successfully');
            currentPage = 1; // Reset to first page
            loadTimeEntries().then(() => {
                const timeEntryList = document.getElementById('timeEntryList');
                timeEntryList.scrollTop = 0; // Scroll to top of the list
            });
            visualizeProjectData();
        };

        request.onerror = function(event) {
            log(LogLevel.ERROR, 'Error adding manual time entry:', event);
            showError('Error adding manual time entry to database');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error:', error);
        showError('Failed to open database when adding manual entry');
    });
}

function removeAllTimeEntries() {
    if (!currentProject) {
        showError('Please select a project first.');
        return;
    }

    if (confirm('Are you sure you want to remove all time entries for the current project? This action cannot be undone.')) {
        dbReady.then(() => {
            let transaction = db.transaction(['timeEntries'], 'readwrite');
            let store = transaction.objectStore('timeEntries');
            let index = store.index('projectId');
            let request = index.openCursor(IDBKeyRange.only(currentProject.id));

            request.onsuccess = function(event) {
                let cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                } else {
                    loadTimeEntries();
                    log(LogLevel.INFO, 'All time entries removed for the current project');
                    visualizeProjectData();
                }
            };

            transaction.oncomplete = function() {
                showError('All time entries for the current project have been removed.');
            };

            transaction.onerror = function(event) {
                log(LogLevel.ERROR, 'Error removing time entries:', event.target.error);
                showError('Error removing time entries from database');
            };
        }).catch(error => {
            log(LogLevel.ERROR, 'Database error:', error);
            showError('Failed to remove time entries due to a database error');
        });
    }
}

/* Timer functions */
function startTimerDisplayUpdate() {
    setInterval(updateTimerProjectDisplay, 1000); // Update every second
}

function updateTimerProjectDisplay() {
    const timerProjectDisplay = document.getElementById('timerProjectDisplay');
    if (timerProjectDisplay) {
        if (isTimerRunning && timerProject !== null) {
            dbReady.then(() => {
                let transaction = db.transaction(['projects'], 'readonly');
                let store = transaction.objectStore('projects');
                let request = store.get(timerProject);

                request.onsuccess = function(event) {
                    const project = event.target.result;
                    if (project) {
                        timerProjectDisplay.textContent = `${getTranslation('timerRunningFor')}: ${project.name}`;
                        timerProjectDisplay.style.display = 'block';
                    } else {
                        timerProjectDisplay.textContent = `${getTranslation('timerRunningFor')}: ${getTranslation('unknownProject')}`;
                        timerProjectDisplay.style.display = 'block';
                    }
                };

                request.onerror = function(event) {
                    log(LogLevel.ERROR, 'Error fetching timer project:', event);
                    timerProjectDisplay.textContent = 'Timer running for: Unknown project';
                    timerProjectDisplay.style.display = 'block';
                };
            });
        } else {
            timerProjectDisplay.textContent = '';
            timerProjectDisplay.style.display = 'none';
        }
    }
}

function togglePlayPause() {
    if (!isTimerRunning) {
        startTimer();
    } else if (isPaused) {
        resumeTimer();
    } else {
        pauseTimer();
    }
}

function startTimer() {
    log(LogLevel.DEBUG, 'Before startTimer');
    if (!currentProject) {
        alert('Please select a project first.');
        return;
    }
    isTimerRunning = true;
    isPaused = false;
    startTime = Date.now();
    timerProject = currentProject.id;
    log(LogLevel.INFO, `Timer started at: ${new Date(startTime).toISOString()} for project ID: ${timerProject}`);
    timerInterval = setInterval(updateTimeDisplay, 1000);
    updatePlayPauseButton();
    updateTimerProjectDisplay();
    log(LogLevel.DEBUG, 'After startTimer');
}

function pauseTimer() {
    isPaused = true;
    clearInterval(timerInterval);
    log(LogLevel.INFO, 'Timer paused at:', new Date());
    updatePlayPauseButton();
}

function resumeTimer() {
    isPaused = false;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimeDisplay, 1000);
    log(LogLevel.INFO, 'Timer resumed at:', new Date());
    updatePlayPauseButton();
}

function stopTimer() {
    log(LogLevel.DEBUG, 'Start of stopTimer');
    if (isTimerRunning) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        isPaused = false;

        let stopTime = Date.now();

        log(LogLevel.INFO, 'Timer stopped at:', new Date(stopTime));
        log(LogLevel.INFO, 'Elapsed time (ms):', elapsedTime);

        if (timerProject !== null) {
            // Check if the timerProject still exists
            dbReady.then(() => {
                let transaction = db.transaction(['projects'], 'readonly');
                let store = transaction.objectStore('projects');
                let request = store.get(timerProject);

                request.onsuccess = function(event) {
                    const project = event.target.result;
                    if (project) {
                        // Project still exists, save the time entry
                        saveTimeEntry(startTime, stopTime).then(() => {
                            currentPage = 1; // Reset to first page
                            loadTimeEntries().then(() => {
                                const timeEntryList = document.getElementById('timeEntryList');
                                timeEntryList.scrollTop = 0; // Scroll to top
                            });
                        });
                        log(LogLevel.INFO, 'Time entry saved for project:', project.name);
                    } else {
                        log(LogLevel.INFO, 'Project was deleted while timer was running. Time entry not saved.');
                        showError('The project was deleted while the timer was running. Time entry not saved.');
                    }
                };

                request.onerror = function(event) {
                    log(LogLevel.ERROR, 'Error checking project existence:', event);
                    showError('Error checking project existence. Time entry not saved.');
                    resetTimer();
                };
            }).catch(error => {
                log(LogLevel.ERROR, 'Database error:', error);
                showError('Failed to access database when stopping timer');
                resetTimer();
            });
        } else {
            log(LogLevel.INFO, 'No project associated with the timer. Time entry not saved.');
            showError('No project associated with the timer. Time entry not saved.');
            resetTimer();
        }
    } else {
        alert("No timer is currently running.");
    }
    log(LogLevel.DEBUG, 'End of stopTimer');
}

function updatePlayPauseButton() {
    const playPauseButton = document.getElementById('playPauseButton');
    if (isTimerRunning && !isPaused) {
        playPauseButton.textContent = '⏸️';
        playPauseButton.title = 'Pause';
    } else {
        playPauseButton.textContent = '▶️';
        playPauseButton.title = 'Play';
    }
}

function updateTimeDisplay() {
    if (!isPaused && isTimerRunning) {
        const currentTime = Date.now();
        elapsedTime = currentTime - startTime;
        const formattedTime = formatDuration(elapsedTime);
        document.getElementById('timeDisplay').textContent = formattedTime;
    }
}

function resetTimer() {
    log(LogLevel.DEBUG, 'Start of resetTimer');
    elapsedTime = 0;
    startTime = null;
    isTimerRunning = false;
    isPaused = false;
    timerProject = null;
    clearInterval(timerInterval);
    document.getElementById('timeDisplay').textContent = '00:00:00';
    updatePlayPauseButton();
    updateTimerProjectDisplay();
    log(LogLevel.DEBUG, 'End of resetTimer');
}

/* UI update functions */
function handleDragStart(e) {
    this.style.opacity = '0.4';
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    if (dragSrcEl !== this) {
        const list = this.parentNode;
        const draggedItem = dragSrcEl.cloneNode(true);
        
        // Insert the dragged item before or after the current item
        const rect = this.getBoundingClientRect();
        const dropPosition = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
        
        if (dropPosition === 'before') {
            list.insertBefore(draggedItem, this);
        } else {
            list.insertBefore(draggedItem, this.nextSibling);
        }

        // Remove the original item
        list.removeChild(dragSrcEl);

        // Reattach event listeners
        attachEventListeners(draggedItem);

        // Update project order
        updateProjectOrder();
    }

    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    document.querySelectorAll('#projectList li').forEach(function (item) {
        item.classList.remove('over');
    });
}

/* Chart and report tabs */
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabSections = document.querySelectorAll('.tab-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');
            if (!targetId) {
                log(LogLevel.ERROR,'data-tab attribute is missing on tab element');
                return;
            }
            const targetSection = document.getElementById(`${targetId}Section`);
            
            if (targetSection) {
                // Remove active class from all tabs and sections
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tabSections.forEach(s => {
                    s.classList.remove('active');
                    s.hidden = true;
                });

                // Add active class to clicked tab and corresponding section
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                targetSection.classList.add('active');
                targetSection.hidden = false;

                // Trigger chart update if necessary
                if (targetId === 'timeRange') {
                    visualizeProjectData();
                } else if (targetId === 'reports') {
                    // If you need to do any initialization for the reports tab, do it here
                }
            } else {
                log(LogLevel.ERROR,`Target section not found for tab: ${targetId}`);
            }
        });
    });
}

/* Chart and visualization functions */
function visualizeProjectData(allTimeEntries) {
    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries', 'projects'], 'readonly');
        let timeEntryStore = transaction.objectStore('timeEntries');
        let projectStore = transaction.objectStore('projects');

        Promise.all([
            new Promise((resolve, reject) => {
                let request = timeEntryStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                let request = projectStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            })
        ]).then(([allTimeEntries, projects]) => {
            window.sortedProjects = projects.sort((a, b) => (a.order || 0) - (b.order || 0));

            const overallProjectTotals = calculateProjectTotals(allTimeEntries);
            updateOverallChart(overallProjectTotals);
            
            const startDateInput = document.getElementById('startDate');
            const endDateInput = document.getElementById('endDate');
            
            if (!startDateInput || !endDateInput) {
                log(LogLevel.ERROR, 'Date input elements not found');
                return;
            }

            let startDate = new Date(startDateInput.value + 'T00:00:00');
            let endDate = new Date(endDateInput.value + 'T23:59:59.999');

            // Check if it's "Today" view
            const isToday = startDate.toDateString() === new Date().toDateString() && 
                            endDate.toDateString() === new Date().toDateString();

            const rangeTimeEntries = allTimeEntries.filter(entry => {
                const entryStart = new Date(entry.start);
                const entryEnd = new Date(entry.end);

                if (isToday) {
                    // For "Today" view, only include entries that have some part in today
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    return (entryStart >= today && entryStart < tomorrow) ||
                           (entryEnd >= today && entryEnd < tomorrow) ||
                           (entryStart < today && entryEnd >= tomorrow);
                } else {
                    // For other views, use the selected date range
                    return (entryStart >= startDate && entryStart <= endDate) ||
                           (entryEnd >= startDate && entryEnd <= endDate) ||
                           (entryStart <= startDate && entryEnd >= endDate);
                }
            });
            
            const rangeProjectTotals = calculateProjectTotals(rangeTimeEntries);
            
            updateTimeRangeCharts(rangeProjectTotals, formatDate(startDate), formatDate(endDate));
        }).catch(error => {
            log(LogLevel.ERROR, 'Error fetching data for visualization:', error);
            showError('Failed to fetch data for visualization.');
        });
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error:', error);
        showError('Failed to visualize data due to a database error.');
    });
}

function updateOverallChart(projectTotals) {
    if (typeof Chart === 'undefined') {
        log(LogLevel.ERROR, 'Chart.js is not loaded. Please check your internet connection and make sure Chart.js is included in your HTML.');
        return;
    }

    if (!window.sortedProjects || window.sortedProjects.length === 0) {
        log(LogLevel.WARN, 'No projects available for chart visualization');
        return;
    }

    const ctx = document.getElementById('overallProjectChart');
    if (!ctx) {
        log(LogLevel.ERROR, 'Overall project chart canvas not found');
        return;
    }

    const labels = [];
    const data = [];

    window.sortedProjects.forEach(project => {
        if (projectTotals[project.id]) {
            labels.push(project.name);
            data.push(projectTotals[project.id] / (1000 * 60 * 60)); // Convert to hours
        }
    });

    const chartData = {
        labels: labels,
        datasets: [{
            label: getTranslation('hoursSpent'),
            data: data,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
        }]
    };

    const chartOptions = {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: getTranslation('hours')
                }
            }
        },
        plugins: {
            title: {
                display: true,
                text: getTranslation('overallTimeSpentOnProjects')
            }
        }
    };

    if (window.overallChart) {
        window.overallChart.data = chartData;
        window.overallChart.options = chartOptions;
        window.overallChart.update();
    } else {
        window.overallChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: chartOptions
        });
    }
}

function loadChartJs() {
    return new Promise((resolve, reject) => {
        if (typeof Chart !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Chart.js'));
        document.head.appendChild(script);
    });
}

function updateTimeRangeCharts(projectTotals, startDate, endDate) {
    if (typeof Chart === 'undefined') {
        log(LogLevel.ERROR, 'Chart.js is not loaded. Please check your internet connection and make sure Chart.js is included in your HTML.');
        return;
    }

    const pieCtx = document.getElementById('timeRangePieChart');
    const barCtx = document.getElementById('timeRangeBarChart');
    
    if (!pieCtx || !barCtx) {
        log(LogLevel.ERROR, 'Chart canvas elements not found');
        return;
    }

    if (!window.sortedProjects || window.sortedProjects.length === 0) {
        log(LogLevel.WARN, 'No projects available for time range chart visualization');
        return;
    }
    
    const labels = [];
    const data = [];

    // Generate a color palette with more colors
    const colorPalette = [
        'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)', 
        'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
        'rgba(199, 99, 132, 0.8)', 'rgba(84, 122, 235, 0.8)', 'rgba(205, 156, 86, 0.8)',
        'rgba(125, 142, 192, 0.8)', 'rgba(103, 152, 255, 0.8)', 'rgba(205, 109, 114, 0.8)',
        'rgba(255, 99, 71, 0.8)', 'rgba(0, 128, 128, 0.8)', 'rgba(128, 0, 128, 0.8)',
        'rgba(128, 128, 0, 0.8)', 'rgba(0, 0, 128, 0.8)', 'rgba(128, 0, 0, 0.8)',
        'rgba(0, 128, 0, 0.8)', 'rgba(128, 128, 128, 0.8)', 'rgba(255, 140, 0, 0.8)',
        'rgba(0, 191, 255, 0.8)', 'rgba(255, 20, 147, 0.8)', 'rgba(50, 205, 50, 0.8)',
        'rgba(255, 215, 0, 0.8)', 'rgba(186, 85, 211, 0.8)', 'rgba(255, 105, 180, 0.8)',
        'rgba(60, 179, 113, 0.8)', 'rgba(65, 105, 225, 0.8)', 'rgba(218, 165, 32, 0.8)'
    ];

    window.sortedProjects.forEach((project, index) => {
        if (projectTotals[project.id]) {
            labels.push(project.name);
            data.push(projectTotals[project.id] / (1000 * 60 * 60)); // Convert to hours
        }
    });

    // Ensure we have enough colors by repeating the palette if necessary
    const backgroundColors = data.map((_, index) => colorPalette[index % colorPalette.length]);

    // Pie Chart
    const pieData = {
        labels: labels,
        datasets: [{
            data: data,
            backgroundColor: backgroundColors,
        }]
    };

    const pieOptions = {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: `${getTranslation('timeDistribution')} (${startDate} to ${endDate})`
            },
            legend: {
                display: true,
                position: 'right'
            }
        }
    };

    if (window.timeRangePieChart instanceof Chart) {
        window.timeRangePieChart.data = pieData;
        window.timeRangePieChart.options = pieOptions;
        window.timeRangePieChart.update();
    } else {
        window.timeRangePieChart = new Chart(pieCtx, {
            type: 'pie',
            data: pieData,
            options: pieOptions
        });
    }

    // Bar Chart
    const barData = {
        labels: labels,
        datasets: [{
            label: 'Hours Spent',
            data: data,
            backgroundColor: backgroundColors,
            borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
            borderWidth: 1
        }]
    };

    const barOptions = {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: getTranslation('hours')
                }
            }
        },
        plugins: {
            title: {
                display: true,
                text: `${getTranslation('timeSpentOnProjects')} (${startDate} to ${endDate})`
            },
            legend: {
                display: false
            }
        }
    };

    if (window.timeRangeBarChart instanceof Chart) {
        window.timeRangeBarChart.data = barData;
        window.timeRangeBarChart.options = barOptions;
        window.timeRangeBarChart.update();
    } else {
        window.timeRangeBarChart = new Chart(barCtx, {
            type: 'bar',
            data: barData,
            options: barOptions
        });
    }
}

/* Project report related functions */

function initializeReportFeature() {
    log(LogLevel.DEBUG,"Initializing report feature");
    
    const reportType = document.getElementById('reportType');
    const startDate = document.getElementById('reportStartDate');
    const endDate = document.getElementById('reportEndDate');
    const generateButton = document.getElementById('generateReport');
    const selectAllButton = document.getElementById('selectAllProjects');
    const deselectAllButton = document.getElementById('deselectAllProjects');

    log(LogLevel.DEBUG,"Report elements:", { reportType, startDate, endDate, generateButton, selectAllButton, deselectAllButton });

    if (!reportType || !startDate || !endDate || !generateButton || !selectAllButton || !deselectAllButton) {
        log(LogLevel.ERROR,'One or more required elements for report feature not found');
        return;
    }

    // Set default dates
    const today = new Date();
    endDate.value = formatDate(today);
    startDate.value = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));

    log(LogLevel.DEBUG,"Populating project selection");
    populateProjectSelection().then(() => {
        log(LogLevel.DEBUG,"Project selection populated");
        addColumnSelection();
    }).catch(error => {
        log(LogLevel.ERROR,'Error populating project selection:', error);
        alert('Failed to load projects. Please refresh the page and try again.');
    });

    log(LogLevel.DEBUG,"Adding event listeners");
    generateButton.addEventListener('click', () => {
        log(LogLevel.DEBUG,"Generate report button clicked");
        const selectedColumns = Array.from(document.querySelectorAll('#columnSelection input:checked'))
            .map(checkbox => checkbox.id.replace('column-', ''));
        log(LogLevel.DEBUG,"Selected columns:", selectedColumns);
        generateReport(selectedColumns);
    });
    selectAllButton.addEventListener('click', selectAllProjects);
    deselectAllButton.addEventListener('click', deselectAllProjects);

    [startDate, endDate].forEach(input => {
        input.addEventListener('change', function() {
            if (!isValidDate(this.value)) {
                alert('Please enter a valid date.');
                this.value = '';
            }
        });
    });
    
    log(LogLevel.DEBUG,"Report feature initialization complete");
}

function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

function populateProjectSelection() {
  return new Promise((resolve, reject) => {
    const projectSelection = document.getElementById('projectSelection');
    if (!projectSelection) {
      reject(new Error('Project selection element not found'));
      return;
    }

    projectSelection.innerHTML = ''; // Clear existing checkboxes

    dbReady.then(() => {
      let transaction = db.transaction(['projects'], 'readonly');
      let store = transaction.objectStore('projects');
      let request = store.getAll();

      request.onsuccess = function(event) {
        const projects = event.target.result;
        projects.sort((a, b) => (a.order || 0) - (b.order || 0));

        projects.forEach((project) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'project-checkbox-wrapper';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `project-${project.id}`;
          checkbox.value = project.id;

          const label = document.createElement('label');
          label.htmlFor = `project-${project.id}`;
          label.textContent = project.name;

          wrapper.appendChild(checkbox);
          wrapper.appendChild(label);
          projectSelection.appendChild(wrapper);
        });

        initializeProjectSelection();
        resolve();
      };

      request.onerror = function(event) {
        reject(new Error('Error loading projects from database'));
      };
    }).catch(reject);
  });
}

function initializeProjectSelection() {
    const projectSelection = document.getElementById('projectSelection');
    let isMouseDown = false;
    let startElement = null;
    let dragStarted = false;

    projectSelection.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        startElement = e.target.closest('.project-checkbox-wrapper');
        dragStarted = false;  // Reset drag state

        if (startElement) {
            // Toggle checkbox on mousedown (for single click selection)
            const checkbox = startElement.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
        }
    });

    projectSelection.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;  // Do nothing if mouse is not down

        dragStarted = true;  // Drag operation is starting
        const currentElement = e.target.closest('.project-checkbox-wrapper');

        // If we've moved to a new element, toggle its checkbox
        if (currentElement && currentElement !== startElement) {
            const checkbox = currentElement.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            startElement = currentElement;
        }
    });

    document.addEventListener('mouseup', (e) => {
        isMouseDown = false;

        // If no drag occurred (simple click), ensure the checkbox is toggled correctly
        if (!dragStarted && startElement) {
            const checkbox = startElement.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;  // Toggle again to undo extra toggle from mousedown
        }

        // Reset drag status and startElement
        startElement = null;
        dragStarted = false;
    });

    // Prevent text selection during drag
    projectSelection.addEventListener('selectstart', (e) => {
        if (isMouseDown) {
            e.preventDefault();
        }
    });
}

function selectAllProjects() {
  const checkboxes = document.querySelectorAll('#projectSelection input[type="checkbox"]');
  checkboxes.forEach(checkbox => checkbox.checked = true);
}

function deselectAllProjects() {
  const checkboxes = document.querySelectorAll('#projectSelection input[type="checkbox"]');
  checkboxes.forEach(checkbox => checkbox.checked = false);
}

function startProjectRangeSelection(event) {
    event.preventDefault();

    const projectSelection = document.getElementById('projectSelection');
    const wrappers = Array.from(projectSelection.querySelectorAll('.project-checkbox-wrapper'));
    const startWrapper = event.target.closest('.project-checkbox-wrapper');
    if (!startWrapper) return;

    const startIndex = wrappers.indexOf(startWrapper);
    const startX = event.clientX;
    const startY = event.clientY;
    const moveThreshold = 5; // pixels
    let isDragging = false;

    function rangeSelect(e) {
        if (!isDragging) {
            const deltaX = Math.abs(e.clientX - startX);
            const deltaY = Math.abs(e.clientY - startY);
            if (deltaX > moveThreshold || deltaY > moveThreshold) {
                isDragging = true;
            } else {
                return;
            }
        }

        const currentWrapper = e.target.closest('.project-checkbox-wrapper');
        if (!currentWrapper) return;

        const currentIndex = wrappers.indexOf(currentWrapper);
        const start = Math.min(startIndex, currentIndex);
        const end = Math.max(startIndex, currentIndex);

        wrappers.forEach((wrapper, index) => {
            const checkbox = wrapper.querySelector('input[type="checkbox"]');
            if (index >= start && index <= end) {
                checkbox.checked = !checkbox.checked;
            }
        });
    }

    function stopRangeSelect(e) {
        projectSelection.removeEventListener('mousemove', rangeSelect);
        document.removeEventListener('mouseup', stopRangeSelect);

        if (!isDragging) {
            // It's a click, toggle the checkbox
            const checkbox = startWrapper.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
        }
    }

    projectSelection.addEventListener('mousemove', rangeSelect);
    document.addEventListener('mouseup', stopRangeSelect);
}

function generateReport(selectedColumns) {
    log(LogLevel.DEBUG,"Generating report with columns:", selectedColumns);
    const reportType = document.getElementById('reportType').value;
    const startDate = new Date(document.getElementById('reportStartDate').value);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(document.getElementById('reportEndDate').value);
    endDate.setHours(23, 59, 59, 999);
    const selectedProjects = Array.from(document.querySelectorAll('#projectSelection input:checked')).map(cb => parseInt(cb.value));

    log(LogLevel.DEBUG,"Report parameters:", { reportType, startDate, endDate, selectedProjects });

    if (selectedProjects.length === 0) {
        log(LogLevel.INFO,"No projects selected");
        alert(getTranslation('selectAtLeastOneProject'));
        return;
    }

    if (startDate > endDate) {
        log(LogLevel.INFO,"Invalid date range");
        alert(getTranslation('startDateAfterEndDate'));
        return;
    }

    log(LogLevel.INFO,"Fetching data from database");
    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries', 'projects'], 'readonly');
        let timeEntryStore = transaction.objectStore('timeEntries');
        let projectStore = transaction.objectStore('projects');

        Promise.all([
            new Promise((resolve) => {
                timeEntryStore.getAll().onsuccess = (event) => resolve(event.target.result);
            }),
            new Promise((resolve) => {
                projectStore.getAll().onsuccess = (event) => resolve(event.target.result);
            })
        ]).then(([allTimeEntries, allProjects]) => {
            log(LogLevel.INFO,"Data fetched:", { timeEntriesCount: allTimeEntries.length, projectsCount: allProjects.length });
            
            const projectMap = new Map(allProjects.map(p => [p.id, p.name]));
            
            const filteredEntries = allTimeEntries.filter(entry => 
                selectedProjects.includes(entry.projectId) &&
                new Date(entry.start) <= endDate &&
                new Date(entry.end) >= startDate
            ).map(entry => ({
                ...entry,
                projectName: projectMap.get(entry.projectId)
            }));

            log(LogLevel.INFO,"Filtered entries:", filteredEntries.length);

            if (filteredEntries.length === 0) {
                log(LogLevel.INFO,"No entries found");
                alert(getTranslation('noEntriesFound'));
                currentReport = null;
                return;
            }

            let report;
            if (reportType === 'weekly') {
                report = generateWeeklyReport(filteredEntries, startDate, endDate);
            } else {
                report = generateMonthlyReport(filteredEntries, startDate, endDate);
            }

            log(LogLevel.INFO,"Report generated:", report);
            currentReport = report;
            displayReport(report, selectedColumns);
        }).catch(error => {
            log(LogLevel.INFO,'Error generating report:', error);
            alert(getTranslation('errorGeneratingReport'));
            currentReport = null;
        });
    });
}

function generateWeeklyReport(entries, startDate, endDate) {
    let report = {};
    let currentDate = new Date(startDate);
    endDate = new Date(endDate);

    // Ensure endDate is set to the end of the day
    endDate.setHours(23, 59, 59, 999);

    while (currentDate <= endDate) {
        let weekStart = new Date(currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Set to Sunday
        let weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6, 23, 59, 59, 999); // Set to Saturday end of day

        // Adjust weekEnd if it's beyond the overall endDate
        if (weekEnd > endDate) {
            weekEnd = new Date(endDate);
        }

        let weekEntries = entries.filter(entry => {
            let entryStart = new Date(entry.start);
            let entryEnd = new Date(entry.end);
            return (
                (entryStart >= weekStart && entryStart <= weekEnd) ||
                (entryEnd >= weekStart && entryEnd <= weekEnd) ||
                (entryStart <= weekStart && entryEnd >= weekEnd)
            );
        });

        let weekTotal = weekEntries.reduce((total, entry) => {
            return total + entry.duration;
        }, 0);

        let weekKey = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;

        report[weekKey] = {
            total: weekTotal,
            entries: weekEntries
        };

        currentDate.setDate(currentDate.getDate() + 7); // Move to next week
    }

    return report;
}

function generateMonthlyReport(entries, startDate, endDate) {
    let report = {};
    let currentDate = new Date(startDate);
    endDate = new Date(endDate);

    // Ensure endDate is set to the end of the day
    endDate.setHours(23, 59, 59, 999);

    while (currentDate <= endDate) {
        let monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        let monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

        // Adjust monthEnd if it's beyond the overall endDate
        if (monthEnd > endDate) {
            monthEnd = new Date(endDate);
        }

        let monthEntries = entries.filter(entry => {
            let entryStart = new Date(entry.start);
            let entryEnd = new Date(entry.end);
            return (
                (entryStart >= monthStart && entryStart <= monthEnd) ||
                (entryEnd >= monthStart && entryEnd <= monthEnd) ||
                (entryStart <= monthStart && entryEnd >= monthEnd)
            );
        });

        let monthTotal = monthEntries.reduce((total, entry) => {
            return total + entry.duration;
        }, 0);

        let monthKey = `${monthStart.toLocaleString('default', { month: 'long' })} ${monthStart.getFullYear()}`;

        report[monthKey] = {
            total: monthTotal,
            entries: monthEntries
        };

        currentDate.setMonth(currentDate.getMonth() + 1); // Move to next month
    }

    return report;
}

function displayReport(report, selectedColumns) {
    const reportResults = document.getElementById('reportResults');
    reportResults.innerHTML = ''; // Clear previous results

    addExportButtons();

    const table = document.createElement('table');
    table.className = 'report-table';

    // Create table header
    const headerRow = table.insertRow();
    selectedColumns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = getTranslation(column);
        headerRow.appendChild(th);
    });

    // Flatten the report data for pagination
    let allEntries = [];
    for (const [period, data] of Object.entries(report)) {
        data.entries.forEach(entry => {
            allEntries.push({ period, totalTime: data.total, ...entry });
        });
    }

    const entriesPerPage = 20;
    let currentPage = 1;
    const totalPages = Math.ceil(allEntries.length / entriesPerPage);

    function renderPage(page) {
        // Clear existing rows except header
        while (table.rows.length > 1) {
            table.deleteRow(1);
        }

        const start = (page - 1) * entriesPerPage;
        const end = start + entriesPerPage;
        const pageEntries = allEntries.slice(start, end);

        let displayedPeriods = new Set();

        pageEntries.forEach((entry, index) => {
            const row = table.insertRow();
            let cellIndex = 0;

            selectedColumns.forEach(column => {
                switch(column) {
                    case 'period':
                        if (!displayedPeriods.has(entry.period)) {
                            const cell = row.insertCell(cellIndex++);
                            cell.textContent = entry.period;
                            let periodEntryCount = pageEntries.slice(index).filter(e => e.period === entry.period).length;
                            cell.rowSpan = periodEntryCount;
                        }
                        break;
                    case 'totalTime':
                        if (!displayedPeriods.has(entry.period)) {
                            const cell = row.insertCell(cellIndex++);
                            cell.textContent = formatDuration(entry.totalTime);
                            let periodEntryCount = pageEntries.slice(index).filter(e => e.period === entry.period).length;
                            cell.rowSpan = periodEntryCount;
                        }
                        break;
                    case 'project':
                        row.insertCell(cellIndex++).textContent = entry.projectName;
                        break;
                    case 'description':
                        row.insertCell(cellIndex++).textContent = entry.description || getTranslation('noDescription');
                        break;
                    case 'timeSpent':
                        row.insertCell(cellIndex++).textContent = formatDuration(entry.duration);
                        break;
                }
            });

            displayedPeriods.add(entry.period);
        });
    }

    renderPage(currentPage);

    // Add pagination controls
    const paginationControls = document.createElement('div');
    paginationControls.className = 'pagination-controls';

    const prevButton = document.createElement('button');
    prevButton.textContent = getTranslation('previous');
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage(currentPage);
            updatePaginationControls();
        }
    };

    const nextButton = document.createElement('button');
    nextButton.textContent = getTranslation('next');
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPage(currentPage);
            updatePaginationControls();
        }
    };

    const pageInfo = document.createElement('span');
    paginationControls.appendChild(prevButton);
    paginationControls.appendChild(pageInfo);
    paginationControls.appendChild(nextButton);

    function updatePaginationControls() {
        pageInfo.textContent = getTranslation('pageXofY', { x: currentPage, y: totalPages });
        prevButton.disabled = currentPage === 1;
        nextButton.disabled = currentPage === totalPages;
    }

    updatePaginationControls();

    reportResults.appendChild(table);
    reportResults.appendChild(paginationControls);
}

function exportReportAsCSV() {
    if (!currentReport) {
        alert('Please generate a report before exporting.');
        return;
    }

    let csvContent = "Period,Total Time,Description,Time Spent,Project\n";

    for (const [period, data] of Object.entries(currentReport)) {
        data.entries.forEach(entry => {
            const row = [
                period,
                formatDuration(data.total),
                (entry.description || 'No description').replace(/"/g, '""'), // Escape quotes
                formatDuration(entry.duration),
                entry.projectName
            ];
            csvContent += `"${row.join('","')}"\n`;
        });
    }

    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, 'time_tracker_report.csv');
        } else {
            link.href = URL.createObjectURL(blob);
            link.download = 'time_tracker_report.csv';
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        log(LogLevel.INFO,'CSV export successful');
    } catch (error) {
        log(LogLevel.ERROR,'Error exporting CSV:', error);
        alert('An error occurred while exporting the CSV. Please try again.');
    }
}

function exportReportAsPDF() {
    if (!currentReport) {
        alert('Please generate a report before exporting.');
        return;
    }

    try {
        if (typeof jspdf === 'undefined') {
            throw new Error('jsPDF library is not loaded');
        }

        const { jsPDF } = jspdf;
        const doc = new jsPDF();

        // Helper function to wrap text
        function splitTextToSize(text, maxWidth) {
            return doc.splitTextToSize(text, maxWidth);
        }

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;
        const usableWidth = pageWidth - 2 * margin;

        doc.setFontSize(18);
        doc.text('Time Tracker Report', margin, yPos);
        yPos += 10;

        doc.setFontSize(12);
        for (const [period, data] of Object.entries(currentReport)) {
            // Check if we need a new page
            if (yPos > pageHeight - 40) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFont(undefined, 'bold');
            doc.text(`Period: ${period}`, margin, yPos);
            yPos += 7;
            doc.text(`Total Time: ${formatDuration(data.total)}`, margin, yPos);
            yPos += 10;

            doc.setFont(undefined, 'normal');
            
            // Set up columns
            const colWidths = [usableWidth * 0.5, usableWidth * 0.2, usableWidth * 0.3];
            const startX = margin;

            // Table header
            doc.setFillColor(240, 240, 240);
            doc.rect(startX, yPos, usableWidth, 8, 'F');
            doc.setTextColor(0);
            doc.text('Description', startX + 2, yPos + 6);
            doc.text('Time Spent', startX + colWidths[0] + 2, yPos + 6);
            doc.text('Project', startX + colWidths[0] + colWidths[1] + 2, yPos + 6);
            yPos += 10;

            // Table rows
            data.entries.forEach(entry => {
                const descLines = splitTextToSize(entry.description || 'No description', colWidths[0] - 4);
                const lineHeight = 7;

                // Check if we need a new page
                if (yPos + descLines.length * lineHeight > pageHeight - margin) {
                    doc.addPage();
                    yPos = 20;
                }

                // Description
                descLines.forEach((line, index) => {
                    doc.text(line, startX + 2, yPos + 5 + (index * lineHeight));
                });

                // Time Spent
                doc.text(formatDuration(entry.duration), startX + colWidths[0] + 2, yPos + 5);

                // Project
                doc.text(entry.projectName, startX + colWidths[0] + colWidths[1] + 2, yPos + 5);

                // Draw cell borders
                doc.rect(startX, yPos, colWidths[0], descLines.length * lineHeight);
                doc.rect(startX + colWidths[0], yPos, colWidths[1], descLines.length * lineHeight);
                doc.rect(startX + colWidths[0] + colWidths[1], yPos, colWidths[2], descLines.length * lineHeight);

                yPos += descLines.length * lineHeight;
            });

            yPos += 10; // Space between periods
        }

        doc.save('time_tracker_report.pdf');
        log(LogLevel.INFO,'PDF export successful');
    } catch (error) {
        log(LogLevel.ERROR,'Error generating PDF:', error);
        alert('An error occurred while generating the PDF. Please check if the jsPDF library is properly loaded and try again.');
    }
}

function debugJsPDF() {
    if (typeof jspdf !== 'undefined') {
        log(LogLevel.INFO,'jsPDF is loaded correctly');
        log(LogLevel.INFO,'jsPDF version:', jspdf.version);
    } else {
        log(LogLevel.ERROR,'jsPDF is not loaded');
    }
}

function exportReportAsMarkdown() {
    if (!currentReport) {
        alert('Please generate a report before exporting.');
        return;
    }

    const TOTAL_WIDTH = 90; // Total width of the Markdown document
    const TIME_SPENT_WIDTH = 12; // Fixed width for time spent column
    const MIN_PROJECT_WIDTH = 10; // Minimum width for project column
    const MIN_DESC_WIDTH = 20; // Minimum width for description column

    let mdContent = "# Time Tracker Report\n\n";

    function wrapText(text, maxWidth) {
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';

        words.forEach(word => {
            if ((currentLine + word).length <= maxWidth) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });
        if (currentLine) lines.push(currentLine);

        return lines;
    }

    function padString(str, length) {
        return str.padEnd(length);
    }

    for (const [period, data] of Object.entries(currentReport)) {
        mdContent += `## ${period}\n\n`;
        mdContent += `**Total Time:** ${formatDuration(data.total)}\n\n`;

        // Calculate column widths
        const longestProjectName = Math.max(...data.entries.map(e => e.projectName.length));
        const maxProjectWidth = Math.max(longestProjectName, MIN_PROJECT_WIDTH);
        const descWidth = TOTAL_WIDTH - TIME_SPENT_WIDTH - maxProjectWidth - 7; // 7 for '| ' and ' | ' and an extra space

        // Create table header
        mdContent += `| ${'Description'.padEnd(descWidth)} | ${'Time Spent'.padEnd(TIME_SPENT_WIDTH)} | ${'Project'.padEnd(maxProjectWidth)} |\n`;
        mdContent += `| ${'-'.repeat(descWidth)} | ${'-'.repeat(TIME_SPENT_WIDTH)} | ${'-'.repeat(maxProjectWidth)} |\n`;

        // Add table rows
        data.entries.forEach(entry => {
            const wrappedDesc = wrapText(entry.description || 'No description', descWidth);
            const wrappedProject = wrapText(entry.projectName, maxProjectWidth);
            const maxLines = Math.max(wrappedDesc.length, wrappedProject.length);

            for (let i = 0; i < maxLines; i++) {
                let descLine = i < wrappedDesc.length ? wrappedDesc[i] : '';
                const projectLine = i < wrappedProject.length ? padString(wrappedProject[i], maxProjectWidth) : ' '.repeat(maxProjectWidth);
                const timeSpent = i === 0 ? padString(formatDuration(entry.duration), TIME_SPENT_WIDTH) : ' '.repeat(TIME_SPENT_WIDTH);

                // Ensure description line is exactly descWidth characters
                descLine = padString(descLine.slice(0, descWidth), descWidth);

                mdContent += `| ${descLine} | ${timeSpent} | ${projectLine} |\n`;
            }
        });
        mdContent += "\n";
    }

    try {
        const blob = new Blob([mdContent], {type: 'text/markdown;charset=utf-8;'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'time_tracker_report.md';
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        log(LogLevel.ERROR,'Error exporting Markdown:', error);
        alert('An error occurred while exporting the Markdown. Please try again.');
    }
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], {type: mimeType});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
}

function addExportButtons() {
    const reportResults = document.getElementById('reportResults');
    const exportButtonsContainer = document.createElement('div');
    exportButtonsContainer.className = 'export-buttons';

    const formats = [
        { name: 'CSV', func: exportReportAsCSV },
        { name: 'PDF', func: exportReportAsPDF },
        { name: 'Markdown', func: exportReportAsMarkdown }
    ];

    formats.forEach(format => {
        const button = document.createElement('button');
        button.textContent = `Export as ${format.name}`;
        button.addEventListener('click', format.func);
        exportButtonsContainer.appendChild(button);
    });

    reportResults.insertBefore(exportButtonsContainer, reportResults.firstChild);
}

function debugReportData() {
  log(LogLevel.DEBUG,'Current report data:', window.currentReport);
}

function addColumnSelection() {
    log(LogLevel.DEBUG,"Adding column selection");
    const columnSelection = document.createElement('div');
    columnSelection.id = 'columnSelection';
    columnSelection.className = 'column-selection';

    const columns = [
        { id: 'period', name: 'period', checked: true },
        { id: 'totalTime', name: 'totalTime', checked: true },
        { id: 'description', name: 'description', checked: true },
        { id: 'timeSpent', name: 'timeSpent', checked: true },
        { id: 'project', name: 'project', checked: true }
    ];

    const columnSelectionTitle = document.createElement('h4');
    columnSelectionTitle.textContent = getTranslation('selectColumnsToDisplay');
    columnSelectionTitle.setAttribute('data-i18n', 'selectColumnsToDisplay');
    columnSelection.appendChild(columnSelectionTitle);

    columns.forEach(column => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `column-${column.id}`;
        checkbox.checked = column.checked;

        label.appendChild(checkbox);
        const textNode = document.createTextNode(getTranslation(column.name));
        label.appendChild(textNode);
        label.setAttribute('data-i18n', column.name);
        columnSelection.appendChild(label);
    });

    const reportControls = document.querySelector('.report-controls');
    if (reportControls) {
        reportControls.appendChild(columnSelection);
        log(LogLevel.DEBUG,"Column selection added to report controls");
    } else {
        log(LogLevel.ERROR,"Report controls element not found");
    }
}

function updateReportDisplay() {
    const selectedColumns = Array.from(document.querySelectorAll('#columnSelection input:checked'))
        .map(checkbox => checkbox.id.replace('column-', ''));
    
    // Re-generate the report with selected columns
    generateReport(selectedColumns);
}

// Keyboard navigation

function initializeKeyboardNavigation() {
    addSkipLinks();
    initializeTabNavigation();
    initializeTimerKeyboardControl();
    initializeDateRangeKeyboardControl();
    initializeReportGenerationKeyboardControl();
    initializeModalKeyboardControl();
}

function addSkipLinks() {
    const skipLinksContainer = document.createElement('div');
    skipLinksContainer.className = 'skip-links';

    const links = [
        { text: 'Skip to project section', target: '.project-section' },
        { text: 'Skip to time entry section', target: '.time-entries-section' },
        { text: 'Skip to chart & report tabs', target: '.chart-and-report-container' }
    ];

    links.forEach(link => {
        const skipLink = document.createElement('a');
        skipLink.textContent = link.text;
        skipLink.href = '#';
        skipLink.className = 'skip-link';
        
        skipLink.addEventListener('click', (event) => {
            event.preventDefault();
            const target = document.querySelector(link.target);
            if (target) {
                target.tabIndex = -1;
                target.focus();
                // Remove tabIndex after focus to prevent an additional tab stop
                setTimeout(() => target.removeAttribute('tabIndex'), 100);
            }
        });

        skipLinksContainer.appendChild(skipLink);
    });

    document.body.insertBefore(skipLinksContainer, document.body.firstChild);
}

function initializeTabNavigation() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('keydown', handleTabKeyDown);
    });
}

function initializeTimerKeyboardControl() {
    const playPauseButton = document.getElementById('playPauseButton');
    const stopButton = document.getElementById('stopButton');
    playPauseButton.addEventListener('keydown', handleTimerButtonKeyDown);
    stopButton.addEventListener('keydown', handleTimerButtonKeyDown);
}

function initializeDateRangeKeyboardControl() {
    const quickDateRange = document.getElementById('quickDateRange');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const applyDateRange = document.getElementById('applyDateRange');

    quickDateRange.addEventListener('keydown', handleSelectKeyDown);
    startDate.addEventListener('keydown', handleDateInputKeyDown);
    endDate.addEventListener('keydown', handleDateInputKeyDown);
    applyDateRange.addEventListener('keydown', handleButtonKeyDown);
}

function initializeReportGenerationKeyboardControl() {
    const generateReport = document.getElementById('generateReport');
    generateReport.addEventListener('keydown', handleButtonKeyDown);
}

function initializeModalKeyboardControl() {
    const infoButton = document.querySelector('.info-icon');
    const modal = document.getElementById('infoModal');
    const closeButton = modal.querySelector('.close');

    infoButton.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openModal();
        }
    });

    closeButton.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            closeModal();
        }
    });

    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal();
        }
    });
}

function handleTabKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const tabId = event.target.id;
        activateTab(tabId);
    }
}

function activateTab(tabId) {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-section');

    tabs.forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });

    tabContents.forEach(content => {
        content.classList.remove('active');
        content.hidden = true;
    });

    const selectedTab = document.getElementById(tabId);
    const selectedContent = document.getElementById(tabId.replace('Tab', 'Section'));

    selectedTab.classList.add('active');
    selectedTab.setAttribute('aria-selected', 'true');
    selectedContent.classList.add('active');
    selectedContent.hidden = false;

    // Set focus to the activated tab content
    selectedContent.focus();
}

function handleTimerButtonKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.target.click();
    }
}

function handleSelectKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.target.click();
    }
}

function handleDateInputKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur();
    }
}

function handleButtonKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.target.click();
    }
}

function openModal() {
    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.style.display = 'block';
        modal.setAttribute('aria-hidden', 'false');
        
        // Set focus to the first focusable element in the modal
        const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableElements.length) {
            focusableElements[0].focus();
        }

        // Set up focus trap
        modal.addEventListener('keydown', trapFocus);
    }
}

function closeModal() {
    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        // Remove focus trap
        modal.removeEventListener('keydown', trapFocus);
        // Return focus to the info button
        const infoButton = document.querySelector('.info-icon');
        if (infoButton) {
            infoButton.focus();
        }
    }
}

function trapFocus(e) {
    const modal = document.getElementById('infoModal');
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.key === 'Tab') {
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }
}

/* Database operations */
function importDatabase(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.projects || !data.timeEntries) {
                throw new Error('Invalid file format');
            }

            dbReady.then(() => {
                const tx = db.transaction(['projects', 'timeEntries'], 'readwrite');
                const projectStore = tx.objectStore('projects');
                const timeEntryStore = tx.objectStore('timeEntries');

                // Clear existing data
                projectStore.clear();
                timeEntryStore.clear();

                // Import new data
                data.projects.forEach(project => projectStore.add(project));
                data.timeEntries.forEach(entry => timeEntryStore.add(entry));

                tx.oncomplete = function() {
                    log(LogLevel.INFO, 'Database import completed');
                    loadProjects();
                    loadTimeEntries();
                    visualizeProjectData();
                    populateProjectSelection();
                    showError('Database imported successfully');
                };
            });
        } catch (error) {
            log(LogLevel.ERROR, 'Error importing database:', error);
            showError('Failed to import database: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function exportDatabase() {
    dbReady.then(() => {
        const data = {};
        const tx = db.transaction(['projects', 'timeEntries'], 'readonly');
        const projectStore = tx.objectStore('projects');
        const timeEntryStore = tx.objectStore('timeEntries');

        projectStore.getAll().onsuccess = function(event) {
            data.projects = event.target.result;
            timeEntryStore.getAll().onsuccess = function(event) {
                data.timeEntries = event.target.result;
                
                // Convert data to JSON string
                const jsonString = JSON.stringify(data, null, 2);
                
                // Create a Blob with the JSON data
                const blob = new Blob([jsonString], {type: 'application/json'});
                
                // Create a download link and trigger the download
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'tito_database_export.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Error exporting database:', error);
        showError('Failed to export database');
    });
}

function clearDatabase() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        dbReady.then(() => {
            let transaction = db.transaction(['projects', 'timeEntries'], 'readwrite');
            let projectStore = transaction.objectStore('projects');
            projectStore.clear().onsuccess = function() {
                log(LogLevel.INFO,'Projects cleared');
                loadProjects(); // Update UI after clearing
            };
            let timeEntryStore = transaction.objectStore('timeEntries');
            timeEntryStore.clear().onsuccess = function() {
                log(LogLevel.INFO,'Time entries cleared');
                if (projectChart) {
                    projectChart.destroy();
                    projectChart = null;
                }
                visualizeProjectData(); // This will create a new, empty chart
                location.reload();
            };

            transaction.onerror = function(event) {
                log(LogLevel.ERROR, 'Error clearing database:', event.target.errorCode);
                showError('Error clearing database');
            };
        }).catch(error => {
            log(LogLevel.ERROR, "Error clearing database");
            showError('Error opening database for clearing');
        });
    }
}

/* Utility functions */
function showError(message) {
    alert(getTranslation(message) || message);
}

function setTimerProject(projectId) {
    log(LogLevel.INFO, `Setting timerProject to: ${projectId}`);
    timerProject = projectId;
}

function isValidTime(timeString) {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(timeString);
}

function formatDuration(duration) {
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDate(date) {
    return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
}

function formatTime(date) {
    return date.toTimeString().slice(0, 5); // Format: HH:MM (24-hour)
}

function range(start, end) {
    return Array.from({length: end - start}, (_, i) => start + i);
}

function calculateProjectTotals(timeEntries) {
    const projectTotals = {};
    timeEntries.forEach(entry => {
        if (!projectTotals[entry.projectId]) {
            projectTotals[entry.projectId] = 0;
        }
        projectTotals[entry.projectId] += entry.duration;
    });
    return projectTotals;
}

document.addEventListener('DOMContentLoaded', initializeTabs);
