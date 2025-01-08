// src/ui/components/timerDisplay.js
export class TimerDisplay {
    constructor(elementId = 'timeDisplay') {
        this.element = document.getElementById(elementId);
        this.projectDisplay = document.getElementById('timerProjectDisplay');
        this.startStopButton = document.getElementById('startStopButton');
    }

    updateTime(duration) {
        if (this.element) {
            this.element.textContent = this.formatDuration(duration);
        }
    }

    updateProjectDisplay(projectName) {
        if (this.projectDisplay) {
            this.projectDisplay.textContent = projectName ? 
                `Timer running for: ${projectName}` : '';
            this.projectDisplay.style.display = projectName ? 'block' : 'none';
        }
    }

    updateStartStopButton(isRunning) {
        if (this.startStopButton) {
            const lightIcon = this.startStopButton.querySelector('.icon-light');
            const darkIcon = this.startStopButton.querySelector('.icon-dark');
            
            if (isRunning) {
                lightIcon.src = 'icons/stop-light.svg';
                darkIcon.src = 'icons/stop-dark.svg';
                lightIcon.alt = darkIcon.alt = 'Stop';
                this.startStopButton.title = 'Stop';
            } else {
                lightIcon.src = 'icons/start-light.svg';
                darkIcon.src = 'icons/start-dark.svg';
                lightIcon.alt = darkIcon.alt = 'Start';
                this.startStopButton.title = 'Start';
            }
        }
    }

    formatDuration(duration) {
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

// src/ui/components/projectList.js
export class ProjectList {
    constructor(container, eventHandlers) {
        this.container = document.getElementById(container);
        this.handlers = eventHandlers;
        this.dragSrcEl = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Add project form submission
        const addProjectForm = document.querySelector('.add-project-container');
        if (addProjectForm) {
            addProjectForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const input = addProjectForm.querySelector('input');
                if (input.value.trim()) {
                    this.handlers.onAddProject(input.value.trim());
                    input.value = '';
                }
            });
        }
    }

    render(projects, currentProjectId) {
        if (!this.container) return;

        this.container.innerHTML = '';
        
        projects.forEach(project => {
            const listItem = this.createProjectItem(project, currentProjectId);
            this.container.appendChild(listItem);
        });
    }

    createProjectItem(project, currentProjectId) {
        const listItem = document.createElement('li');
        listItem.id = `project-${project.id}`;
        listItem.dataset.projectId = project.id;
        listItem.draggable = true;

        // Project name (editable)
        const projectName = document.createElement('span');
        projectName.className = 'project-name';
        projectName.contentEditable = true;
        projectName.textContent = project.name;
        projectName.setAttribute('aria-label', `Edit project name: ${project.name}`);

        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '🗑️';
        deleteButton.className = 'remove-project-button';
        deleteButton.setAttribute('aria-label', `Delete project ${project.name}`);
        deleteButton.title = 'Delete project';

        // Attach event listeners
        this.attachItemEventListeners(listItem, projectName, deleteButton, project.id);

        // Set selected state
        if (project.id === currentProjectId) {
            listItem.classList.add('selected');
            listItem.setAttribute('aria-current', 'true');
        }

        listItem.appendChild(projectName);
        listItem.appendChild(deleteButton);
        return listItem;
    }

    attachItemEventListeners(listItem, projectName, deleteButton, projectId) {
        // Project selection
        listItem.addEventListener('click', (e) => {
            if (e.target !== projectName && e.target !== deleteButton) {
                this.handlers.onSelectProject(projectId);
            }
        });

        // Project name editing
        projectName.addEventListener('blur', () => {
            const newName = projectName.textContent.trim();
            if (newName) {
                this.handlers.onUpdateProject(projectId, newName);
            }
        });

        projectName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                projectName.blur();
            }
        });

        // Delete project
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this project?')) {
                this.handlers.onDeleteProject(projectId);
            }
        });

        // Drag and drop
        listItem.addEventListener('dragstart', this.handleDragStart.bind(this));
        listItem.addEventListener('dragover', this.handleDragOver.bind(this));
        listItem.addEventListener('drop', this.handleDrop.bind(this));
        listItem.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    handleDragStart(e) {
        this.dragSrcEl = e.target;
        e.target.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.innerHTML);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    handleDrop(e) {
        e.stopPropagation();
        
        if (this.dragSrcEl !== e.target) {
            const allItems = [...this.container.children];
            const sourceIndex = allItems.indexOf(this.dragSrcEl);
            const targetIndex = allItems.indexOf(e.target);
            
            if (sourceIndex !== -1 && targetIndex !== -1) {
                this.handlers.onReorderProjects(sourceIndex, targetIndex);
            }
        }
        
        return false;
    }

    handleDragEnd(e) {
        e.target.style.opacity = '1';
        this.container.querySelectorAll('li').forEach(item => {
            item.classList.remove('over');
        });
    }
}

// src/ui/components/timeEntryList.js
export class TimeEntryList {
    constructor(container, eventHandlers) {
        this.container = document.getElementById(container);
        this.handlers = eventHandlers;
        this.dragSrcEl = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const addManualEntryButton = document.getElementById('addManualEntryButton');
        if (addManualEntryButton) {
            addManualEntryButton.addEventListener('click', () => {
                this.handlers.onAddManualEntry();
            });
        }

        const removeAllEntriesButton = document.getElementById('removeAllEntriesButton');
        if (removeAllEntriesButton) {
            removeAllEntriesButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to remove all time entries?')) {
                    this.handlers.onRemoveAllEntries();
                }
            });
        }
    }

    render(entries, projectName) {
        if (!this.container) return;

        this.container.innerHTML = '';
        
        entries.forEach(entry => {
            const listItem = this.createTimeEntryItem(entry, projectName);
            this.container.appendChild(listItem);
        });
    }

    createTimeEntryItem(entry, projectName) {
        const listItem = document.createElement('li');
        listItem.draggable = true;
        listItem.dataset.entryId = entry.id;
        
        // Create date/time inputs
        const startDateInput = this.createDateTimeInputs('start', entry.start, projectName);
        const endDateInput = this.createDateTimeInputs('end', entry.end, projectName);
        
        // Create duration display
        const durationDisplay = this.createDurationDisplay(entry.duration);
        
        // Create description input
        const descriptionContainer = this.createDescriptionInput(entry);
        
        // Assemble the list item
        listItem.appendChild(startDateInput);
        listItem.appendChild(endDateInput);
        listItem.appendChild(durationDisplay);
        listItem.appendChild(descriptionContainer);
        
        // Attach event listeners
        this.attachTimeEntryEventListeners(listItem, entry.id);
        
        return listItem;
    }

    createDateTimeInputs(type, dateString, projectName) {
        const container = document.createElement('div');
        container.className = 'date-time-group';
        
        const date = new Date(dateString);
        
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.name = `${type}-date`;
        dateInput.value = this.formatDate(date);
        dateInput.setAttribute('aria-label', `${type} date for ${projectName}`);
        
        const timeInput = document.createElement('input');
        timeInput.type = 'time';
        timeInput.name = `${type}-time`;
        timeInput.value = this.formatTime(date);
        timeInput.setAttribute('aria-label', `${type} time for ${projectName}`);
        
        container.appendChild(dateInput);
        container.appendChild(timeInput);
        
        return container;
    }

    createDurationDisplay(duration) {
        const container = document.createElement('div');
        container.className = 'total-time-container';
        
        const label = document.createElement('span');
        label.className = 'total-time-label';
        label.textContent = 'Total Time: ';
        
        const time = document.createElement('span');
        time.className = 'total-time';
        time.textContent = this.formatDuration(duration);
        
        container.appendChild(label);
        container.appendChild(time);
        
        return container;
    }

    createDescriptionInput(entry) {
        const container = document.createElement('div');
        container.className = 'description-input-container';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'description-input';
        input.value = entry.description || '';
        input.placeholder = 'Enter task description';
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '🗑️';
        deleteButton.className = 'remove-time-entry-button';
        deleteButton.title = 'Delete entry';
        
        container.appendChild(input);
        container.appendChild(deleteButton);
        
        return container;
    }

    // Utility methods
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatTime(date) {
        return date.toTimeString().slice(0, 5);
    }

    formatDuration(duration) {
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

// src/ui/components/pagination.js
export class Pagination {
    constructor(container, eventHandlers) {
        this.container = document.getElementById(container);
        this.handlers = eventHandlers;
        this.initializeControls();
    }

    initializeControls() {
        if (!this.container) return;

        const controls = `
            <button id="firstPageButton">&lt;&lt;</button>
            <button id="prevPageButton">&lt;</button>
            <span id="pageIndicator">
                Page <input type="number" id="currentPageInput" min="1"> 
                of <span id="totalPages">1</span>
            </span>
            <button id="nextPageButton">&gt;</button>
            <button id="lastPageButton">&gt;&gt;</button>
        `;

        this.container.innerHTML = controls;
        this.attachEventListeners();
    }

    attachEventListeners() {
        const currentPageInput = document.getElementById('currentPageInput');
        if (currentPageInput) {
            currentPageInput.addEventListener('change', () => {
                const newPage = parseInt(currentPageInput.value);
                if (newPage >= 1 && newPage <= this.totalPages) {
                    this.handlers.onPageChange(newPage);
                } else {
                    currentPageInput.value = this.currentPage;
                }
            });
        }

        ['firstPageButton', 'prevPageButton', 'nextPageButton', 'lastPageButton'].forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => this.handleButtonClick(id));
            }
        });
    }

    handleButtonClick(buttonId) {
        switch (buttonId) {
            case 'firstPageButton':
                this.handlers.onPageChange(1);
                break;
            case 'prevPageButton':
                this.handlers.onPageChange(this.currentPage - 1);
                break;
            case 'nextPageButton':
                this.handlers.onPageChange(this.currentPage + 1);
                break;
            case 'lastPageButton':
                this.handlers.onPageChange(this.totalPages);
                break;
        }
    }

    update(currentPage, totalPages) {
        this.currentPage = currentPage;
        this.totalPages = totalPages;

        const currentPageInput = document.getElementById('currentPageInput');
        const totalPagesSpan = document.getElementById('totalPages');
        
        if (currentPageInput) currentPageInput.value = currentPage;
        if (totalPagesSpan) totalPagesSpan.textContent = totalPages;

        // Update button states
        document.getElementById('firstPageButton').disabled = currentPage === 1;
        document.getElementById('prevPageButton').disabled = currentPage === 1;
        document.getElementById('nextPageButton').disabled = currentPage === totalPages;
        document.getElementById('lastPageButton').disabled = currentPage === totalPages;
    }
}
