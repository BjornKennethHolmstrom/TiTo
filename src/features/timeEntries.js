// src/features/timeEntries.js
export class TimeEntriesFeature {
    constructor(timeEntryManager, stateManager, translationManager) {
        this.timeEntryManager = timeEntryManager;
        this.state = stateManager;
        this.translator = translationManager;

        // Initialize state
        this.initializeState();
        
        // Set up state subscriptions
        this.setupSubscriptions();
    }

    async initializeState() {
        this.state.batchUpdate([
            ['timeEntries', {
                items: [],
                filteredItems: [],
                currentPage: 1,
                entriesPerPage: 10,
                totalPages: 1,
                sortOrder: 'newest',
                dateRange: {
                    start: null,
                    end: null
                },
                loading: false,
                error: null,
                filters: {
                    description: '',
                    dateRange: null,
                    projectId: null
                }
            }]
        ]);

        // Load initial entries if there's a current project
        const currentProjectId = this.state.select('projects.currentProjectId');
        if (currentProjectId) {
            await this.loadTimeEntries(currentProjectId);
        }
    }

    setupSubscriptions() {
        // Reload entries when current project changes
        this.state.subscribe('projects.currentProjectId', async (projectId) => {
            if (projectId) {
                await this.loadTimeEntries(projectId);
            }
        });

        // Update filtered items when filters change
        this.state.subscribe('timeEntries.filters', () => {
            this.applyFilters();
        });

        // Update pagination when entries per page changes
        this.state.subscribe('timeEntries.entriesPerPage', () => {
            this.updatePagination();
        });
    }

    async loadTimeEntries(projectId) {
        try {
            this.state.update('timeEntries.loading', true);

            const entries = await this.timeEntryManager.getEntriesForProject(projectId);
            
            this.state.batchUpdate([
                ['timeEntries.items', entries],
                ['timeEntries.loading', false],
                ['timeEntries.error', null]
            ]);

            this.applyFilters();
            this.updatePagination();
        } catch (error) {
            this.state.batchUpdate([
                ['timeEntries.loading', false],
                ['timeEntries.error', this.translator.translate('errorLoadingTimeEntries')]
            ]);
            console.error('Error loading time entries:', error);
        }
    }

    async addEntry(entry) {
        try {
            this.state.update('timeEntries.loading', true);

            const projectId = this.state.select('projects.currentProjectId');
            if (!projectId) {
                throw new Error(this.translator.translate('selectProjectFirst'));
            }

            const newEntry = {
                ...entry,
                projectId,
                start: new Date(entry.start),
                end: new Date(entry.end)
            };

            // Calculate duration
            newEntry.duration = newEntry.end - newEntry.start;

            // Add entry through manager
            const entryId = await this.timeEntryManager.addEntry(newEntry);
            
            // Reload entries to get updated list
            await this.loadTimeEntries(projectId);

            return entryId;
        } catch (error) {
            this.state.batchUpdate([
                ['timeEntries.loading', false],
                ['timeEntries.error', this.translator.translate('errorAddingTimeEntry')]
            ]);
            throw error;
        }
    }

    async updateEntry(entryId, updates) {
        try {
            this.state.update('timeEntries.loading', true);

            const currentEntries = this.state.select('timeEntries.items');
            const entryIndex = currentEntries.findIndex(e => e.id === entryId);

            if (entryIndex === -1) {
                throw new Error(this.translator.translate('timeEntryNotFound'));
            }

            const updatedEntry = {
                ...currentEntries[entryIndex],
                ...updates,
                id: entryId
            };

            // Recalculate duration if start or end time changed
            if (updates.start || updates.end) {
                updatedEntry.start = new Date(updatedEntry.start);
                updatedEntry.end = new Date(updatedEntry.end);
                updatedEntry.duration = updatedEntry.end - updatedEntry.start;
            }

            await this.timeEntryManager.updateEntry(updatedEntry);

            // Reload entries to get updated list
            await this.loadTimeEntries(updatedEntry.projectId);

            return updatedEntry;
        } catch (error) {
            this.state.batchUpdate([
                ['timeEntries.loading', false],
                ['timeEntries.error', this.translator.translate('errorUpdatingTimeEntry')]
            ]);
            throw error;
        }
    }

    async deleteEntry(entryId) {
        try {
            if (!confirm(this.translator.translate('confirmDeleteTimeEntry'))) {
                return false;
            }

            this.state.update('timeEntries.loading', true);

            await this.timeEntryManager.deleteEntry(entryId);

            // Reload entries to get updated list
            const projectId = this.state.select('projects.currentProjectId');
            await this.loadTimeEntries(projectId);

            return true;
        } catch (error) {
            this.state.batchUpdate([
                ['timeEntries.loading', false],
                ['timeEntries.error', this.translator.translate('errorDeletingTimeEntry')]
            ]);
            throw error;
        }
    }

    async deleteAllEntries() {
        try {
            if (!confirm(this.translator.translate('confirmDeleteAllTimeEntries'))) {
                return false;
            }

            this.state.update('timeEntries.loading', true);

            const projectId = this.state.select('projects.currentProjectId');
            await this.timeEntryManager.deleteAllEntriesForProject(projectId);

            // Reset state
            this.state.batchUpdate([
                ['timeEntries.items', []],
                ['timeEntries.filteredItems', []],
                ['timeEntries.loading', false],
                ['timeEntries.error', null],
                ['timeEntries.currentPage', 1]
            ]);

            this.updatePagination();
            return true;
        } catch (error) {
            this.state.batchUpdate([
                ['timeEntries.loading', false],
                ['timeEntries.error', this.translator.translate('errorDeletingAllTimeEntries')]
            ]);
            throw error;
        }
    }

    // Pagination and filtering
    setPage(page) {
        const totalPages = this.state.select('timeEntries.totalPages');
        if (page >= 1 && page <= totalPages) {
            this.state.update('timeEntries.currentPage', page);
        }
    }

    setEntriesPerPage(count) {
        this.state.update('timeEntries.entriesPerPage', count);
        this.state.update('timeEntries.currentPage', 1);
        this.updatePagination();
    }

    setSortOrder(order) {
        if (order !== 'newest' && order !== 'oldest') {
            return;
        }

        this.state.update('timeEntries.sortOrder', order);
        this.applyFilters(); // This will also sort the entries
    }

    updatePagination() {
        const filteredItems = this.state.select('timeEntries.filteredItems');
        const entriesPerPage = this.state.select('timeEntries.entriesPerPage');
        const totalPages = Math.ceil(filteredItems.length / entriesPerPage);
        
        this.state.batchUpdate([
            ['timeEntries.totalPages', totalPages],
            ['timeEntries.currentPage', Math.min(
                this.state.select('timeEntries.currentPage'),
                totalPages || 1
            )]
        ]);
    }

    applyFilters() {
        const items = this.state.select('timeEntries.items');
        const filters = this.state.select('timeEntries.filters');
        const sortOrder = this.state.select('timeEntries.sortOrder');

        let filteredItems = [...items];

        // Apply text filter
        if (filters.description) {
            const searchTerm = filters.description.toLowerCase();
            filteredItems = filteredItems.filter(entry => 
                entry.description?.toLowerCase().includes(searchTerm)
            );
        }

        // Apply date range filter
        if (filters.dateRange) {
            const { start, end } = filters.dateRange;
            filteredItems = filteredItems.filter(entry => {
                const entryDate = new Date(entry.start);
                return entryDate >= start && entryDate <= end;
            });
        }

        // Sort entries
        filteredItems.sort((a, b) => {
            const dateA = new Date(a.start);
            const dateB = new Date(b.start);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

        this.state.update('timeEntries.filteredItems', filteredItems);
        this.updatePagination();
    }

    // Returns entries for current page
    getCurrentPageEntries() {
        const filteredItems = this.state.select('timeEntries.filteredItems');
        const currentPage = this.state.select('timeEntries.currentPage');
        const entriesPerPage = this.state.select('timeEntries.entriesPerPage');

        const startIndex = (currentPage - 1) * entriesPerPage;
        const endIndex = startIndex + entriesPerPage;

        return filteredItems.slice(startIndex, endIndex);
    }

    // Date range handling
    setDateRange(start, end) {
        this.state.update('timeEntries.filters', current => ({
            ...current,
            dateRange: { start, end }
        }));
    }

    clearDateRange() {
        this.state.update('timeEntries.filters', current => ({
            ...current,
            dateRange: null
        }));
    }

    // Search/filter
    setDescriptionFilter(text) {
        this.state.update('timeEntries.filters', current => ({
            ...current,
            description: text
        }));
    }

    // Statistics and analysis
    getStatistics(entries = null) {
        const items = entries || this.state.select('timeEntries.filteredItems');
        
        const totalDuration = items.reduce((sum, entry) => sum + entry.duration, 0);
        const averageDuration = items.length ? totalDuration / items.length : 0;

        return {
            totalEntries: items.length,
            totalDuration: this.formatDuration(totalDuration),
            averageDuration: this.formatDuration(averageDuration),
            firstEntry: items[0]?.start || null,
            lastEntry: items[items.length - 1]?.end || null
        };
    }

    // Utility functions
    formatDuration(duration) {
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    validateTimeEntry(entry) {
        const errors = [];

        if (!entry.start || !entry.end) {
            errors.push(this.translator.translate('invalidTimeRange'));
        }

        if (new Date(entry.start) > new Date(entry.end)) {
            errors.push(this.translator.translate('startAfterEnd'));
        }

        return errors;
    }
}
