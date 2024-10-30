// src/core/projectManager.js
export class ProjectManager {
    constructor(database, translationManager) {
        this.db = database;
        this.translator = translationManager;
        this.currentProject = null;
        this.observers = []; // For notifying UI components of changes
    }

    // Observer pattern for UI updates
    addObserver(observer) {
        this.observers.push(observer);
    }

    notifyObservers(event, data) {
        this.observers.forEach(observer => observer.update(event, data));
    }

    async getAllProjects() {
        try {
            const projects = await this.db.getAll('projects');
            return projects.sort((a, b) => (a.order || 0) - (b.order || 0));
        } catch (error) {
            console.error('Error fetching projects:', error);
            throw new Error(this.translator.translate('errorFetchingProjects'));
        }
    }

    async getProject(id) {
        try {
            return await this.db.get('projects', id);
        } catch (error) {
            console.error('Error fetching project:', error);
            throw new Error(this.translator.translate('errorFetchingProject'));
        }
    }

    async addProject(name) {
        if (!name || !name.trim()) {
            throw new Error(this.translator.translate('projectNameEmpty'));
        }

        try {
            // Get current project count for ordering
            const projects = await this.getAllProjects();
            const newProject = {
                name: name.trim(),
                order: projects.length,
                createdAt: new Date().toISOString(),
                isActive: true
            };

            const projectId = await this.db.add('projects', newProject);
            const addedProject = { ...newProject, id: projectId };
            
            this.notifyObservers('projectAdded', addedProject);
            return addedProject;
        } catch (error) {
            if (error.name === 'ConstraintError') {
                throw new Error(this.translator.translate('projectNameExists'));
            }
            throw new Error(this.translator.translate('errorAddingProject'));
        }
    }

    async updateProject(projectId, updates) {
        try {
            const project = await this.getProject(projectId);
            if (!project) {
                throw new Error(this.translator.translate('projectNotFound'));
            }

            // Validate project name if it's being updated
            if (updates.name && !updates.name.trim()) {
                throw new Error(this.translator.translate('projectNameEmpty'));
            }

            const updatedProject = {
                ...project,
                ...updates,
                updatedAt: new Date().toISOString()
            };

            await this.db.update('projects', updatedProject);
            
            // Update current project if it's the one being modified
            if (this.currentProject && this.currentProject.id === projectId) {
                this.currentProject = updatedProject;
            }

            this.notifyObservers('projectUpdated', updatedProject);
            return updatedProject;
        } catch (error) {
            console.error('Error updating project:', error);
            throw new Error(this.translator.translate('errorUpdatingProject'));
        }
    }

    async deleteProject(projectId) {
        try {
            const project = await this.getProject(projectId);
            if (!project) {
                throw new Error(this.translator.translate('projectNotFound'));
            }

            // Start a transaction for deleting project and its time entries
            const transaction = this.db.startTransaction(['projects', 'timeEntries'], 'readwrite');
            
            try {
                // Delete the project
                await transaction.objectStore('projects').delete(projectId);
                
                // Delete all time entries for this project
                const timeEntryStore = transaction.objectStore('timeEntries');
                const index = timeEntryStore.index('projectId');
                const entries = await index.getAllKeys(projectId);
                
                for (const entryId of entries) {
                    await timeEntryStore.delete(entryId);
                }

                await transaction.complete();

                // Reset current project if it was the deleted one
                if (this.currentProject && this.currentProject.id === projectId) {
                    this.currentProject = null;
                }

                // Reorder remaining projects
                await this.reorderProjects();
                
                this.notifyObservers('projectDeleted', projectId);
            } catch (error) {
                await transaction.abort();
                throw error;
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            throw new Error(this.translator.translate('errorDeletingProject'));
        }
    }

    async updateProjectOrder(fromIndex, toIndex) {
        try {
            const projects = await this.getAllProjects();
            
            // Validate indices
            if (fromIndex < 0 || toIndex < 0 || 
                fromIndex >= projects.length || toIndex >= projects.length) {
                throw new Error(this.translator.translate('invalidProjectOrder'));
            }

            // Move project to new position
            const [movedProject] = projects.splice(fromIndex, 1);
            projects.splice(toIndex, 0, movedProject);

            // Update order property for all affected projects
            const updates = projects.map((project, index) => 
                this.updateProject(project.id, { order: index })
            );

            await Promise.all(updates);
            this.notifyObservers('projectOrderUpdated', projects);
        } catch (error) {
            console.error('Error updating project order:', error);
            throw new Error(this.translator.translate('errorReorderingProjects'));
        }
    }

    async reorderProjects() {
        const projects = await this.getAllProjects();
        const updates = projects.map((project, index) => 
            this.updateProject(project.id, { order: index })
        );
        await Promise.all(updates);
    }

    setCurrentProject(project) {
        this.currentProject = project;
        this.notifyObservers('currentProjectChanged', project);
    }

    getCurrentProject() {
        return this.currentProject;
    }

    // Project statistics and analysis
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
            console.error('Error getting project statistics:', error);
            throw new Error(this.translator.translate('errorGettingStatistics'));
        }
    }

    // Project validation
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
}

// Export error types for better error handling
export const ProjectErrors = {
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

// Types for TypeScript support (if needed later)
/*
interface Project {
    id?: number;
    name: string;
    order: number;
    createdAt: string;
    updatedAt?: string;
    isActive: boolean;
}

interface ProjectStatistics {
    totalEntries: number;
    totalTime: number;
    averageDuration: number;
    firstEntry: string | null;
    lastEntry: string | null;
}
*/
