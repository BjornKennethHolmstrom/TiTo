// src/ui/components/ProjectList/index.js
class ProjectList {
    constructor(projectManager, stateManager, translationManager, container) {
        // Validate dependencies
        if (!projectManager) throw new Error('Project Manager is required');
        if (!stateManager) throw new Error('State Manager is required');
        if (!translationManager) throw new Error('Translation Manager is required');

        // Store references
        this.projectManager = projectManager;
        this.state = stateManager;
        this.translator = translationManager;
        this.container = container;

        // Initialize the component
        this.initialize();
    }

    initialize() {
        try {
            // Create component structure
            this.container.innerHTML = this.createTemplate();
            
            // Cache element references
            this.cacheElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Subscribe to state changes
            this.subscribeToStateChanges();

            // Load initial data
            this.loadProjects();

        } catch (error) {
            console.error('Error initializing ProjectList:', error);
            throw error;
        }
    }

    createTemplate() {
        return `
            <div class="projects-section">
                <h2 class="section-heading" data-i18n="projects">Projects</h2>
                
                <form class="add-project-form">
                    <input 
                        type="text" 
                        id="newProjectName" 
                        class="project-input"
                        data-i18n-placeholder="enterProjectName"
                        aria-label="${this.translator.translate('enterProjectName')}"
                    >
                    <button 
                        type="submit" 
                        class="add-button"
                        data-i18n="addProject"
                    >Add Project</button>
                </form>

                <div class="error-message hidden"></div>

                <ul id="projectList" class="project-list" role="list"></ul>
            </div>
        `;
    }

    cacheElements() {
        this.elements = {
            projectList: this.container.querySelector('#projectList'),
            addForm: this.container.querySelector('.add-project-form'),
            nameInput: this.container.querySelector('#newProjectName'),
            errorMessage: this.container.querySelector('.error-message')
        };
    }

    setupEventListeners() {
        // Add project form
        this.elements.addForm.addEventListener('submit', (e) => this.handleAddProject(e));

        // Project list drag and drop
        this.elements.projectList.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.elements.projectList.addEventListener('dragover', this.handleDragOver.bind(this));
        this.elements.projectList.addEventListener('drop', this.handleDrop.bind(this));
        this.elements.projectList.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    subscribeToStateChanges() {
        // Subscribe to project-related state changes
        this.state.subscribe('projects.items', projects => this.renderProjects(projects));
        this.state.subscribe('projects.currentProjectId', id => this.updateCurrentProject(id));
        this.state.subscribe('projects.error', error => this.showError(error));
    }

    async loadProjects() {
        try {
            await this.projectManager.getAllProjects();
        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleAddProject(e) {
        e.preventDefault();
        const name = this.elements.nameInput.value.trim();

        try {
            await this.projectManager.addProject(name);
            this.elements.nameInput.value = '';
        } catch (error) {
            this.showError(error.message);
        }
    }

    renderProjects(projects) {
        this.elements.projectList.innerHTML = '';

        projects.forEach(project => {
            const li = document.createElement('li');
            li.className = 'project-item';
            li.dataset.projectId = project.id;
            li.draggable = true;

            li.innerHTML = `
                <div class="project-content">
                    <span class="project-name" contenteditable="true">${project.name}</span>
                    <div class="project-actions">
                        <button class="delete-button" 
                                aria-label="${this.translator.translate('deleteProject', { name: project.name })}">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="project-goal-info hidden"></div>
            `;

            this.attachProjectItemListeners(li, project);
            this.elements.projectList.appendChild(li);
        });
    }

    attachProjectItemListeners(li, project) {
        const nameElement = li.querySelector('.project-name');
        const deleteButton = li.querySelector('.delete-button');

        // Project selection
        li.addEventListener('click', (e) => {
            if (e.target !== nameElement && e.target !== deleteButton) {
                this.projectManager.setCurrentProject(project.id);
            }
        });

        // Project name editing
        nameElement.addEventListener('blur', () => {
            const newName = nameElement.textContent.trim();
            if (newName !== project.name) {
                this.projectManager.updateProject(project.id, { name: newName })
                    .catch(() => nameElement.textContent = project.name);
            }
        });

        nameElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameElement.blur();
            }
        });

        // Project deletion
        deleteButton.addEventListener('click', async () => {
            if (confirm(this.translator.translate('confirmDeleteProject'))) {
                try {
                    await this.projectManager.deleteProject(project.id);
                } catch (error) {
                    this.showError(error.message);
                }
            }
        });
    }

    updateCurrentProject(projectId) {
        const items = this.elements.projectList.querySelectorAll('.project-item');
        items.forEach(item => {
            item.classList.toggle('selected', item.dataset.projectId === String(projectId));
            item.setAttribute('aria-selected', item.dataset.projectId === String(projectId));
        });
    }

    // Drag and Drop handlers
    handleDragStart(e) {
        const item = e.target.closest('.project-item');
        if (!item) return;

        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.projectId);
    }

    handleDragOver(e) {
        e.preventDefault();
        const item = e.target.closest('.project-item');
        if (item && !item.classList.contains('dragging')) {
            item.classList.add('over');
        }
    }

    async handleDrop(e) {
        e.preventDefault();
        
        const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
        const dropTarget = e.target.closest('.project-item');
        
        if (!dropTarget || dropTarget.dataset.projectId === String(draggedId)) return;

        const items = Array.from(this.elements.projectList.children);
        const fromIndex = items.findIndex(item => item.dataset.projectId === String(draggedId));
        const toIndex = items.indexOf(dropTarget);

        try {
            await this.projectManager.updateProjectOrder(fromIndex, toIndex);
        } catch (error) {
            this.showError(error.message);
        }
    }

    handleDragEnd(e) {
        const items = this.elements.projectList.querySelectorAll('.project-item');
        items.forEach(item => {
            item.classList.remove('dragging', 'over');
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

        this.elements.nameInput.placeholder = this.translator.translate('enterProjectName');
    }

    destroy() {
        // Clean up event listeners and state subscriptions
        this.elements.addForm.removeEventListener('submit', this.handleAddProject);
        // Add other cleanup as needed
    }
}
