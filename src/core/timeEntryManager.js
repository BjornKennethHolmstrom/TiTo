// src/core/timeEntryManager.js
(function(window) {
    'use strict';

    class TimeEntryManager {
        constructor() {
            // Dependencies
            if (!window.titoDatabase) {
                throw new Error('Database service not found. Ensure database.js is loaded first.');
            }
            if (!window.titoTranslator) {
                throw new Error('Translation service not found. Ensure translationManager.js is loaded first.');
            }
            if (!window.titoProjectManager) {
                throw new Error('Project Manager not found. Ensure projectManager.js is loaded first.');
            }

            this.db = window.titoDatabase;
            this.translator = window.titoTranslator;
            this.projectManager = window.titoProjectManager;
            
            // Pagination state
            this.entriesPerPage = 10;
            this.currentPage = 1;
            this.isAllEntries = false;
            this.sortOrder = 'newest';
            
            // Observers for UI updates
            this.observers = new Set();
            
            // Debug mode
            this.debugMode = window.location.search.includes('debug=true');
            
            // Bind methods
            this.notifyObservers = this.notifyObservers.bind(this);
        }

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

        async addEntry(entry) {
            if (!entry.projectId) {
                throw new Error(this.translator.translate('projectIdRequired'));
            }

            try {
                // Validate time range
                await this.validateTimeRange(entry.start, entry.end);

                const newEntry = {
                    projectId: entry.projectId,
                    start: new Date(entry.start).toISOString(),
                    end: new Date(entry.end).toISOString(),
                    duration: new Date(entry.end) - new Date(entry.start),
                    description: entry.description || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                const entryId = await this.db.add('timeEntries', newEntry);
                const addedEntry = { ...newEntry, id: entryId };
                
                this.notifyObservers('entryAdded', addedEntry);
                this.debugLog('Added time entry', addedEntry);
                
                return addedEntry;
            } catch (error) {
                console.error('Error adding time entry:', error);
                throw new Error(this.translator.translate('errorAddingTimeEntry'));
            }
        }

        async getEntriesForProject(projectId, options = {}) {
            try {
                const allEntries = await this.db.getByIndex('timeEntries', 'projectId', projectId);
                
                // Sort entries
                allEntries.sort((a, b) => {
                    return this.sortOrder === 'newest' 
                        ? new Date(b.start) - new Date(a.start)
                        : new Date(a.start) - new Date(b.start);
                });

                // Calculate pagination
                const totalEntries = allEntries.length;
                const totalPages = Math.ceil(totalEntries / this.entriesPerPage);
                
                // Return all entries if isAllEntries is true
                if (this.isAllEntries) {
                    return {
                        entries: allEntries,
                        totalPages: 1,
                        currentPage: 1
                    };
                }

                // Paginate entries
                const startIndex = (this.currentPage - 1) * this.entriesPerPage;
                const endIndex = startIndex + this.entriesPerPage;
                const paginatedEntries = allEntries.slice(startIndex, endIndex);

                return {
                    entries: paginatedEntries,
                    totalPages,
                    currentPage: this.currentPage
                };
            } catch (error) {
                console.error('Error fetching time entries:', error);
                throw new Error(this.translator.translate('errorFetchingTimeEntries'));
            }
        }

        async updateEntry(id, updates) {
            try {
                const entry = await this.db.get('timeEntries', id);
                if (!entry) {
                    throw new Error(this.translator.translate('timeEntryNotFound'));
                }

                // Validate time range if updated
                if (updates.start || updates.end) {
                    await this.validateTimeRange(
                        updates.start || entry.start,
                        updates.end || entry.end
                    );
                }

                const updatedEntry = {
                    ...entry,
                    ...updates,
                    updatedAt: new Date().toISOString()
                };

                // Recalculate duration if start or end time changed
                if (updates.start || updates.end) {
                    updatedEntry.duration = new Date(updatedEntry.end) - new Date(updatedEntry.start);
                }

                await this.db.update('timeEntries', updatedEntry);
                
                this.notifyObservers('entryUpdated', updatedEntry);
                this.debugLog('Updated time entry', updatedEntry);
                
                return updatedEntry;
            } catch (error) {
                console.error('Error updating time entry:', error);
                throw new Error(this.translator.translate('errorUpdatingTimeEntry'));
            }
        }

        async deleteEntry(id) {
            try {
                await this.db.delete('timeEntries', id);
                
                this.notifyObservers('entryDeleted', id);
                this.debugLog('Deleted time entry', id);

            } catch (error) {
                console.error('Error deleting time entry:', error);
                throw new Error(this.translator.translate('errorDeletingTimeEntry'));
            }
        }

        async deleteAllEntriesForProject(projectId) {
            try {
                const entries = await this.db.getByIndex('timeEntries', 'projectId', projectId);
                for (const entry of entries) {
                    await this.db.delete('timeEntries', entry.id);
                }
                
                this.notifyObservers('allEntriesDeleted', projectId);
                this.debugLog('Deleted all entries for project', projectId);

            } catch (error) {
                console.error('Error deleting all time entries:', error);
                throw new Error(this.translator.translate('errorDeletingAllTimeEntries'));
            }
        }

        async getEntriesInDateRange(startDate, endDate, projectIds = null) {
            try {
                const allEntries = await this.db.getAll('timeEntries');
                
                return allEntries.filter(entry => {
                    const entryStart = new Date(entry.start);
                    const entryEnd = new Date(entry.end);
                    
                    // Filter by date range
                    const inDateRange = (
                        (entryStart >= startDate && entryStart <= endDate) ||
                        (entryEnd >= startDate && entryEnd <= endDate) ||
                        (entryStart <= startDate && entryEnd >= endDate)
                    );

                    // Filter by project IDs if provided
                    const inProjects = projectIds ? projectIds.includes(entry.projectId) : true;

                    return inDateRange && inProjects;
                });
            } catch (error) {
                console.error('Error fetching entries in date range:', error);
                throw new Error(this.translator.translate('errorFetchingTimeEntries'));
            }
        }

        async calculateProjectTotals(entries = null) {
            try {
                const timeEntries = entries || await this.db.getAll('timeEntries');
                const projectTotals = {};
                
                timeEntries.forEach(entry => {
                    if (!projectTotals[entry.projectId]) {
                        projectTotals[entry.projectId] = 0;
                    }
                    projectTotals[entry.projectId] += entry.duration;
                });
                
                return projectTotals;
            } catch (error) {
                console.error('Error calculating project totals:', error);
                throw new Error(this.translator.translate('errorCalculatingTotals'));
            }
        }

        setPagination(options) {
            if (options.entriesPerPage) {
                this.entriesPerPage = options.entriesPerPage;
            }
            if (options.currentPage) {
                this.currentPage = options.currentPage;
            }
            if (options.isAllEntries !== undefined) {
                this.isAllEntries = options.isAllEntries;
            }
            this.notifyObservers('paginationChanged', {
                entriesPerPage: this.entriesPerPage,
                currentPage: this.currentPage,
                isAllEntries: this.isAllEntries
            });
        }

        async getTotalPages() {
            const items = await this.db.getByIndex('timeEntries', 'projectId', this.state.select('projects.currentProjectId'));
            const entriesPerPage = this.state.select('timeEntries.entriesPerPage');
            return Math.ceil(items.length / entriesPerPage);
        }

        getCurrentPage() {
            return this.state.select('timeEntries.currentPage');
        }

        setPage(page) {
            const totalPages = Math.ceil(this.state.select('timeEntries.items').length / 
                                       this.state.select('timeEntries.entriesPerPage'));
            
            if (page >= 1 && page <= totalPages) {
                this.state.update('timeEntries.currentPage', page);
            }
        }

        setEntriesPerPage(count) {
            this.state.batchUpdate([
                ['timeEntries.entriesPerPage', count],
                ['timeEntries.currentPage', 1]
            ]);
            this.updatePagination();
        }

        setSortOrder(order) {
            if (order !== 'newest' && order !== 'oldest') {
                throw new Error(this.translator.translate('invalidSortOrder'));
            }
            this.sortOrder = order;
            this.notifyObservers('sortOrderChanged', order);
        }

        async validateTimeRange(start, end) {
            const startDate = new Date(start);
            const endDate = new Date(end);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error(this.translator.translate('invalidDateFormat'));
            }

            if (startDate >= endDate) {
                throw new Error(this.translator.translate('invalidTimeRange'));
            }

            if (endDate > new Date()) {
                throw new Error(this.translator.translate('futureTimeEntry'));
            }

            return true;
        }

        formatDuration(duration) {
            const hours = Math.floor(duration / 3600000);
            const minutes = Math.floor((duration % 3600000) / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        debugLog(action, data = null) {
            if (this.debugMode) {
                console.log(`[TimeEntryManager] ${action}:`, data);
            }
        }
    }

    // Error types for better error handling
    window.TimeEntryErrors = {
        PROJECT_REQUIRED: 'projectIdRequired',
        ENTRY_NOT_FOUND: 'timeEntryNotFound',
        INVALID_DATE: 'invalidDateFormat',
        INVALID_RANGE: 'invalidTimeRange',
        FUTURE_ENTRY: 'futureTimeEntry',
        INVALID_SORT: 'invalidSortOrder',
        FETCH_ERROR: 'errorFetchingTimeEntries',
        ADD_ERROR: 'errorAddingTimeEntry',
        UPDATE_ERROR: 'errorUpdatingTimeEntry',
        DELETE_ERROR: 'errorDeletingTimeEntry',
        DELETE_ALL_ERROR: 'errorDeletingAllTimeEntries',
        CALCULATE_ERROR: 'errorCalculatingTotals'
    };

    // Create global instance
    window.titoTimeEntryManager = new TimeEntryManager();

})(window);
