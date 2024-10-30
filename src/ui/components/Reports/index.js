// src/ui/components/Reports/index.js
import { createElement as h } from 'react';
import { useState, useEffect } from 'react';
import { 
    Calendar,
    Download,
    FileText,
    Table,
    File,
    CheckSquare,
    Square,
    AlertCircle,
    Loader
} from 'lucide-react';

export const Reports = ({
    reportsFeature,
    stateManager,
    translationManager,
    className = ''
}) => {
    // Local state for form controls
    const [reportType, setReportType] = useState('weekly');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedColumns, setSelectedColumns] = useState([
        'period',
        'project',
        'description',
        'timeSpent',
        'totalTime'
    ]);

    // State subscriptions
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentReport, setCurrentReport] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState(new Set());

    useEffect(() => {
        const unsubscribers = [
            stateManager.subscribe('reports.loading', setLoading),
            stateManager.subscribe('reports.error', setError),
            stateManager.subscribe('reports.currentReport', setCurrentReport),
            stateManager.subscribe('projects.items', setProjects)
        ];

        return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    }, [stateManager]);

    // Report generation
    const handleGenerateReport = async () => {
        try {
            await reportsFeature.generateReport({
                type: reportType,
                dateRange: {
                    start: new Date(startDate),
                    end: new Date(endDate)
                },
                selectedProjects: Array.from(selectedProjects),
                selectedColumns
            });
        } catch (error) {
            console.error('Error generating report:', error);
        }
    };

    // Export handlers
    const handleExport = async (format) => {
        try {
            await reportsFeature.exportReport(format);
        } catch (error) {
            console.error('Error exporting report:', error);
        }
    };

    // Project selection handlers
    const handleSelectAllProjects = () => {
        setSelectedProjects(new Set(projects.map(p => p.id)));
    };

    const handleDeselectAllProjects = () => {
        setSelectedProjects(new Set());
    };

    const toggleProject = (projectId) => {
        const newSelection = new Set(selectedProjects);
        if (newSelection.has(projectId)) {
            newSelection.delete(projectId);
        } else {
            newSelection.add(projectId);
        }
        setSelectedProjects(newSelection);
    };

    // Column selection handler
    const toggleColumn = (column) => {
        if (selectedColumns.includes(column)) {
            setSelectedColumns(selectedColumns.filter(c => c !== column));
        } else {
            setSelectedColumns([...selectedColumns, column]);
        }
    };

    return h('div', { className: `space-y-6 ${className}` }, [
        // Report configuration
        h('div', { className: 'bg-muted/50 rounded-lg p-4 space-y-4' }, [
            // Report type and date range
            h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
                h('div', { className: 'space-y-2' }, [
                    h('label', { 
                        className: 'block text-sm font-medium',
                        htmlFor: 'reportType'
                    }, translationManager.translate('reportType')),
                    h('select', {
                        id: 'reportType',
                        value: reportType,
                        onChange: (e) => setReportType(e.target.value),
                        className: 'w-full rounded-md border bg-background px-3 py-2'
                    }, [
                        h('option', { value: 'weekly' }, 
                            translationManager.translate('weeklySummary')
                        ),
                        h('option', { value: 'monthly' }, 
                            translationManager.translate('monthlySummary')
                        )
                    ])
                ]),
                h('div', { className: 'space-y-2' }, [
                    h('label', { 
                        className: 'block text-sm font-medium',
                        htmlFor: 'startDate'
                    }, translationManager.translate('startDate')),
                    h('input', {
                        id: 'startDate',
                        type: 'date',
                        value: startDate,
                        onChange: (e) => setStartDate(e.target.value),
                        className: 'w-full rounded-md border bg-background px-3 py-2'
                    })
                ]),
                h('div', { className: 'space-y-2' }, [
                    h('label', { 
                        className: 'block text-sm font-medium',
                        htmlFor: 'endDate'
                    }, translationManager.translate('endDate')),
                    h('input', {
                        id: 'endDate',
                        type: 'date',
                        value: endDate,
                        onChange: (e) => setEndDate(e.target.value),
                        className: 'w-full rounded-md border bg-background px-3 py-2'
                    })
                ])
            ]),

            // Project selection
            h('div', { className: 'space-y-2' }, [
                h('div', { className: 'flex items-center justify-between' }, [
                    h('label', { className: 'text-sm font-medium' },
                        translationManager.translate('selectProjects')
                    ),
                    h('div', { className: 'space-x-2' }, [
                        h('button', {
                            onClick: handleSelectAllProjects,
                            className: 'text-sm hover:underline'
                        }, translationManager.translate('selectAll')),
                        h('button', {
                            onClick: handleDeselectAllProjects,
                            className: 'text-sm hover:underline'
                        }, translationManager.translate('deselectAll'))
                    ])
                ]),
                h('div', { 
                    className: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2',
                    role: 'group',
                    'aria-label': translationManager.translate('projectSelection')
                }, projects.map(project =>
                    h('label', {
                        key: project.id,
                        className: 'flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            className: 'hidden',
                            checked: selectedProjects.has(project.id),
                            onChange: () => toggleProject(project.id)
                        }),
                        selectedProjects.has(project.id) ?
                            h(CheckSquare, { size: 16 }) :
                            h(Square, { size: 16 }),
                        h('span', { className: 'text-sm' }, project.name)
                    ])
                ))
            ]),

            // Column selection
            h('div', { className: 'space-y-2' }, [
                h('label', { className: 'block text-sm font-medium' },
                    translationManager.translate('selectColumns')
                ),
                h('div', { 
                    className: 'flex flex-wrap gap-3',
                    role: 'group',
                    'aria-label': translationManager.translate('columnSelection')
                }, [
                    'period',
                    'project',
                    'description',
                    'timeSpent',
                    'totalTime'
                ].map(column =>
                    h('label', {
                        key: column,
                        className: 'flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            className: 'hidden',
                            checked: selectedColumns.includes(column),
                            onChange: () => toggleColumn(column)
                        }),
                        selectedColumns.includes(column) ?
                            h(CheckSquare, { size: 16 }) :
                            h(Square, { size: 16 }),
                        h('span', { className: 'text-sm' },
                            translationManager.translate(column)
                        )
                    ])
                ))
            ]),

            // Generate report button
            h('div', { className: 'flex justify-end' }, [
                h('button', {
                    onClick: handleGenerateReport,
                    disabled: loading || selectedProjects.size === 0,
                    className: `
                        inline-flex items-center space-x-2 
                        px-4 py-2 rounded-md
                        bg-primary text-primary-foreground 
                        hover:bg-primary/90 
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `
                }, [
                    loading ? h(Loader, { 
                        size: 16,
                        className: 'animate-spin'
                    }) : h(FileText, { size: 16 }),
                    h('span', {}, translationManager.translate('generateReport'))
                ])
            ])
        ]),

        // Error message
        error && h('div', {
            className: 'bg-destructive/10 text-destructive rounded-lg p-4 flex items-center space-x-2'
        }, [
            h(AlertCircle, { size: 16 }),
            h('span', {}, error)
        ]),

        // Report display
        currentReport && h('div', { className: 'space-y-4' }, [
            // Export buttons
            h('div', { className: 'flex justify-end space-x-2' }, [
                ['csv', 'pdf', 'markdown'].map(format =>
                    h('button', {
                        key: format,
                        onClick: () => handleExport(format),
                        className: `
                            inline-flex items-center space-x-2 
                            px-3 py-2 rounded-md
                            bg-secondary text-secondary-foreground 
                            hover:bg-secondary/90
                        `
                    }, [
                        h(Download, { size: 16 }),
                        h('span', {}, 
                            translationManager.translate(`export_as_${format}`)
                        )
                    ])
                )
            ]),

            // Report content
            h('div', { 
                className: 'bg-muted/50 rounded-lg overflow-hidden',
                role: 'region',
                'aria-label': translationManager.translate('reportContent')
            }, [
                // Report header
                h('div', { className: 'p-4 border-b space-y-2' }, [
                    h('h3', { className: 'text-lg font-medium' },
                        translationManager.translate(
                            reportType === 'weekly' ? 'weeklySummary' : 'monthlySummary'
                        )
                    ),
                    h('div', { className: 'flex items-center space-x-2 text-sm text-muted-foreground' }, [
                        h(Calendar, { size: 16 }),
                        h('span', {}, `${startDate} - ${endDate}`)
                    ])
                ]),

                // Report data table
                h('div', { className: 'p-4 overflow-x-auto' }, [
                    h('table', { className: 'w-full' }, [
                        h('thead', {}, [
                            h('tr', { className: 'border-b' }, 
                                selectedColumns.map(column =>
                                    h('th', {
                                        key: column,
                                        className: 'p-2 text-left text-sm font-medium'
                                    }, translationManager.translate(column))
                                )
                            )
                        ]),
                        h('tbody', {}, 
                            Object.entries(currentReport.periods).flatMap(([period, data]) =>
                                data.entries.map((entry, index) =>
                                    h('tr', {
                                        key: `${period}-${entry.id}`,
                                        className: 'border-b last:border-0'
                                    }, selectedColumns.map(column => {
                                        let content;
                                        switch (column) {
                                            case 'period':
                                                content = period;
                                                break;
                                            case 'project':
                                                content = entry.projectName;
                                                break;
                                            case 'description':
                                                content = entry.description || '-';
                                                break;
                                            case 'timeSpent':
                                                content = entry.formattedDuration;
                                                break;
                                            case 'totalTime':
                                                content = index === 0 ? 
                                                    this.formatDuration(data.totals.duration) : 
                                                    '';
                                                break;
                                            default:
                                                content = '';
                                        }
                                        return h('td', {
                                            key: column,
                                            className: 'p-2 text-sm',
                                            ...((column === 'period' || column === 'totalTime') && 
                                                index > 0 && { className: 'p-2 text-sm text-muted-foreground' })
                                        }, content);
                                    }))
                                )
                            )
                        )
                    ])
                ])
            ])
        ])
    ]);
};

export default Reports;
