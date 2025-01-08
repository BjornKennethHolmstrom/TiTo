// src/core/projectManager.js
(function(window) {
    'use strict';

    class ProjectManager {
        constructor() {
            // Dependencies check
            if (!window.titoDatabase) {
                throw new Error('Database service not found');
            }
            if (!window.titoState) {
                throw new Error('State Manager not found');
            }
            if (!window.titoTranslator) {
                throw new Error('Translation Manager not found');
            }
            
            // Initialize services
            this.db = window.titoDatabase;
            this.state = window.titoState;
            this.translator = window.titoTranslator;
            
            // Initialize state
            this.state.update('projects', {
                items: [],
                currentProjectId: null,
                loading: false,
                error: null,
                showInactive: false,
                colorCoding: true
            });

            // Debug mode
            this.debugMode = window.location.search.includes('debug=true');
            
            // Bind methods
            this.notifyObservers = this.notifyObservers.bind(this);
        }

        // Observer pattern for UI updates
        addObserver(observer) {
            if (typeof observer.update !== 'function') {
                console.error('Observer must implement update method');
                return;
            }
            this.observers.add(observer);
            this.debugLog('Added observer', observer);
            
            return () => {
                this.observers.delete(observer);
                this.debugLog('Removed observer', observer);
            };
        }

        notifyObservers(event, data) {
            this.debugLog('Notifying observers', { event, data });
            this.observers.forEach(observer => {
                try {
                    observer.update(event, data);
                } catch (error) {
                    console.error('Error in observer:', error);
                }
            });
        }

        async getAllProjects() {
            try {
                this.state.update('projects.loading', true);
                const projects = await this.db.getAll('projects');
                const sortedProjects = projects.sort((a, b) => (a.order || 0) - (b.order || 0));
                
                this.state.batchUpdate([
                    ['projects.items', sortedProjects],
                    ['projects.loading', false],
                    ['projects.error', null]
                ]);
                
                return sortedProjects;
            } catch (error) {
                this.handleError('errorFetchingProjects', error);
                throw error;
            }
        }

        async getProject(id) {
            try {
                const project = await this.db.get('projects', id);
                if (!project) {
                    throw new Error(this.translator.translate('projectNotFound'));
                }
                return project;
            } catch (error) {
                this.handleError('errorFetchingProject', error);
                throw error;
            }
        }

        async addProject(name) {
            try {
                this.state.update('projects.loading', true);
                
                if (!name?.trim()) {
                    throw new Error(this.translator.translate('projectNameEmpty'));
                }

                const projects = await this.getAllProjects();
                const newProject = {
                    name: name.trim(),
                    order: projects.length,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                const projectId = await this.db.add('projects', newProject);
                const addedProject = { ...newProject, id: projectId };

                const updatedProjects = [...projects, addedProject];
                this.state.update('projects.items', updatedProjects);
                
                this.notifyObservers('projectAdded', addedProject);
                return addedProject;
            } catch (error) {
                this.handleError('errorAddingProject', error);
                throw error;
            } finally {
                this.state.update('projects.loading', false);
            }
        }

        async updateProject(projectId, updates) {
            try {
                this.state.update('projects.loading', true);

                const projects = this.state.select('projects.items');
                const projectIndex = projects.findIndex(p => p.id === projectId);

                if (projectIndex === -1) {
                    throw new Error(this.translator.translate('projectNotFound'));
                }

                // Validate name if updating
                if (updates.name && !updates.name.trim()) {
                    throw new Error(this.translator.translate('projectNameEmpty'));
                }

                const updatedProject = {
                    ...projects[projectIndex],
                    ...updates,
                    updatedAt: new Date().toISOString()
                };

                await this.db.update('projects', updatedProject);

                const updatedProjects = [...projects];
                updatedProjects[projectIndex] = updatedProject;

                this.state.batchUpdate([
                    ['projects.items', updatedProjects],
                    ['projects.loading', false],
                    ['projects.error', null]
                ]);

                // Update current project reference if needed
                if (this.state.select('projects.currentProjectId') === projectId) {
                    this.setCurrentProject(updatedProject);
                }

                this.notifyObservers('projectUpdated', updatedProject);
                return updatedProject;
            } catch (error) {
                this.handleError('errorUpdatingProject', error);
                throw error;
            }
        }

        async deleteProject(projectId) {
            try {
                this.state.update('projects.loading', true);

                // Start a transaction for deleting project and related data
                const transaction = await this.db.startTransaction(
                    ['projects', 'timeEntries', 'timeGoals'], 
                    'readwrite'
                );

                try {
                    // Delete the project
                    await transaction.objectStore('projects').delete(projectId);
                    
                    // Delete all time entries for this project
                    const timeEntryStore = transaction.objectStore('timeEntries');
                    const entries = await timeEntryStore.index('projectId').getAllKeys(projectId);
                    for (const entryId of entries) {
                        await timeEntryStore.delete(entryId);
                    }

                    // Delete all goals for this project
                    const goalsStore = transaction.objectStore('timeGoals');
                    const goals = await goalsStore.index('projectId').getAllKeys(projectId);
                    for (const goalId of goals) {
                        await goalsStore.delete(goalId);
                    }

                    await transaction.complete();

                    // Update state
                    const projects = this.state.select('projects.items');
                    const updatedProjects = projects.filter(p => p.id !== projectId);
                    
                    this.state.batchUpdate([
                        ['projects.items', updatedProjects],
                        ['projects.loading', false],
                        ['projects.error', null]
                    ]);

                    // Update current project if deleted
                    if (this.state.select('projects.currentProjectId') === projectId) {
                        this.setCurrentProject(updatedProjects[0]?.id || null);
                    }

                    await this.reorderProjects();
                    this.notifyObservers('projectDeleted', projectId);

                    this.debugLog('Project deleted', { 
                        projectId, 
                        entriesDeleted: entries.length,
                        goalsDeleted: goals.length 
                    });

                } catch (error) {
                    await transaction.abort();
                    throw error;
                }
            } catch (error) {
                this.handleError('errorDeletingProject', error);
                throw error;
            }
        }

        async updateProjectOrder(fromIndex, toIndex) {
            try {
                const projects = this.state.select('projects.items');
                
                // Validate indices
                if (fromIndex < 0 || toIndex < 0 || 
                    fromIndex >= projects.length || toIndex >= projects.length) {
                    throw new Error(this.translator.translate('invalidProjectOrder'));
                }

                // Move project to new position
                const updatedProjects = [...projects];
                const [movedProject] = updatedProjects.splice(fromIndex, 1);
                updatedProjects.splice(toIndex, 0, movedProject);

                // Update order property for all projects
                const projectsWithNewOrder = updatedProjects.map((project, index) => ({
                    ...project,
                    order: index
                }));

                // Save to database
                await Promise.all(projectsWithNewOrder.map(project =>
                    this.db.update('projects', project)
                ));

                this.state.update('projects.items', projectsWithNewOrder);
                this.notifyObservers('projectOrderUpdated', projectsWithNewOrder);
                
                this.debugLog('Project order updated', { fromIndex, toIndex });
            } catch (error) {
                this.handleError('errorReorderingProjects', error);
                throw error;
            }
        }

        async reorderProjects() {
            try {
                const projects = this.state.select('projects.items');
                const updatedProjects = projects.map((project, index) => ({
                    ...project,
                    order: index
                }));

                await Promise.all(updatedProjects.map(project => 
                    this.db.update('projects', project)
                ));

                this.state.update('projects.items', updatedProjects);
                this.notifyObservers('projectOrderUpdated', updatedProjects);
                this.debugLog('Projects reordered');
            } catch (error) {
                this.handleError('errorReorderingProjects', error);
                throw error;
            }
        }

        setCurrentProject(projectId) {
            if (projectId === null) {
                this.state.update('projects.currentProjectId', null);
                this.notifyObservers('currentProjectChanged', null);
                return;
            }

            const projects = this.state.select('projects.items');
            const project = projects.find(p => p.id === projectId);
            
            if (project) {
                this.state.update('projects.currentProjectId', projectId);
                this.notifyObservers('currentProjectChanged', project);
                this.debugLog('Current project set', project);
            } else {
                this.handleError('projectNotFound');
            }
        }

        getCurrentProject() {
            const projectId = this.state.select('projects.currentProjectId');
            if (!projectId) return null;

            const projects = this.state.select('projects.items');
            return projects.find(p => p.id === projectId) || null;
        }

        async getProjectStatistics(projectId, startDate = null, endDate = null) {
            try {
                const timeEntries = await this.db.getByIndex('timeEntries', 'projectId', projectId);
                
                // Filter entries by date range if provided
                const filteredEntries = timeEntries.filter(entry => {
                    if (!startDate && !endDate) return true;
                    const entryDate = new Date(entry.start);
                    return (!startDate || entryDate >= startDate) && 
                           (!endDate || entryDate <= endDate);
                });

                const totalTime = filteredEntries.reduce((sum, entry) => sum + entry.duration, 0);
                const averageDuration = filteredEntries.length > 0 ? 
                    totalTime / filteredEntries.length : 0;

                return {
                    totalEntries: filteredEntries.length,
                    totalTime,
                    averageDuration,
                    firstEntry: filteredEntries[0]?.start || null,
                    lastEntry: filteredEntries[filteredEntries.length - 1]?.end || null
                };
            } catch (error) {
                this.handleError('errorGettingStatistics', error);
                throw error;
            }
        }

        // UI State management methods
        toggleShowInactive() {
            const current = this.state.select('projects.showInactive');
            this.state.update('projects.showInactive', !current);
            this.notifyObservers('showInactiveToggled', !current);
        }

        toggleColorCoding() {
            const current = this.state.select('projects.colorCoding');
            this.state.update('projects.colorCoding', !current);
            this.notifyObservers('colorCodingToggled', !current);
        }

        validateProject(project) {
            const errors = [];

            if (!project.name || !project.name.trim()) {
                errors.push(this.translator.translate('projectNameEmpty'));
            }

            if (typeof project.order !== 'number') {
                errors.push(this.translator.translate('invalidProjectOrder'));
            }

            return errors;
        }

        handleError(translationKey, error) {
            console.error(`Project Manager Error (${translationKey}):`, error);
            this.state.update('projects.error', this.translator.translate(translationKey));
        }

        debugLog(action, data = null) {
            if (this.debugMode) {
                console.log(`[ProjectManager] ${action}:`, data);
            }
        }
    }

    // Error types for better error handling
    window.ProjectErrors = {
        NAME_EMPTY: 'projectNameEmpty',
        NAME_EXISTS: 'projectNameExists',
        NOT_FOUND: 'projectNotFound',
        INVALID_ORDER: 'invalidProjectOrder',
        FETCH_ERROR: 'errorFetchingProjects',
        ADD_ERROR: 'errorAddingProject',
        UPDATE_ERROR: 'errorUpdatingProject',
        DELETE_ERROR: 'errorDeletingProject',
        REORDER_ERROR: 'errorReorderingProjects',
        STATS_ERROR: 'errorGettingStatistics'
    };

    // Create global instance
    window.titoProjectManager = new ProjectManager();

})(window);
