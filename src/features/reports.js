// src/features/reports.js
export class ReportsFeature {
    constructor(timeEntryManager, projectManager, stateManager, translationManager) {
        this.timeEntryManager = timeEntryManager;
        this.projectManager = projectManager;
        this.state = stateManager;
        this.translator = translationManager;

        this.initializeState();
    }

    initializeState() {
        this.state.batchUpdate([
            ['reports', {
                type: 'weekly',
                dateRange: {
                    start: new Date(),
                    end: new Date()
                },
                selectedProjects: [],
                selectedColumns: [
                    'period',
                    'project',
                    'description',
                    'timeSpent',
                    'totalTime'
                ],
                currentReport: null,
                loading: false,
                error: null
            }]
        ]);
    }

    async generateReport(options = {}) {
        try {
            this.state.update('reports.loading', true);
            
            const currentState = this.state.select('reports');
            const {
                type = currentState.type,
                dateRange = currentState.dateRange,
                selectedProjects = currentState.selectedProjects,
                selectedColumns = currentState.selectedColumns
            } = options;

            // Validate inputs
            if (!this.validateReportInputs(type, dateRange, selectedProjects)) {
                throw new Error(this.translator.translate('invalidReportInputs'));
            }

            // Get time entries for selected projects and date range
            const entries = await this.timeEntryManager.getEntriesInDateRange(
                dateRange.start,
                dateRange.end,
                selectedProjects
            );

            // Generate report based on type
            let report;
            if (type === 'weekly') {
                report = await this.generateWeeklyReport(entries, dateRange, selectedProjects);
            } else {
                report = await this.generateMonthlyReport(entries, dateRange, selectedProjects);
            }

            // Add project names and format durations
            report = await this.enrichReportData(report);

            // Update state with new report
            this.state.batchUpdate([
                ['reports.currentReport', report],
                ['reports.loading', false],
                ['reports.error', null]
            ]);

            return report;
        } catch (error) {
            this.state.batchUpdate([
                ['reports.loading', false],
                ['reports.error', error.message]
            ]);
            throw error;
        }
    }

    validateReportInputs(type, dateRange, selectedProjects) {
        if (!['weekly', 'monthly'].includes(type)) {
            return false;
        }

        if (!dateRange.start || !dateRange.end || dateRange.start > dateRange.end) {
            return false;
        }

        if (!selectedProjects.length) {
            return false;
        }

        return true;
    }

    async generateWeeklyReport(entries, dateRange, selectedProjects) {
        const weeks = {};
        let currentDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);

        while (currentDate <= endDate) {
            const weekStart = this.getWeekStart(currentDate);
            const weekEnd = this.getWeekEnd(currentDate);
            const weekKey = `${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)}`;

            const weekEntries = entries.filter(entry => {
                const entryDate = new Date(entry.start);
                return entryDate >= weekStart && entryDate <= weekEnd;
            });

            if (weekEntries.length > 0) {
                weeks[weekKey] = {
                    period: weekKey,
                    entries: weekEntries,
                    totals: this.calculateTotals(weekEntries, selectedProjects)
                };
            }

            currentDate.setDate(currentDate.getDate() + 7);
        }

        return {
            type: 'weekly',
            dateRange,
            periods: weeks,
            totals: this.calculateTotals(entries, selectedProjects)
        };
    }

    async generateMonthlyReport(entries, dateRange, selectedProjects) {
        const months = {};
        let currentDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);

        while (currentDate <= endDate) {
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            const monthKey = currentDate.toLocaleString('default', { 
                month: 'long', 
                year: 'numeric' 
            });

            const monthEntries = entries.filter(entry => {
                const entryDate = new Date(entry.start);
                return entryDate >= monthStart && entryDate <= monthEnd;
            });

            if (monthEntries.length > 0) {
                months[monthKey] = {
                    period: monthKey,
                    entries: monthEntries,
                    totals: this.calculateTotals(monthEntries, selectedProjects)
                };
            }

            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        return {
            type: 'monthly',
            dateRange,
            periods: months,
            totals: this.calculateTotals(entries, selectedProjects)
        };
    }

    async enrichReportData(report) {
        // Get all project names
        const projects = await this.projectManager.getAllProjects();
        const projectMap = new Map(projects.map(p => [p.id, p.name]));

        // Enrich entries with project names and formatted durations
        const enrichedPeriods = {};
        
        for (const [key, period] of Object.entries(report.periods)) {
            enrichedPeriods[key] = {
                ...period,
                entries: period.entries.map(entry => ({
                    ...entry,
                    projectName: projectMap.get(entry.projectId) || 'Unknown Project',
                    formattedDuration: this.formatDuration(entry.duration)
                })),
                totals: {
                    ...period.totals,
                    byProject: Object.entries(period.totals.byProject).reduce((acc, [id, duration]) => ({
                        ...acc,
                        [projectMap.get(id) || 'Unknown Project']: {
                            duration,
                            formatted: this.formatDuration(duration)
                        }
                    }), {})
                }
            };
        }

        return {
            ...report,
            periods: enrichedPeriods,
            totals: {
                ...report.totals,
                byProject: Object.entries(report.totals.byProject).reduce((acc, [id, duration]) => ({
                    ...acc,
                    [projectMap.get(id) || 'Unknown Project']: {
                        duration,
                        formatted: this.formatDuration(duration)
                    }
                }), {})
            }
        };
    }

    calculateTotals(entries, projectIds) {
        const totals = {
            duration: 0,
            byProject: {}
        };

        projectIds.forEach(id => {
            totals.byProject[id] = 0;
        });

        entries.forEach(entry => {
            totals.duration += entry.duration;
            if (totals.byProject[entry.projectId] !== undefined) {
                totals.byProject[entry.projectId] += entry.duration;
            }
        });

        return totals;
    }

    async exportReport(format) {
        const report = this.state.select('reports.currentReport');
        if (!report) {
            throw new Error(this.translator.translate('noReportToExport'));
        }

        switch (format) {
            case 'csv':
                return this.exportAsCSV(report);
            case 'pdf':
                return this.exportAsPDF(report);
            case 'markdown':
                return this.exportAsMarkdown(report);
            default:
                throw new Error(this.translator.translate('unsupportedExportFormat'));
        }
    }

    exportAsCSV(report) {
        const selectedColumns = this.state.select('reports.selectedColumns');
        const rows = [
            // Header row
            selectedColumns.map(col => this.translator.translate(col))
        ];

        // Data rows
        Object.entries(report.periods).forEach(([period, data]) => {
            data.entries.forEach(entry => {
                const row = selectedColumns.map(col => {
                    switch (col) {
                        case 'period':
                            return period;
                        case 'project':
                            return entry.projectName;
                        case 'description':
                            return entry.description || '';
                        case 'timeSpent':
                            return entry.formattedDuration;
                        case 'totalTime':
                            return this.formatDuration(data.totals.duration);
                        default:
                            return '';
                    }
                });
                rows.push(row);
            });
        });

        // Convert to CSV
        const csv = rows
            .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
            .join('\n');

        return this.downloadFile(csv, 'time_report.csv', 'text/csv');
    }

    exportAsPDF(report) {
        // Implementation would depend on PDF library
        // This is a placeholder for the actual implementation
        const content = this.generatePDFContent(report);
        return this.downloadFile(content, 'time_report.pdf', 'application/pdf');
    }

    exportAsMarkdown(report) {
        const selectedColumns = this.state.select('reports.selectedColumns');
        let md = `# ${this.translator.translate('timeReport')}\n\n`;

        // Report metadata
        md += `${this.translator.translate('reportType')}: ${this.translator.translate(report.type)}\n`;
        md += `${this.translator.translate('dateRange')}: ${this.formatDate(report.dateRange.start)} - ${this.formatDate(report.dateRange.end)}\n\n`;

        // Overall totals
        md += `## ${this.translator.translate('overallTotals')}\n`;
        md += `${this.translator.translate('totalTime')}: ${this.formatDuration(report.totals.duration)}\n\n`;

        // Project totals
        md += `### ${this.translator.translate('projectTotals')}\n`;
        Object.entries(report.totals.byProject).forEach(([project, { formatted }]) => {
            md += `- ${project}: ${formatted}\n`;
        });
        md += '\n';

        // Periods
        Object.entries(report.periods).forEach(([period, data]) => {
            md += `## ${period}\n\n`;
            
            // Table header
            md += `| ${selectedColumns.map(col => this.translator.translate(col)).join(' | ')} |\n`;
            md += `| ${selectedColumns.map(() => '---').join(' | ')} |\n`;

            // Table rows
            data.entries.forEach(entry => {
                const row = selectedColumns.map(col => {
                    switch (col) {
                        case 'period':
                            return period;
                        case 'project':
                            return entry.projectName;
                        case 'description':
                            return entry.description || '-';
                        case 'timeSpent':
                            return entry.formattedDuration;
                        case 'totalTime':
                            return this.formatDuration(data.totals.duration);
                        default:
                            return '';
                    }
                });
                md += `| ${row.join(' | ')} |\n`;
            });
            md += '\n';
        });

        return this.downloadFile(md, 'time_report.md', 'text/markdown');
    }

    // Utility functions
    getWeekStart(date) {
        const result = new Date(date);
        result.setDate(result.getDate() - result.getDay());
        result.setHours(0, 0, 0, 0);
        return result;
    }

    getWeekEnd(date) {
        const result = new Date(date);
        result.setDate(result.getDate() - result.getDay() + 6);
        result.setHours(23, 59, 59, 999);
        return result;
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString();
    }

    formatDuration(duration) {
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
