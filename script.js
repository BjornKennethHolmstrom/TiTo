// script.js

// Global Variables
let db;
let dbReady = new Promise((resolve, reject) => {
    let request = indexedDB.open('TimeTrackerDB', 1);

    request.onerror = function(event) {
        console.error('Error opening IndexedDB:', event);
        reject('Failed to open IndexedDB');
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log('IndexedDB opened successfully');
        resolve();
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        let projectStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
        projectStore.createIndex('name', 'name', { unique: true });

        let timeEntryStore = db.createObjectStore('timeEntries', { keyPath: 'id', autoIncrement: true });
        timeEntryStore.createIndex('projectId', 'projectId', { unique: false });
        timeEntryStore.createIndex('description', 'description', { unique: false });
        console.log('IndexedDB upgrade completed');
    };
});

let currentProject = null;
let startTime;
let elapsedTime = 0;
let isPaused = false;
let isRunning = false;
let isTimerRunning = false;
let timerInterval;
let projectChart = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeUI();
    loadProjects().then(() => {
        loadTimeEntries();
    }).catch(error => {
        console.error('Error initializing app:', error);
        showError('Failed to initialize the app. Please refresh the page.');
    });
});

function initializeUI() {
    const addProjectButton = document.getElementById('addProjectButton');
    const playPauseButton = document.getElementById('playPauseButton');
    const stopButton = document.getElementById('stopButton');
    const addManualEntryButton = document.getElementById('addManualEntryButton');
    const clearDatabaseButton = document.getElementById('clearDatabaseButton');
    const newProjectNameInput = document.getElementById('newProjectName');

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
                console.error('Error adding project:', event);
                showError('Failed to add project. It might already exist.');
            };
        };
    }).catch(error => {
        console.error('Database error:', error);
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
            console.error('Error loading projects:', event);
            showError('Error loading projects!');
        };
    }).catch(error => {
        console.error('Database error in loadProjects:', error);
        showError('Failed to load project due to a database error.');
    });
}

function renderProjectList(projects) {
    console.log('Rendering projects:', projects);
    const projectListElement = document.getElementById('projectList');
    if (!projectListElement) {
        console.error('Project list element not found');
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
        projectName.addEventListener('click', function() {
            setCurrentProject(project);
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
        projectListElement.appendChild(listItem);

        // Add drag and drop event listeners
        listItem.addEventListener('dragstart', handleDragStart);
        listItem.addEventListener('dragover', handleDragOver);
        listItem.addEventListener('drop', handleDrop);
        listItem.addEventListener('dragend', handleDragEnd);
    });

    // Highlight the current project if one is selected
    if (currentProject) {
        const currentProjectItem = projectListElement.querySelector(`[data-project-id="${currentProject.id}"]`);
        if (currentProjectItem) {
            currentProjectItem.classList.add('selected');
        }
    }
}

let dragSrcEl = null;

function handleDragStart(e) {
    this.style.opacity = '0.4';
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (dragSrcEl != this) {
        // Get the project IDs
        const draggedProjectId = dragSrcEl.dataset.projectId;
        const targetProjectId = this.dataset.projectId;

        // Swap the HTML contents
        const tempHTML = dragSrcEl.innerHTML;
        dragSrcEl.innerHTML = this.innerHTML;
        this.innerHTML = tempHTML;

        // Swap the data-project-id attributes
        dragSrcEl.dataset.projectId = targetProjectId;
        this.dataset.projectId = draggedProjectId;

        // If the current project was involved in the swap, update it
        if (currentProject && (currentProject.id == draggedProjectId || currentProject.id == targetProjectId)) {
            const updatedProjectElement = document.querySelector(`#projectList li[data-project-id="${currentProject.id}"]`);
            if (updatedProjectElement) {
                setCurrentProject({
                    id: currentProject.id,
                    name: updatedProjectElement.querySelector('.project-name').textContent
                });
            }
        }

        // Reattach event listeners
        [dragSrcEl, this].forEach(item => {
            const projectName = item.querySelector('.project-name');
            const deleteButton = item.querySelector('.remove-project-button');
        
            // Remove existing listeners to prevent duplicates
            projectName.replaceWith(projectName.cloneNode(true));
            deleteButton.replaceWith(deleteButton.cloneNode(true));
        
            // Add new listeners
            item.querySelector('.project-name').addEventListener('click', function() {
                setCurrentProject({
                    id: parseInt(item.dataset.projectId),
                    name: this.textContent
                });
            });
        
            item.querySelector('.remove-project-button').addEventListener('click', function(event) {
                event.stopPropagation();
                deleteProject(parseInt(item.dataset.projectId));
            });
        });
    
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
    
function updateProjectOrder() {
    const projectItems = document.querySelectorAll('#projectList li');
    const newOrder = Array.from(projectItems).map(item => item.dataset.projectId);
    
    console.log('New project order:', newOrder);
    
    dbReady.then(() => {
        let transaction = db.transaction(['projects'], 'readwrite');
        let store = transaction.objectStore('projects');

        // First, retrieve all projects
        store.getAll().onsuccess = function(event) {
            let projects = event.target.result;
            
            // Sort projects based on the new order
            projects.sort((a, b) => {
                return newOrder.indexOf(a.id.toString()) - newOrder.indexOf(b.id.toString());
            });

            // Update each project with its new order
            projects.forEach((project, index) => {
                project.order = index;
                store.put(project);
            });
        };

        transaction.oncomplete = function() {
            console.log('Project order updated in database');
        };

        transaction.onerror = function(event) {
            console.error('Error updating project order:', event.target.error);
            showError('Error updating project order in database');
        };
    }).catch(error => {
        console.error('Database error:', error);
        showError('Failed to update project order due to a database error');
    });
}
    

function deleteProject(projectId) {
    if (confirm('Are you sure you want to delete this project? All associated time entries will also be deleted.')) {
        dbReady.then(() => {
            let transaction = db.transaction(['projects', 'timeEntries'], 'readwrite');
            let projectStore = transaction.objectStore('projects');
            let timeEntryStore = transaction.objectStore('timeEntries');

            // Delete the project
            projectStore.delete(projectId).onsuccess = function() {
                console.log('Project deleted');
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
                console.log('Project and associated time entries deleted');
                if (currentProject && currentProject.id === projectId) {
                    currentProject = null;
                    resetTimer();
                }
                loadProjects();
                if (currentProject) {
                    loadTimeEntries();
                } else {
                    clearTimeEntryList();
                }
            };
        }).catch(error => {
            console.error('Database error:', error);
            showError('Failed to delete project due to a database error');
        });
    }
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
            console.log('Loaded projects:', projects);
            renderProjectList(projects);
            if (projects.length === 0) {
                currentProject = null;
                clearTimeEntryList();
            } else if (!currentProject || !projects.some(p => p.id === currentProject.id)) {
                setCurrentProject(projects[0]);
            }
        };

        request.onerror = function(event) {
            console.error('Error loading projects:', event);
            showError('Error loading projects from database');
        };
    }).catch(error => {
        console.error('Database error in loadProjects:', error);
        showError('Failed to load projects due to a database error');
    });
}

function setCurrentProject(project) {
    currentProject = project;

    // Remove 'selected' class from all project items
    const projectItems = document.querySelectorAll('#projectList li');
    projectItems.forEach(item => item.classList.remove('selected'));

    // Add 'selected' class to the clicked project item
    const selectedItem = document.querySelector(`#projectList li[data-project-id="${project.id}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }

    console.log('Current project set to:', project);
    loadTimeEntries();
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
    if (!currentProject) {
        alert('Please select a project first.');
        return;
    }
    isTimerRunning = true;
    isPaused = false;
    startTime = Date.now();
    console.log('Timer started at:', new Date(startTime));
    timerInterval = setInterval(updateTimeDisplay, 1000);
    updatePlayPauseButton();
}

function pauseTimer() {
    isPaused = true;
    clearInterval(timerInterval);
    console.log('Timer paused at:', new Date());
    updatePlayPauseButton();
}

function resumeTimer() {
    isPaused = false;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimeDisplay, 1000);
    console.log('Timer resumed at:', new Date());
    updatePlayPauseButton();
}

function stopTimer() {
    if (isTimerRunning) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        isPaused = false;
        
        let stopTime = Date.now();
        
        console.log('Timer stopped at:', new Date(stopTime));
        console.log('Elapsed time (ms):', elapsedTime);
        
        saveTimeEntry(startTime, stopTime);
        resetTimer();
        loadTimeEntries();
        // Scroll to bottom after stopping the timer
        scrollToBottom(document.getElementById('timeEntryList'));
    } else {
        alert("No timer is currently running.");
    }
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
    elapsedTime = 0;
    startTime = null;
    isTimerRunning = false;
    isPaused = false;
    clearInterval(timerInterval);
    document.getElementById('timeDisplay').textContent = '00:00:00';
    updatePlayPauseButton();
}

function formatDuration(duration) {
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function loadTimeEntries() {
    if (!currentProject) {
        console.log('No current project, not loading time entries');
        return;
    }

    console.log('Loading time entries for project:', currentProject);

    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readonly');
        let store = transaction.objectStore('timeEntries');
        let index = store.index('projectId');
        let request = index.getAll(currentProject.id);

        request.onsuccess = function(event) {
            const timeEntries = event.target.result;
            console.log('Loaded time entries:', timeEntries);
            renderTimeEntryList(timeEntries);
            visualizeProjectData();
        };

        request.onerror = function(event) {
            console.error('Error loading time entries:', event);
            showError('Error loading time entries from database');
        };
    }).catch(error => {
        console.error('Database error in loadTimeEntries:', error);
        showError('Failed to open database when loading time entries');
    });
}

function renderTimeEntryList(timeEntries) {
    const timeEntryListElement = document.getElementById('timeEntryList');
    timeEntryListElement.innerHTML = '';

    timeEntries.forEach(entry => {
        const listItem = document.createElement('li');
    
        // Create dropdowns for start time
        const startDropdowns = createDateTimeDropdowns(new Date(entry.start), 'start');
    
        // Create dropdowns for end time
        const endDropdowns = createDateTimeDropdowns(new Date(entry.end), 'end');
    
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
        startDropdowns.forEach(dropdown => listItem.appendChild(dropdown));
        listItem.appendChild(document.createTextNode(' End: '));
        endDropdowns.forEach(dropdown => listItem.appendChild(dropdown));
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
        timeEntryListElement.appendChild(listItem);

        // Add event listeners to dropdowns and description input
        [...startDropdowns, ...endDropdowns].forEach(dropdown => {
            dropdown.addEventListener('change', () => updateTimeEntry(entry.id, listItem));
        });

        descriptionInput.addEventListener('input', () => updateTimeEntryDescription(entry.id, descriptionInput.value));
        visualizeProjectData();
    });

    // Scroll to the bottom of the list
    scrollToBottom(timeEntryListElement);
}

function scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
}
    
function createDateTimeDropdowns(date, prefix) {
    const year = createDropdown(range(2020, 2030), date.getFullYear(), `${prefix}-year`);
    const month = createDropdown(range(1, 13), date.getMonth() + 1, `${prefix}-month`);
    const day = createDropdown(range(1, 32), date.getDate(), `${prefix}-day`);
    const hour = createDropdown(range(0, 24), date.getHours(), `${prefix}-hour`);
    const minute = createDropdown(range(0, 60), date.getMinutes(), `${prefix}-minute`);

    return [year, month, day, hour, minute];
}

function createDropdown(options, selectedValue, name) {
    const select = document.createElement('select');
    select.name = name;
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option.toString().padStart(2, '0');
        if (option === selectedValue) optionElement.selected = true;
        select.appendChild(optionElement);
    });
    return select;
}

function range(start, end) {
    return Array.from({length: end - start}, (_, i) => start + i);
}

function updateTimeEntry(id, listItem) {
    const startDate = getDateFromDropdowns(listItem, 'start');
    const endDate = getDateFromDropdowns(listItem, 'end');
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
                console.log('Time entry updated successfully');
                visualizeProjectData();
            };
        };
        request.onerror = function(event) {
            console.error('Error updating time entry:', event);
            showError('Error updating time entry to database');
        };
    }).catch(error => {
        console.error('Database error in updateTimeEntry:', error);
        showError('Failed to load database when updating time entry');
    });
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
                console.log('Time entry description updated successfully');
            };
        };
        request.onerror = function(event) {
            console.error('Error updating time entry description:', event);
            showError('Error updating time entry description to database');
        };
    }).catch(error => {
        console.error('Database error in updateTimeEntryDescription:', error);
        showError('Failed to load database when updating time entry description');
    });
}

function populateDropdowns() {
    // Populate dropdowns with options (year, month, day, etc.)
}

function getDateFromDropdowns(listItem, prefix) {
    const year = listItem.querySelector(`[name="${prefix}-year"]`).value;
    const month = listItem.querySelector(`[name="${prefix}-month"]`).value - 1;
    const day = listItem.querySelector(`[name="${prefix}-day"]`).value;
    const hour = listItem.querySelector(`[name="${prefix}-hour"]`).value;
    const minute = listItem.querySelector(`[name="${prefix}-minute"]`).value;

    return new Date(year, month, day, hour, minute);
}

function saveTimeEntry(startTime, endTime) {
    dbReady.then(() => {
        if (currentProject) {
            let transaction = db.transaction(['timeEntries'], 'readwrite');
            let store = transaction.objectStore('timeEntries');

            let entry = {
                projectId: currentProject.id,
                start: new Date(startTime).toISOString(),
                end: new Date(endTime).toISOString(),
                duration: endTime - startTime,
                description: ''
            };

            console.log('Saving time entry:',entry);
            console.log('Start:', new Date(startTime));
            console.log('End:', new Date(endTime));
            console.log('Duration:', formatDuration(entry.duration));
            console.log('Elapsed time (ms):', entry.duration);

            let request = store.add(entry);

            request.onsuccess = function() {
                console.log('Time entry saved successfully');
                loadTimeEntries(); // Refresh time entries for the current project
                visualizeProjectData();
            };

            request.onerror = function(event) {
                console.error('Error saving time entry:', event);
                showError('Error saving time entry in database');
            };
        } else {
            alert('Please select a project first.');
        }
    }).catch(error => {
        console.error('Database error:', error);
        showError('Failed to load database when saving time entry');
    });
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
            console.error('Error removing time entry:', event);
            showError('Error removing time entry from database');
        };
    }).catch(error => {
        console.error('Database error:', error);
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
        description: ''
    };

    console.log('Adding manual entry:', entry);

    dbReady.then(() => {
        let transaction = db.transaction(['timeEntries'], 'readwrite');
        let store = transaction.objectStore('timeEntries');

        let request = store.add(entry);

        request.onsuccess = function(event) {
            console.log('Manual time entry added successfully');
            loadTimeEntries();
            // Scroll to bottom after adding a manual entry
            scrollToBottom(document.getElementById('timeEntryList'));
            visualizeProjectData();
        };

        request.onerror = function(event) {
            console.error('Error adding manual time entry:', event);
            showError('Error adding manual time entry to database');
        };
    }).catch(error => {
        console.error('Database error:', error);
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
            console.error('Error fetching time entries for visualization:', event);
            showError('Failed to fetch data for visualization.');
        };
    }).catch(error => {
        console.error('Database error:', error);
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
    
    // Fetch project names
    dbReady.then(() => {
        let transaction = db.transaction(['projects'], 'readonly');
        let store = transaction.objectStore('projects');
        let request = store.getAll();

        request.onsuccess = function(event) {
            const projects = event.target.result;
            const projectNames = {};
            projects.forEach(project => {
                projectNames[project.id] = project.name;
            });

            const labels = Object.keys(projectTotals).map(id => projectNames[id] || `Project ${id}`);
            const data = Object.values(projectTotals).map(duration => duration / (1000 * 60 * 60)); // Convert to hours

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
            console.error('Error fetching projects for chart:', event);
            showError('Failed to fetch project data for chart.');
        };
    }).catch(error => {
        console.error('Database error:', error);
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
                console.error('Error clearing database:', event.target.errorCode);
                showError('Error clearing database');
            };
        }).catch(error => {
            console.error('Error clearing database:', error);
            showError('Error opening database for clearing');
        });
    }
}

