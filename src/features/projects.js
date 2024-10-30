// src/features/projects.js
export class ProjectsFeature {
    constructor(projectManager, stateManager, translationManager) {
        this.projectManager = projectManager;
        this.state = stateManager;
        this.translator = translationManager;
        
        // Initialize projects state
        this.initializeState();
        
        // Set up state subscriptions
        this.setupSubscriptions();
    }

    // Initialize the projects feature
    async initializeState() {
        try {
            // Set loading state
            this.state.update('projects.loading', true);

            // Load initial projects
            const projects = await this.projectManager.getAllProjects();
            
            // Update state with loaded projects
            this.state.batchUpdate([
                ['projects.items', projects],
                ['projects.loading', false],
                ['projects.error', null]
            ]);

            // Set first project as current if none selected
            if (projects.length > 0 && !this.state.select('projects.currentProjectId')) {
                this.state.update('projects.currentProjectId', projects[0].id);
                this.projectManager.setCurrentProject(projects[0]);
            }
        } catch (error) {
            this.state.batchUpdate([
                ['projects.loading', false],
                ['projects.error', this.translator.translate('errorLoadingProjects')]
            ]);
            console.error('Failed to initialize projects:', error);
        }
    }

    setupSubscriptions() {
        // Listen for current project changes
        this.state.subscribe('projects.currentProjectId', (projectId) => {
            if (projectId) {
                const project = this.state.select('projects.items')
                    .find(p => p.id === projectId);
                if (project) {
                    this.projectManager.setCurrentProject(project);
                }
            }
        });
    }

    // Project CRUD operations
    async addProject(name) {
        try {
            this.state.update('projects.loading', true);

            // Validate project name
            if (!name || !name.trim()) {
                throw new Error(this.translator.translate('projectNameEmpty'));
            }

            // Add project through project manager
            const projectId = await this.projectManager.addProject(name);
            
            // Reload projects to get updated list with correct ordering
            const projects = await this.projectManager.getAllProjects();
            
            // Update state
            this.state.batchUpdate([
                ['projects.items', projects],
                ['projects.loading', false],
                ['projects.error', null]
            ]);

            return projectId;
        } catch (error) {
            this.state.batchUpdate([
                ['projects.loading', false],
                ['projects.error', this.translator.translate('errorAddingProject')]
            ]);
            throw error;
        }
    }

    async updateProject(projectId, updates) {
        try {
            this.state.update('projects.loading', true);

            // Get current project data
            const currentProjects = this.state.select('projects.items');
            const projectIndex = currentProjects.findIndex(p => p.id === projectId);
            
            if (projectIndex === -1) {
                throw new Error(this.translator.translate('projectNotFound'));
            }

            // Update project through project manager
            const updatedProject = {
                ...currentProjects[projectIndex],
                ...updates,
                id: projectId
            };
            
            await this.projectManager.updateProject(updatedProject);

            // Update state
            const newProjects = [...currentProjects];
            newProjects[projectIndex] = updatedProject;
            
            this.state.batchUpdate([
                ['projects.items', newProjects],
                ['projects.loading', false],
                ['projects.error', null]
            ]);

            return updatedProject;
        } catch (error) {
            this.state.batchUpdate([
                ['projects.loading', false],
                ['projects.error', this.translator.translate('errorUpdatingProject')]
            ]);
            throw error;
        }
    }

    async deleteProject(projectId) {
        try {
            // Confirm deletion
            if (!confirm(this.translator.translate('confirmDeleteProject'))) {
                return false;
            }

            this.state.update('projects.loading', true);

            // Delete project through project manager
            await this.projectManager.deleteProject(projectId);

            // Get updated projects list
            const projects = await this.projectManager.getAllProjects();

            // Update state
            const currentProjectId = this.state.select('projects.currentProjectId');
            const updates = [
                ['projects.items', projects],
                ['projects.loading', false],
                ['projects.error', null]
            ];

            // Update current project if deleted
            if (currentProjectId === projectId) {
                updates.push(['projects.currentProjectId', projects[0]?.id || null]);
            }

            this.state.batchUpdate(updates);

            return true;
        } catch (error) {
            this.state.batchUpdate([
                ['projects.loading', false],
                ['projects.error', this.translator.translate('errorDeletingProject')]
            ]);
            throw error;
        }
    }

    async reorderProjects(fromIndex, toIndex) {
        try {
            this.state.update('projects.loading', true);

            // Get current projects
            const projects = [...this.state.select('projects.items')];
            
            // Move project in array
            const [movedProject] = projects.splice(fromIndex, 1);
            projects.splice(toIndex, 0, movedProject);

            // Update order property
            const updatedProjects = projects.map((project, index) => ({
                ...project,
                order: index
            }));

            // Update through project manager
            await this.projectManager.updateProjectOrder(
                updatedProjects.map(p => p.id)
            );

            // Update state
            this.state.batchUpdate([
                ['projects.items', updatedProjects],
                ['projects.loading', false],
                ['projects.error', null]
            ]);
        } catch (error) {
            this.state.batchUpdate([
                ['projects.loading', false],
                ['projects.error', this.translator.translate('errorReorderingProjects')]
            ]);
            throw error;
        }
    }

    // Project selection
    setCurrentProject(projectId) {
        const projects = this.state.select('projects.items');
        const project = projects.find(p => p.id === projectId);
        
        if (!project) {
            console.error('Project not found:', projectId);
            return;
        }

        this.state.update('projects.currentProjectId', projectId);
    }

    // Project statistics
    async getProjectStatistics(projectId, dateRange = null) {
        try {
            const stats = await this.projectManager.getProjectStatistics(
                projectId,
                dateRange?.start,
                dateRange?.end
            );

            return {
                ...stats,
                formattedTotalTime: this.formatDuration(stats.totalTime),
                formattedAverageDuration: this.formatDuration(stats.averageDuration)
            };
        } catch (error) {
            console.error('Error getting project statistics:', error);
            throw new Error(this.translator.translate('errorGettingStatistics'));
        }
    }

    // Utility functions
    formatDuration(duration) {
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // Export project data
    async exportProjectData(projectId) {
        const project = this.state.select('projects.items')
            .find(p => p.id === projectId);
        
        if (!project) {
            throw new Error(this.translator.translate('projectNotFound'));
        }

        const stats = await this.getProjectStatistics(projectId);
        const timeEntries = await this.projectManager.db.getByIndex('timeEntries', 'projectId', projectId);

        return {
            project,
            statistics: stats,
            timeEntries: timeEntries.map(entry => ({
                ...entry,
                formattedDuration: this.formatDuration(entry.duration)
            }))
        };
    }
}
