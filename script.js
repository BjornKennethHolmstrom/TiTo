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

/* Initialization functions */
document.addEventListener('DOMContentLoaded', function() {
    initializeDB();
    initializeUI();
    startTimerDisplayUpdate();

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
    const addProjectButton = document.getElementById('addProjectButton');
    const playPauseButton = document.getElementById('playPauseButton');
    const stopButton = document.getElementById('stopButton');
    const addManualEntryButton = document.getElementById('addManualEntryButton');
    const clearDatabaseButton = document.getElementById('clearDatabaseButton');
    const newProjectNameInput = document.getElementById('newProjectName');
    const exportDatabaseButton = document.getElementById('exportDatabaseButton');
    const importDatabaseButton = document.getElementById('importDatabaseButton');
    const importFileInput = document.getElementById('importFileInput');

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

    const chartTabs = document.querySelectorAll('.chart-tab');
    const chartSections = document.querySelectorAll('.chart-section');

    if (chartTabs.length === 0 || chartSections.length === 0) {
        log(LogLevel.WARN, 'Chart tabs or sections not found');
    } else {
        chartTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.getAttribute('data-tab');
                if (!targetId) {
                    log(LogLevel.WARN, 'Tab missing data-tab attribute');
                    return;
                }

                // Remove active class from all tabs and sections
                chartTabs.forEach(t => t.classList.remove('active'));
                chartSections.forEach(s => s.classList.remove('active'));

                // Add active class to clicked tab and corresponding section
                tab.classList.add('active');
                const targetSection = document.getElementById(`${targetId}ChartSection`);
                if (targetSection) {
                    targetSection.classList.add('active');
                    // Trigger chart update if necessary
                    if (targetId === 'timeRange') {
                        visualizeProjectData();
                    }
                } else {
                    log(LogLevel.WARN, `Chart section not found: ${targetId}ChartSection`);
                }
            });
        });

        log(LogLevel.INFO, 'Chart tab switching initialized');
    }

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
}

/* Project related functions */
function addProject() {
    const projectName = document.getElementById('newProjectName').value.trim();
    if (!projectName) {
        showError('Project name cannot be empty.');
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

    projects.forEach((project, index) => {
        const listItem = document.createElement('li');
        listItem.dataset.projectId = project.id;
        listItem.draggable = true;

        const projectName = document.createElement('span');
        projectName.textContent = project.name;
        projectName.className = 'project-name';
        projectName.contentEditable = true;

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
        deleteButton.title = 'Delete project';
        deleteButton.addEventListener('click', function(event) {
            event.stopPropagation();
            deleteProject(project.id);
        });

        listItem.appendChild(projectName);
        listItem.appendChild(deleteButton);

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
        }
    }
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

    console.log('Current project set to:', project);

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
//     timeEntries.sort((a, b) => a.order - b.order);

    const timeEntryListElement = document.getElementById('timeEntryList');
    timeEntryListElement.innerHTML = '';

    timeEntries.forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.draggable = true;
        listItem.dataset.entryId = entry.id;
        
        // Create inputs for start date and time
        const startDate = new Date(entry.start);
        const startDateInput = createDateInput(startDate, 'start-date');
        const startDateDisplay = createDateDisplay(startDate, 'start-date-display');
        const startTimeInput = createTimeInput(startDate, 'start-time');
        
        // Create inputs for end date and time
        const endDate = new Date(entry.end);
        const endDateInput = createDateInput(endDate, 'end-date');
        const endDateDisplay = createDateDisplay(endDate, 'end-date-display');
        const endTimeInput = createTimeInput(endDate, 'end-time');
        
        // Create span for total time
        const totalTimeSpan = document.createElement('span');
        totalTimeSpan.className = 'total-time';
        totalTimeSpan.textContent = formatDuration(entry.duration);

        const descriptionInputContainer = document.createElement('div');
        descriptionInputContainer.className = 'description-input-container';

        // Create input field for description
        const descriptionInput = document.createElement('input');
        descriptionInput.type = 'text';
        descriptionInput.className = 'description-input';
        descriptionInput.value = entry.description || '';
        descriptionInput.placeholder = 'Enter task description';

        // Create the remove button with trash can emoji
        const removeButton = document.createElement('button');
        removeButton.textContent = '🗑️';
        removeButton.className = 'remove-time-entry-button';
        removeButton.title = 'Delete entry';
        removeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            removeTimeEntry(entry.id);
        });

        descriptionInputContainer.appendChild(descriptionInput);
        descriptionInputContainer.appendChild(removeButton);

        // Append all elements
        listItem.appendChild(document.createTextNode('Start: '));
        listItem.appendChild(startDateInput);
        listItem.appendChild(startDateDisplay);
        listItem.appendChild(startTimeInput);
        listItem.appendChild(document.createTextNode(' End: '));
        listItem.appendChild(endDateInput);
        listItem.appendChild(endDateDisplay);
        listItem.appendChild(endTimeInput);
        listItem.appendChild(document.createTextNode(' Total: '));
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
    
    console.log('New time entry order:', newOrder);
    
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

function createDateInput(date, name) {
    const input = document.createElement('input');
    input.type = 'date';
    input.name = name;
    input.value = formatDate(date);
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
    return span;
}


function createTimeInput(date, name) {
    const input = document.createElement('input');
    input.type = 'text'; // Change to text input
    input.name = name;
    input.value = formatTime(date);
    input.placeholder = 'HH:MM';
    input.pattern = '([01]?[0-9]|2[0-3]):[0-5][0-9]';
    input.title = 'Enter time in 24-hour format (HH:MM)';
    
    input.addEventListener('blur', function() {
        if (this.value && !isValidTime(this.value)) {
            showError('Invalid time format. Please use HH:MM in 24-hour format.');
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
    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readwrite');
        let store = transaction.objectStore('timeEntries');
        let request = store.delete(id);

        request.onsuccess = function() {
            console.log('Time entry removed');
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

    console.log('Adding manual entry:', entry);

    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readwrite');
        let store = transaction.objectStore('timeEntries');

        let request = store.add(entry);

        request.onsuccess = function(event) {
            console.log('Manual time entry added successfully');
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
                        timerProjectDisplay.textContent = `Timer running for: ${project.name}`;
                        timerProjectDisplay.style.display = 'block';
                    } else {
                        timerProjectDisplay.textContent = 'Timer running for: Unknown project';
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
            label: 'Hours Spent',
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
                    text: 'Hours'
                }
            }
        },
        plugins: {
            title: {
                display: true,
                text: 'Overall Time Spent on Projects'
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

function updateTimeRangeCharts(projectTotals, startDate, endDate) {
    if (typeof Chart === 'undefined') {
        log(LogLevel.ERROR, 'Chart.js is not loaded');
        showError('Chart.js library is not available. Please check your internet connection and reload the page.');
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
                text: `Time Distribution (${startDate} to ${endDate})`
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
                    text: 'Hours'
                }
            }
        },
        plugins: {
            title: {
                display: true,
                text: `Time Spent on Projects (${startDate} to ${endDate})`
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
  const reportType = document.getElementById('reportType');
  const startDate = document.getElementById('reportStartDate');
  const endDate = document.getElementById('reportEndDate');
  const generateButton = document.getElementById('generateReport');
  const selectAllButton = document.getElementById('selectAllProjects');
  const deselectAllButton = document.getElementById('deselectAllProjects');

  // Set default dates
  const today = new Date();
  endDate.value = formatDate(today);
  startDate.value = formatDate(new Date(today.getFullYear(), today.getMonth(), 1)); // First day of current month

  // Populate project selection
  populateProjectSelection();

  // Add event listeners
  generateButton.addEventListener('click', generateReport);
  selectAllButton.addEventListener('click', selectAllProjects);
  deselectAllButton.addEventListener('click', deselectAllProjects);
}

function populateProjectSelection() {
    const projectSelection = document.getElementById('projectSelection');
    projectSelection.innerHTML = ''; // Clear existing checkboxes

    dbReady.then(() => {
        let transaction = db.transaction(['projects'], 'readonly');
        let store = transaction.objectStore('projects');
        let request = store.getAll();

        request.onsuccess = function(event) {
            const projects = event.target.result;
            // Sort projects based on their order property
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
        };
    });
}

function initializeProjectSelection() {
    const projectSelection = document.getElementById('projectSelection');
    let isMouseDown = false;
    let startElement = null;

    projectSelection.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        startElement = e.target.closest('.project-checkbox-wrapper');
        if (startElement) {
            const checkbox = startElement.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
        }
    });

    projectSelection.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;

        const currentElement = e.target.closest('.project-checkbox-wrapper');
        if (currentElement && currentElement !== startElement) {
            const checkbox = currentElement.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            startElement = currentElement;
        }
    });

    document.addEventListener('mouseup', () => {
        isMouseDown = false;
        startElement = null;
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

function generateReport() {
  const reportType = document.getElementById('reportType').value;
  const startDate = new Date(document.getElementById('reportStartDate').value);
  const endDate = new Date(document.getElementById('reportEndDate').value);
  const selectedProjects = Array.from(document.querySelectorAll('#projectSelection input:checked')).map(cb => parseInt(cb.value));

  if (selectedProjects.length === 0) {
    alert('Please select at least one project.');
    return;
  }

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
      const projectMap = new Map(allProjects.map(p => [p.id, p.name]));
      
      const filteredEntries = allTimeEntries.filter(entry => 
        selectedProjects.includes(entry.projectId) &&
        new Date(entry.start) >= startDate &&
        new Date(entry.end) <= endDate
      ).map(entry => ({
        ...entry,
        projectName: projectMap.get(entry.projectId)
      }));

      let report;
      if (reportType === 'weekly') {
        report = generateWeeklyReport(filteredEntries, startDate, endDate);
      } else {
        report = generateMonthlyReport(filteredEntries, startDate, endDate);
      }

      displayReport(report, selectedProjects.length > 1);
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
            let entryStart = new Date(entry.start);
            let entryEnd = new Date(entry.end);
            
            // Adjust entry start and end times if they fall outside the week
            if (entryStart < weekStart) entryStart = weekStart;
            if (entryEnd > weekEnd) entryEnd = weekEnd;
            
            return total + (entryEnd - entryStart);
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
            let entryStart = new Date(entry.start);
            let entryEnd = new Date(entry.end);
            
            // Adjust entry start and end times if they fall outside the month
            if (entryStart < monthStart) entryStart = monthStart;
            if (entryEnd > monthEnd) entryEnd = monthEnd;
            
            return total + (entryEnd - entryStart);
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

function displayReport(report, showProjectColumn) {
  const reportResults = document.getElementById('reportResults');
  reportResults.innerHTML = ''; // Clear previous results

  const table = document.createElement('table');
  table.className = 'report-table';

  // Create table header
  const headerRow = table.insertRow();
  const headers = ['Period', 'Total Time', 'Description', 'Time Spent'];
  if (showProjectColumn) headers.push('Project');
  headers.forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });

  // Create table body
  for (const [period, data] of Object.entries(report)) {
    // Add a row for the period summary
    const summaryRow = table.insertRow();
    
    const periodCell = summaryRow.insertCell();
    periodCell.textContent = period;
    periodCell.rowSpan = data.entries.length + 1; // +1 for the summary row itself

    const totalCell = summaryRow.insertCell();
    totalCell.textContent = formatDuration(data.total);
    totalCell.rowSpan = data.entries.length + 1;

    // Add rows for each entry
    data.entries.forEach((entry, index) => {
      const row = index === 0 ? summaryRow : table.insertRow();

      const descriptionCell = row.insertCell();
      descriptionCell.textContent = entry.description || 'No description';

      const timeSpentCell = row.insertCell();
      timeSpentCell.textContent = formatDuration(entry.duration);

      if (showProjectColumn) {
        const projectCell = row.insertCell();
        projectCell.textContent = entry.projectName;
      }
    });
  }

  reportResults.appendChild(table);
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
                    showError('Database imported successfully'); // Use showError for success message too
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
                console.log('Projects cleared');
                loadProjects(); // Update UI after clearing
            };
            let timeEntryStore = transaction.objectStore('timeEntries');
            timeEntryStore.clear().onsuccess = function() {
                console.log('Time entries cleared');
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
    alert(message); // For now, we'll use a simple alert. In the future, we can create a more sophisticated error display.
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

