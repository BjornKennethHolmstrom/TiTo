// ui/components/Reports/index.js
class Reports {
    constructor(reportsFeature, stateManager, translationManager, container) {
        this.reportsFeature = reportsFeature;
        this.state = stateManager;
        this.translator = translationManager;
        this.container = container;
        
        this.elements = {
            reportType: null,
            startDate: null,
            endDate: null,
            projectSelection: null,
            columnSelection: null,
            generateButton: null,
            exportButtons: null,
            reportContent: null,
            errorMessage: null
        };

        this.initialize();
        this.setupCharts();
    }

    initialize() {
        this.container.innerHTML = `
            <div class="reports-section">
                <div class="section-header">
                    <h2 class="section-heading" data-i18n="reports">Reports</h2>
                </div>

                <div class="report-controls">
                    <div class="control-group">
                        <label for="reportType" data-i18n="reportType">Report Type:</label>
                        <select id="reportType" class="report-select">
                            <option value="weekly" data-i18n="weeklySummary">Weekly Summary</option>
                            <option value="monthly" data-i18n="monthlySummary">Monthly Summary</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <label for="startDate" data-i18n="startDate">Start Date:</label>
                        <input type="date" id="startDate" class="date-input">
                    </div>

                    <div class="control-group">
                        <label for="endDate" data-i18n="endDate">End Date:</label>
                        <input type="date" id="endDate" class="date-input">
                    </div>
                </div>

                <div class="project-selection">
                    <div class="selection-header">
                        <h3 data-i18n="selectProjects">Select Projects</h3>
                        <div class="selection-controls">
                            <button type="button" class="select-all-button" data-i18n="selectAll">
                                Select All
                            </button>
                            <button type="button" class="deselect-all-button" data-i18n="deselectAll">
                                Deselect All
                            </button>
                        </div>
                    </div>
                    <div class="project-checkboxes"></div>
                </div>

                <div class="column-selection">
                    <h3 data-i18n="selectColumns">Select Columns</h3>
                    <div class="column-checkboxes">
                        <label class="checkbox-label">
                            <input type="checkbox" value="period" checked>
                            <span data-i18n="period">Period</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" value="project" checked>
                            <span data-i18n="project">Project</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" value="description" checked>
                            <span data-i18n="description">Description</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" value="timeSpent" checked>
                            <span data-i18n="timeSpent">Time Spent</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" value="totalTime" checked>
                            <span data-i18n="totalTime">Total Time</span>
                        </label>
                    </div>
                </div>

                <div class="report-actions">
                    <button type="button" class="generate-button" data-i18n="generateReport">
                        Generate Report
                    </button>
                </div>

                <div class="error-message hidden"></div>

                <div class="report-content hidden">
                    <div class="export-buttons">
                        <button type="button" class="export-button" data-format="csv">
                            <span data-i18n="export_as_csv">Export as CSV</span>
                        </button>
                        <button type="button" class="export-button" data-format="pdf">
                            <span data-i18n="export_as_pdf">Export as PDF</span>
                        </button>
                        <button type="button" class="export-button" data-format="markdown">
                            <span data-i18n="export_as_markdown">Export as Markdown</span>
                        </button>
                    </div>

                    <div class="charts-container">
                        <canvas id="timeDistributionChart"></canvas>
                        <canvas id="projectComparisonChart"></canvas>
                    </div>

                    <div class="report-table-container">
                        <table class="report-table">
                            <thead></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.cacheElements();
        this.setupEventListeners();
        this.setDefaultDates();
        this.loadProjects();
    }

    cacheElements() {
        this.elements = {
            reportType: this.container.querySelector('#reportType'),
            startDate: this.container.querySelector('#startDate'),
            endDate: this.container.querySelector('#endDate'),
            projectSelection: this.container.querySelector('.project-checkboxes'),
            columnSelection: this.container.querySelector('.column-checkboxes'),
            generateButton: this.container.querySelector('.generate-button'),
            exportButtons: this.container.querySelector('.export-buttons'),
            reportContent: this.container.querySelector('.report-content'),
            errorMessage: this.container.querySelector('.error-message'),
            selectAllButton: this.container.querySelector('.select-all-button'),
            deselectAllButton: this.container.querySelector('.deselect-all-button'),
            timeDistributionChart: this.container.querySelector('#timeDistributionChart'),
            projectComparisonChart: this.container.querySelector('#projectComparisonChart')
        };
    }

    setupEventListeners() {
        this.elements.generateButton.addEventListener('click', () => this.generateReport());
        
        this.elements.exportButtons.addEventListener('click', (e) => {
            const button = e.target.closest('.export-button');
            if (button) {
                const format = button.dataset.format;
                this.exportReport(format);
            }
        });

        this.elements.selectAllButton.addEventListener('click', () => this.selectAllProjects());
        this.elements.deselectAllButton.addEventListener('click', () => this.deselectAllProjects());

        // Project selection drag select
        let isSelecting = false;
        let initialState = false;

        this.elements.projectSelection.addEventListener('mousedown', (e) => {
            if (e.target.closest('.checkbox-label')) {
                isSelecting = true;
                initialState = !e.target.closest('.checkbox-label').querySelector('input').checked;
            }
        });

        this.elements.projectSelection.addEventListener('mouseover', (e) => {
            if (isSelecting) {
                const checkbox = e.target.closest('.checkbox-label')?.querySelector('input');
                if (checkbox) {
                    checkbox.checked = initialState;
                }
            }
        });

        document.addEventListener('mouseup', () => {
            isSelecting = false;
        });
    }

    setupCharts() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded - charts will be disabled');
            return;
        }
        try {

            // Initialize Chart.js charts
            this.charts = {
                timeDistribution: new Chart(this.elements.timeDistributionChart, {
                    type: 'pie',
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'right'
                            }
                        }
                    }
                }),
                projectComparison: new Chart(this.elements.projectComparisonChart, {
                    type: 'bar',
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
                        }
                    }
                })
            };
        } catch (error) {
            console.error('Error setting up charts:', error);
            this.charts = {};
        }
    }

    async loadProjects() {
        try {
            const projects = await this.reportsFeature.getProjects();
            this.renderProjectCheckboxes(projects);
        } catch (error) {
            this.showError(error.message);
        }
    }

    renderProjectCheckboxes(projects) {
        this.elements.projectSelection.innerHTML = projects.map(project => `
            <label class="checkbox-label">
                <input type="checkbox" value="${project.id}">
                <span>${project.name}</span>
            </label>
        `).join('');
    }

    selectAllProjects() {
        this.elements.projectSelection.querySelectorAll('input[type="checkbox"]')
            .forEach(checkbox => checkbox.checked = true);
    }

    deselectAllProjects() {
        this.elements.projectSelection.querySelectorAll('input[type="checkbox"]')
            .forEach(checkbox => checkbox.checked = false);
    }

    getSelectedProjects() {
        return Array.from(this.elements.projectSelection.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => parseInt(checkbox.value));
    }

    getSelectedColumns() {
        return Array.from(this.elements.columnSelection.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
    }

    setDefaultDates() {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        this.elements.startDate.value = this.formatDate(firstDayOfMonth);
        this.elements.endDate.value = this.formatDate(today);
    }

    async generateReport() {
        try {
            const selectedProjects = this.getSelectedProjects();
            if (selectedProjects.length === 0) {
                throw new Error(this.translator.translate('selectAtLeastOneProject'));
            }

            const report = await this.reportsFeature.generateReport({
                type: this.elements.reportType.value,
                startDate: new Date(this.elements.startDate.value),
                endDate: new Date(this.elements.endDate.value),
                projects: selectedProjects,
                columns: this.getSelectedColumns()
            });

            this.renderReport(report);
            this.updateCharts(report);
            this.elements.reportContent.classList.remove('hidden');
        } catch (error) {
            this.showError(error.message);
        }
    }

    renderReport(report) {
        const table = this.elements.reportContent.querySelector('.report-table');
        const selectedColumns = this.getSelectedColumns();

        // Render header
        const thead = table.querySelector('thead');
        thead.innerHTML = `
            <tr>
                ${selectedColumns.map(column => `
                    <th>${this.translator.translate(column)}</th>
                `).join('')}
            </tr>
        `;

        // Render body
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = Object.entries(report.periods).map(([period, data]) => 
            data.entries.map((entry, index) => `
                <tr>
                    ${selectedColumns.map(column => {
                        switch (column) {
                            case 'period':
                                return `<td>${index === 0 ? period : ''}</td>`;
                            case 'project':
                                return `<td>${entry.projectName}</td>`;
                            case 'description':
                                return `<td>${entry.description || '-'}</td>`;
                            case 'timeSpent':
                                return `<td>${this.formatDuration(entry.duration)}</td>`;
                            case 'totalTime':
                                return `<td>${index === 0 ? this.formatDuration(data.total) : ''}</td>`;
                            default:
                                return '<td></td>';
                        }
                    }).join('')}
                </tr>
            `).join('')
        ).join('');
    }

    updateCharts(report) {
        // Update time distribution chart
        const timeDistributionData = Object.entries(report.totals.byProject).map(([project, data]) => ({
            label: project,
            value: data.duration / (1000 * 60 * 60) // Convert to hours
        }));

        this.charts.timeDistribution.data = {
            labels: timeDistributionData.map(d => d.label),
            datasets: [{
                data: timeDistributionData.map(d => d.value),
                backgroundColor: this.generateColors(timeDistributionData.length)
            }]
        };
        this.charts.timeDistribution.update();

        // Update project comparison chart
        const projectComparisonData = Object.entries(report.periods).map(([period, data]) => ({
            period,
            ...Object.entries(data.totals.byProject).reduce((acc, [project, duration]) => {
                acc[project] = duration / (1000 * 60 * 60); // Convert to hours
                return acc;
            }, {})
        }));

        const projects = Object.keys(report.totals.byProject);
        this.charts.projectComparison.data = {
            labels: projectComparisonData.map(d => d.period),
            datasets: projects.map((project, index) => ({
                label: project,
                data: projectComparisonData.map(d => d[project] || 0),
                backgroundColor: this.generateColors(1)[0],
                borderColor: this.generateColors(1)[0]
            }))
        };
        this.charts.projectComparison.update();
    }

    async exportReport(format) {
        try {
            await this.reportsFeature.exportReport(format);
        } catch (error) {
            this.showError(error.message);
        }
    }

    // Utility functions
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatDuration(ms) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    generateColors(count) {
        const baseColors = [
            '#4dabf7', '#69db7c', '#ffd43b', '#ff6b6b',
            '#cc5de8', '#5c7cfa', '#20c997', '#ff922b'
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        
        setTimeout(() => {
            this.elements.errorMessage.classList.add('hidden');
        }, 5000);
    }

    updateTranslations() {
        // Update static text elements
        this.container.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.translator.translate(key);
        });

        // Update chart labels
        if (this.charts) {
            // Update time distribution chart
            if (this.charts.timeDistribution) {
                this.charts.timeDistribution.options.plugins.title = {
                    display: true,
                    text: this.translator.translate('timeDistribution')
                };
                this.charts.timeDistribution.update();
            }

            // Update project comparison chart
            if (this.charts.projectComparison) {
                this.charts.projectComparison.options.scales.y.title.text = 
                    this.translator.translate('hours');
                this.charts.projectComparison.options.plugins.title = {
                    display: true,
                    text: this.translator.translate('projectComparison')
                };
                this.charts.projectComparison.update();
            }
        }

        // Update button labels
        const buttonTranslations = {
            '.generate-button': 'generateReport',
            '.select-all-button': 'selectAll',
            '.deselect-all-button': 'deselectAll'
        };

        Object.entries(buttonTranslations).forEach(([selector, key]) => {
            const button = this.container.querySelector(selector);
            if (button) {
                button.textContent = this.translator.translate(key);
            }
        });

        // Update export buttons
        this.container.querySelectorAll('.export-button').forEach(button => {
            const format = button.dataset.format;
            button.textContent = this.translator.translate(`export_as_${format}`);
        });

        // If there's an active report, re-render it with translated headers
        if (!this.elements.reportContent.classList.contains('hidden')) {
            const table = this.elements.reportContent.querySelector('.report-table');
            const headers = table.querySelectorAll('th');
            headers.forEach(header => {
                const key = header.getAttribute('data-column-key');
                if (key) {
                    header.textContent = this.translator.translate(key);
                }
            });
        }
    }

    destroy() {
        // Clean up charts
        if (this.charts) {
            Object.values(this.charts).forEach(chart => {
                if (chart) {
                    chart.destroy();
                }
            });
        }

        // Remove event listeners
        this.elements.generateButton.removeEventListener('click', this.generateReport);
        this.elements.selectAllButton.removeEventListener('click', this.selectAllProjects);
        this.elements.deselectAllButton.removeEventListener('click', this.deselectAllProjects);

        // Clear any intervals or timeouts
        if (this._errorTimeout) {
            clearTimeout(this._errorTimeout);
        }
    }
}
