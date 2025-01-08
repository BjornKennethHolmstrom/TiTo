// src/features/reports.js
(function(window) {
    'use strict';

    class ReportsFeature {
        constructor() {
            // Check dependencies
            if (!window.titoDatabase) {
                throw new Error('Database service not found');
            }
            if (!window.titoState) {
                throw new Error('State Manager not found');
            }
            if (!window.titoTranslator) {
                throw new Error('Translation Manager not found');
            }
            if (!window.titoTimeEntryManager) {
                throw new Error('Time Entry Manager not found');
            }
            if (!window.titoProjectManager) {
                throw new Error('Project Manager not found');
            }

            // Initialize service references
            this.db = window.titoDatabase;
            this.state = window.titoState;
            this.translator = window.titoTranslator;
            this.timeEntryManager = window.titoTimeEntryManager;
            this.projectManager = window.titoProjectManager;

            // Initialize state
            this.state.update('reports', {
                currentReport: null,
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
                loading: false,
                error: null
            });

            // Chart references
            this.charts = {
                timeDistribution: null,
                projectComparison: null
            };

            // Debug mode
            this.debugMode = window.location.search.includes('debug=true');
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

                // Get time entries
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

                // Update state
                this.state.batchUpdate([
                    ['reports.currentReport', report],
                    ['reports.type', type],
                    ['reports.dateRange', dateRange],
                    ['reports.selectedProjects', selectedProjects],
                    ['reports.selectedColumns', selectedColumns],
                    ['reports.loading', false],
                    ['reports.error', null]
                ]);

                this.debugLog('Report generated', report);
                return report;
            } catch (error) {
                console.error('Error generating report:', error);
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
            const projects = await this.projectManager.getAllProjects();
            const projectMap = new Map(projects.map(p => [p.id, p.name]));

            const enrichedPeriods = {};
            
            for (const [key, period] of Object.entries(report.periods)) {
                enrichedPeriods[key] = {
                    ...period,
                    entries: period.entries.map(entry => ({
                        ...entry,
                        projectName: projectMap.get(entry.projectId) || this.translator.translate('unknownProject'),
                        formattedDuration: this.formatDuration(entry.duration)
                    })),
                    totals: {
                        ...period.totals,
                        byProject: Object.entries(period.totals.byProject).reduce((acc, [id, duration]) => ({
                            ...acc,
                            [projectMap.get(id) || this.translator.translate('unknownProject')]: {
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
                        [projectMap.get(id) || this.translator.translate('unknownProject')]: {
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

        updateCharts(report) {
            try {
                if (!window.Chart) {
                    console.warn('Chart.js not loaded');
                    return;
                }

                this.updateTimeDistributionChart(report);
                this.updateProjectComparisonChart(report);
                this.debugLog('Charts updated');
            } catch (error) {
                console.error('Error updating charts:', error);
            }
        }

        updateTimeDistributionChart(report) {
            const ctx = document.getElementById('timeDistributionChart');
            if (!ctx) return;

            const data = Object.entries(report.totals.byProject).map(([project, data]) => ({
                label: project,
                value: data.duration / (1000 * 60 * 60) // Convert to hours
            }));

            if (this.charts.timeDistribution) {
                this.charts.timeDistribution.destroy();
            }

            this.charts.timeDistribution = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: data.map(d => d.label),
                    datasets: [{
                        data: data.map(d => d.value),
                        backgroundColor: this.generateColors(data.length)
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right'
                        },
                        title: {
                            display: true,
                            text: this.translator.translate('timeDistribution')
                        }
                    }
                }
            });
        }

        updateProjectComparisonChart(report) {
            const ctx = document.getElementById('projectComparisonChart');
            if (!ctx) return;

            const data = Object.entries(report.periods).map(([period, data]) => ({
                period,
                ...Object.entries(data.totals.byProject).reduce((acc, [project, duration]) => {
                    acc[project] = duration.duration / (1000 * 60 * 60); // Convert to hours
                    return acc;
                }, {})
            }));

            const projects = Object.keys(report.totals.byProject);
            const colors = this.generateColors(projects.length);

            if (this.charts.projectComparison) {
                this.charts.projectComparison.destroy();
            }

            this.charts.projectComparison = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(d => d.period),
                    datasets: projects.map((project, index) => ({
                        label: project,
                        data: data.map(d => d[project] || 0),
                        backgroundColor: colors[index],
                        borderColor: colors[index]
                    }))
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: this.translator.translate('hours')
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: this.translator.translate('projectComparison')
                        }
                    }
                }
            });
        }

        // Export methods
        async exportReport(format) {
            const report = this.state.select('reports.currentReport');
            if (!report) {
                throw new Error(this.translator.translate('noReportToExport'));
            }

            try {
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
            } catch (error) {
                console.error('Error exporting report:', error);
                throw error;
            }
        }

        // Utility methods
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
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        generateColors(count) {
            const colors = [
                '#4dabf7', '#69db7c', '#ffd43b', '#ff6b6b',
                '#cc5de8', '#5c7cfa', '#20c997', '#ff922b'
            ];
            return Array(count).fill(null).map((_, i) => colors[i % colors.length]);
        }

        debugLog(action, data = null) {
            if (this.debugMode) {
                console.log(`[Reports] ${action}:`, data);
            }
        }
    }

    // Create global instance
    window.titoReportsFeature = new ReportsFeature();

})(window);
