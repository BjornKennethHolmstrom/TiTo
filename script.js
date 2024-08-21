// script.js

// Define log levels
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Set the current log level (you would change this for production)
let currentLogLevel = LogLevel.DEBUG;

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

// Global Variables
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
let currentSortOrder = 'newest'; // Default sort order

document.addEventListener('DOMContentLoaded', function() {
    initializeDB();
    initializeUI();
    startTimerDisplayUpdate();
    dbReady.then(() => {
        return loadProjects();
    }).then(() => {
        loadTimeEntries();
    }).catch(error => {
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

    const sortNewestFirstButton = document.getElementById('sortNewestFirstButton');
    const sortOldestFirstButton = document.getElementById('sortOldestFirstButton');

    if (sortNewestFirstButton) {
        sortNewestFirstButton.addEventListener('click', () => {
            sortTimeEntries('newest');
            updateSortButtonStates('newest');
        });
    }

    if (sortOldestFirstButton) {
        sortOldestFirstButton.addEventListener('click', () => {
            sortTimeEntries('oldest');
            updateSortButtonStates('oldest');
        });
    }

    // Set initial button state
    updateSortButtonStates(currentSortOrder);
}

function updateSortButtonStates(activeOrder) {
    const newestButton = document.getElementById('sortNewestFirstButton');
    const oldestButton = document.getElementById('sortOldestFirstButton');

    if (activeOrder === 'newest') {
        newestButton.classList.add('pressed');
        oldestButton.classList.remove('pressed');
    } else {
        oldestButton.classList.add('pressed');
        newestButton.classList.remove('pressed');
    }

    currentSortOrder = activeOrder;
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

function showError(message) {
    alert(message); // For now, we'll use a simple alert. In the future, we can create a more sophisticated error display.
}

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
            const projects = event.target.result;
            console.log('Loaded projects:', projects);  // Add this line
            renderProjectList(projects);
            if (projects.length === 1) {
                setCurrentProject(projects[0]);
            }
        };

        request.onerror = function(event) {  // Add this error handler
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

let dragSrcEl = null;

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
    
// We also need to modify the loadProjects function to respect the order
function loadProjects() {
    dbReady.then(() => {
        let transaction = db.transaction(['projects'], 'readonly');
        let store = transaction.objectStore('projects');
        let request = store.getAll();

        request.onsuccess = function(event) {
            let projects = event.target.result;
            // Sort projects by their order before rendering
            projects.sort((a, b) => (a.order || 0) - (b.order || 0));
            log(LogLevel.INFO, 'Loaded projects:', projects);
            renderProjectList(projects);
            if (projects.length === 0) {
                currentProject = null;
                clearTimeEntryList();
            } else if (!currentProject || !projects.some(p => p.id === currentProject.id)) {
                setCurrentProject(projects[0]);
            }
        };

        request.onerror = function(event) {
            log(LogLevel.ERROR, 'Error loading projects:', event);
            showError('Error loading projects from database');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error in loadProjects:', error);
        showError('Failed to load projects due to a database error');
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
    loadTimeEntries().catch(error => {
        log(LogLevel.ERROR, 'Error loading time entries:', error);
        showError('Failed to load time entries for the selected project');
    });

    updateTimerProjectDisplay();
    log(LogLevel.DEBUG, 'After setCurrentProject');
}

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
                            loadTimeEntries().then(() => {
                                // Scroll to top or bottom based on sort order
                                const timeEntryList = document.getElementById('timeEntryList');
                                if (currentSortOrder === 'newest') {
                                    timeEntryList.scrollTop = 0;
                                } else {
                                    scrollToBottom(timeEntryList);
                                }
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
    //console.log('resetTimer called from:', new Error().stack);
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

function formatDuration(duration) {
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

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
                const timeEntries = event.target.result;
                log(LogLevel.INFO, 'Loaded time entries', timeEntries);
                
                // Sort time entries based on current sort order
                timeEntries.sort((a, b) => {
                    if (currentSortOrder === 'newest') {
                        return new Date(b.start) - new Date(a.start);
                    } else {
                        return new Date(a.start) - new Date(b.start);
                    }
                });
                
                renderTimeEntryList(timeEntries);
                visualizeProjectData();

                // Scroll to top or bottom based on sort order
                const timeEntryList = document.getElementById('timeEntryList');
                if (currentSortOrder === 'newest') {
                    timeEntryList.scrollTop = 0;
                } else {
                    scrollToBottom(timeEntryList);
                }

                resolve();
            };

            request.onerror = function(event) {
                log(LogLevel.ERROR, 'Error loading time entries:', event);
                reject('Error loading time entries from database');
            };
        });
    });
}

function sortTimeEntries(order) {
    if (!currentProject) {
        showError('Please select a project first.');
        return;
    }

    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readwrite');
        let store = transaction.objectStore('timeEntries');
        let index = store.index('projectId');
        let request = index.getAll(currentProject.id);

        request.onsuccess = function(event) {
            let timeEntries = event.target.result;
            
            // Sort time entries by start time
            timeEntries.sort((a, b) => {
                const dateA = new Date(a.start);
                const dateB = new Date(b.start);
                return order === 'newest' ? dateB - dateA : dateA - dateB;
            });
            
            // Update order in the database
            timeEntries.forEach((entry, index) => {
                entry.order = index;
                store.put(entry);
            });

            transaction.oncomplete = function() {
                log(LogLevel.INFO, `Time entries sorted ${order} first and order updated in database`);
                renderTimeEntryList(timeEntries);
                
                // Scroll to top if sorting newest first, otherwise scroll to bottom
                const timeEntryList = document.getElementById('timeEntryList');
                if (order === 'newest') {
                    timeEntryList.scrollTop = 0;
                } else {
                    scrollToBottom(timeEntryList);
                }
            };
        };

        request.onerror = function(event) {
            log(LogLevel.ERROR, 'Error retrieving time entries for sorting:', event);
            showError('Error sorting time entries');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error:', error);
        showError('Failed to sort time entries due to a database error');
    });
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

        // Create input field for description
        const descriptionInput = document.createElement('input');
        descriptionInput.type = 'text';
        descriptionInput.className = 'description-input';
        descriptionInput.value = entry.description || '';
        descriptionInput.placeholder = 'Enter task description';

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
        listItem.appendChild(descriptionInput);

        // Create the remove button with trash can emoji
        const removeButton = document.createElement('button');
        removeButton.textContent = '🗑️';
        removeButton.className = 'remove-time-entry-button';
        removeButton.title = 'Delete entry';
        removeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            removeTimeEntry(entry.id);
        });

        listItem.appendChild(removeButton);

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

function scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
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

function isValidTime(timeString) {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(timeString);
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
            loadTimeEntries(); // Reload the time entries after removal
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
        order: currentSortOrder === 'newest' ? -1 : Number.MAX_SAFE_INTEGER // Set order based on current sort
    };

    console.log('Adding manual entry:', entry);

    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readwrite');
        let store = transaction.objectStore('timeEntries');

        let request = store.add(entry);

        request.onsuccess = function(event) {
            console.log('Manual time entry added successfully');
            loadTimeEntries().then(() => {
                const timeEntryList = document.getElementById('timeEntryList');
                if (currentSortOrder === 'oldest') {
                    // Scroll to bottom only when sorted oldest first
                    scrollToBottom(timeEntryList);
                } else {
                    // Scroll to top when sorted newest first
                    timeEntryList.scrollTop = 0;
                }
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

function visualizeProjectData() {
    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readonly');
        let store = transaction.objectStore('timeEntries');
        let request = store.getAll();

        request.onsuccess = function(event) {
            const timeEntries = event.target.result;
            const projectTotals = calculateProjectTotals(timeEntries);
            renderProjectChart(projectTotals);
        };

        request.onerror = function(event) {
            log(LogLevel.ERROR, 'Error fetching time entries for visualization:', event);
            showError('Failed to fetch data for visualization.');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error:', error);
        showError('Failed to visualize data due to a database error.');
    });
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

function renderProjectChart(projectTotals) {
    const ctx = document.getElementById('projectChart').getContext('2d');
    
    // Fetch projects and sort them by their order
    dbReady.then(() => {
        let transaction = db.transaction(['projects'], 'readonly');
        let store = transaction.objectStore('projects');
        let request = store.getAll();

        request.onsuccess = function(event) {
            const projects = event.target.result;
            
            // Sort projects by their order
            projects.sort((a, b) => (a.order || 0) - (b.order || 0));

            const labels = [];
            const data = [];

            projects.forEach(project => {
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
                        text: 'Time Spent on Projects'
                    }
                }
            };

            if (projectChart) {
                // Update existing chart
                projectChart.data = chartData;
                projectChart.options = chartOptions;
                projectChart.update();
            } else {
                // Create new chart
                projectChart = new Chart(ctx, {
                    type: 'bar',
                    data: chartData,
                    options: chartOptions
                });
            }
        };

        request.onerror = function(event) {
            log(LogLevel.ERROR, 'Error fetching projects for chart:', event);
            showError('Failed to fetch project data for chart.');
        };
    }).catch(error => {
        log(LogLevel.ERROR, 'Database error:', error);
        showError('Failed to render chart due to a database error.');
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


function setTimerProject(projectId) {
    log(LogLevel.INFO, `Setting timerProject to: ${projectId}`);
    timerProject = projectId;
}


// Add this utility function to help with debugging
/*function addStackTraceToFunction(func, funcName) {
    return function(...args) {
        console.log(`${funcName} called from:`, new Error().stack);
        return func.apply(this, args);
    };
}*/

// Wrap key functions with stack trace logging
//stopTimer = addStackTraceToFunction(stopTimer, 'stopTimer');
//saveTimeEntry = addStackTraceToFunction(saveTimeEntry, 'saveTimeEntry');
//resetTimer = addStackTraceToFunction(resetTimer, 'resetTimer');

