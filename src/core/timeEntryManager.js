// src/core/timeEntryManager.js
export class TimeEntryManager {
    constructor(database) {
        this.db = database;
        this.entriesPerPage = 10;
        this.currentPage = 1;
        this.isAllEntries = false;
        this.sortOrder = 'newest';
    }

    async addEntry(entry) {
        if (!entry.projectId) {
            throw new Error('Project ID is required for time entry');
        }

        const newEntry = {
            projectId: entry.projectId,
            start: new Date(entry.start).toISOString(),
            end: new Date(entry.end).toISOString(),
            duration: new Date(entry.end) - new Date(entry.start),
            description: entry.description || ''
        };

        return await this.db.add('timeEntries', newEntry);
    }

    async getEntriesForProject(projectId, options = {}) {
        const allEntries = await this.db.getByIndex('timeEntries', 'projectId', projectId);
        
        // Sort entries
        allEntries.sort((a, b) => {
            return this.sortOrder === 'newest' 
                ? new Date(b.start) - new Date(a.start)
                : new Date(a.start) - new Date(b.start);
        });

        // Calculate pagination
        const totalEntries = allEntries.length;
        this.totalPages = Math.ceil(totalEntries / this.entriesPerPage);
        
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
            totalPages: this.totalPages,
            currentPage: this.currentPage
        };
    }

    async updateEntry(id, updates) {
        const entry = await this.db.get('timeEntries', id);
        if (!entry) {
            throw new Error('Time entry not found');
        }

        const updatedEntry = {
            ...entry,
            ...updates
        };

        // Recalculate duration if start or end time changed
        if (updates.start || updates.end) {
            updatedEntry.duration = new Date(updatedEntry.end) - new Date(updatedEntry.start);
        }

        return await this.db.update('timeEntries', updatedEntry);
    }

    async deleteEntry(id) {
        await this.db.delete('timeEntries', id);
    }

    async deleteAllEntriesForProject(projectId) {
        const entries = await this.db.getByIndex('timeEntries', 'projectId', projectId);
        for (const entry of entries) {
            await this.db.delete('timeEntries', entry.id);
        }
    }

    async getEntriesInDateRange(startDate, endDate, projectIds = null) {
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
    }

    setSortOrder(order) {
        if (order !== 'newest' && order !== 'oldest') {
            throw new Error('Invalid sort order. Must be "newest" or "oldest"');
        }
        this.sortOrder = order;
    }

    async calculateProjectTotals(entries = null) {
        const timeEntries = entries || await this.db.getAll('timeEntries');
        const projectTotals = {};
        
        timeEntries.forEach(entry => {
            if (!projectTotals[entry.projectId]) {
                projectTotals[entry.projectId] = 0;
            }
            projectTotals[entry.projectId] += entry.duration;
        });
        
        return projectTotals;
    }

    // Report generation methods
    async generateWeeklyReport(startDate, endDate, projectIds) {
        const entries = await this.getEntriesInDateRange(startDate, endDate, projectIds);
        const report = {};
        
        let currentDate = new Date(startDate);
        endDate = new Date(endDate);

        while (currentDate <= endDate) {
            const weekStart = new Date(currentDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const weekEntries = entries.filter(entry => {
                const entryStart = new Date(entry.start);
                const entryEnd = new Date(entry.end);
                return (
                    (entryStart >= weekStart && entryStart <= weekEnd) ||
                    (entryEnd >= weekStart && entryEnd <= weekEnd) ||
                    (entryStart <= weekStart && entryEnd >= weekEnd)
                );
            });

            const weekTotal = weekEntries.reduce((total, entry) => total + entry.duration, 0);
            const weekKey = `${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)}`;

            report[weekKey] = {
                total: weekTotal,
                entries: weekEntries
            };

            currentDate.setDate(currentDate.getDate() + 7);
        }

        return report;
    }

    async generateMonthlyReport(startDate, endDate, projectIds) {
        const entries = await this.getEntriesInDateRange(startDate, endDate, projectIds);
        const report = {};
        
        let currentDate = new Date(startDate);
        endDate = new Date(endDate);

        while (currentDate <= endDate) {
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

            const monthEntries = entries.filter(entry => {
                const entryStart = new Date(entry.start);
                const entryEnd = new Date(entry.end);
                return (
                    (entryStart >= monthStart && entryStart <= monthEnd) ||
                    (entryEnd >= monthStart && entryEnd <= monthEnd) ||
                    (entryStart <= monthStart && entryEnd >= monthEnd)
                );
            });

            const monthTotal = monthEntries.reduce((total, entry) => total + entry.duration, 0);
            const monthKey = `${monthStart.toLocaleString('default', { month: 'long' })} ${monthStart.getFullYear()}`;

            report[monthKey] = {
                total: monthTotal,
                entries: monthEntries
            };

            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        return report;
    }

    formatDate(date) {
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() - offset * 60 * 1000);
        return adjustedDate.toISOString().split('T')[0];
    }
}
