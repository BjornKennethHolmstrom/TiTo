// src/ui/components/Settings/index.js
import { createElement as h } from 'react';
import { useState, useEffect } from 'react';
import {
    Save,
    Reset,
    Download,
    Upload,
    Clock,
    Layout,
    Globe,
    Bell,
    FileText,
    Folder,
    Database,
    ChevronRight,
    AlertCircle,
    Check,
    Loader,
    X
} from 'lucide-react';

// Sub-components
const SettingSection = ({ title, description, children, className = '' }) => {
    return h('section', {
        className: `space-y-4 ${className}`
    }, [
        h('div', { className: 'space-y-1' }, [
            h('h3', { className: 'text-lg font-medium' }, title),
            description && h('p', { 
                className: 'text-sm text-muted-foreground' 
            }, description)
        ]),
        children
    ]);
};

const SettingItem = ({ 
    label, 
    description, 
    control,
    error,
    className = '' 
}) => {
    return h('div', {
        className: `flex flex-row items-start justify-between gap-4 ${className}`
    }, [
        h('div', { className: 'space-y-0.5' }, [
            h('label', { 
                className: 'text-sm font-medium',
                htmlFor: control.props.id
            }, label),
            description && h('p', { 
                className: 'text-xs text-muted-foreground' 
            }, description)
        ]),
        h('div', { className: 'flex flex-col items-end gap-1' }, [
            control,
            error && h('span', { 
                className: 'text-xs text-destructive' 
            }, error)
        ])
    ]);
};

// Main Settings component
export const Settings = ({
    settingsFeature,
    stateManager,
    translationManager,
    className = ''
}) => {
    // Local state for form values and UI
    const [currentSection, setCurrentSection] = useState('general');
    const [formValues, setFormValues] = useState({});
    const [importing, setImporting] = useState(false);

    // State subscriptions
    const [settings, setSettings] = useState(null);
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const unsubscribers = [
            stateManager.subscribe('settings.current', setSettings),
            stateManager.subscribe('settings.unsavedChanges', setUnsavedChanges),
            stateManager.subscribe('settings.loading', setLoading),
            stateManager.subscribe('settings.error', setError)
        ];

        return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    }, [stateManager]);

    // Initialize form values when settings load
    useEffect(() => {
        if (settings) {
            setFormValues(settings);
        }
    }, [settings]);

    // Handle setting changes
    const handleSettingChange = async (path, value) => {
        try {
            // Update local form state
            setFormValues(prev => {
                const updated = { ...prev };
                let current = updated;
                const parts = path.split('.');
                
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!(parts[i] in current)) {
                        current[parts[i]] = {};
                    }
                    current = current[parts[i]];
                }
                
                current[parts[parts.length - 1]] = value;
                return updated;
            });

            // Update settings in feature
            await settingsFeature.updateSettings(path, value);
        } catch (error) {
            console.error('Error updating setting:', error);
        }
    };

    // Handle form submission
    const handleSave = async () => {
        try {
            await settingsFeature.saveSettings(formValues);
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    };

    // Handle settings reset
    const handleReset = async (section = null) => {
        if (confirm(translationManager.translate('confirmResetSettings'))) {
            try {
                const resetSettings = await settingsFeature.resetSettings(section);
                setFormValues(resetSettings);
            } catch (error) {
                console.error('Error resetting settings:', error);
            }
        }
    };

    // Handle import/export
    const handleExport = () => {
        try {
            settingsFeature.exportSettings();
        } catch (error) {
            console.error('Error exporting settings:', error);
        }
    };

    const handleImport = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setImporting(true);
            const imported = await settingsFeature.importSettings(file);
            setFormValues(imported);
        } catch (error) {
            console.error('Error importing settings:', error);
        } finally {
            setImporting(false);
            event.target.value = ''; // Reset file input
        }
    };

    // Navigation sections
    const sections = [
        {
            id: 'general',
            label: translationManager.translate('generalSettings'),
            icon: Globe,
            render: () => h(SettingSection, {
                title: translationManager.translate('generalSettings'),
                description: translationManager.translate('generalSettingsDescription')
            }, [
                // Language selection
                h(SettingItem, {
                    label: translationManager.translate('language'),
                    description: translationManager.translate('languageDescription'),
                    control: h('select', {
                        id: 'language',
                        value: formValues.general?.language,
                        onChange: (e) => handleSettingChange('general.language', e.target.value),
                        className: 'rounded-md border bg-background px-3 py-1'
                    }, [
                        h('option', { value: 'en' }, 'English'),
                        h('option', { value: 'es' }, 'Español'),
                        h('option', { value: 'se' }, 'Svenska'),
                        h('option', { value: 'eu' }, 'Euskara'),
                        h('option', { value: 'fr' }, 'Française'),
                        h('option', { value: 'de' }, 'Deutsch'),
                        h('option', { value: 'ja' }, '日本語')
                    ])
                }),

                // Start page selection
                h(SettingItem, {
                    label: translationManager.translate('startPage'),
                    description: translationManager.translate('startPageDescription'),
                    control: h('select', {
                        id: 'startPage',
                        value: formValues.general?.startPage,
                        onChange: (e) => handleSettingChange('general.startPage', e.target.value),
                        className: 'rounded-md border bg-background px-3 py-1'
                    }, [
                        h('option', { value: 'timer' }, 
                            translationManager.translate('timer')
                        ),
                        h('option', { value: 'projects' }, 
                            translationManager.translate('projects')
                        ),
                        h('option', { value: 'reports' }, 
                            translationManager.translate('reports')
                        )
                    ])
                }),

                // Notifications toggle
                h(SettingItem, {
                    label: translationManager.translate('showNotifications'),
                    description: translationManager.translate('showNotificationsDescription'),
                    control: h('label', {
                        className: 'relative inline-flex items-center cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            id: 'showNotifications',
                            checked: formValues.general?.showNotifications,
                            onChange: (e) => handleSettingChange(
                                'general.showNotifications',
                                e.target.checked
                            ),
                            className: 'sr-only peer'
                        }),
                        h('div', {
                            className: `
                                w-11 h-6 bg-muted
                                peer-focus:outline-none peer-focus:ring-2
                                peer-focus:ring-primary
                                rounded-full peer
                                peer-checked:after:translate-x-full
                                peer-checked:bg-primary
                                after:content-['']
                                after:absolute after:top-[2px] after:left-[2px]
                                after:bg-background
                                after:rounded-full after:h-5 after:w-5
                                after:transition-all
                            `
                        })
                    ])
                }),

                // Confirm before delete toggle
                h(SettingItem, {
                    label: translationManager.translate('confirmBeforeDelete'),
                    description: translationManager.translate('confirmBeforeDeleteDescription'),
                    control: h('label', {
                        className: 'relative inline-flex items-center cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            id: 'confirmBeforeDelete',
                            checked: formValues.general?.confirmBeforeDelete,
                            onChange: (e) => handleSettingChange(
                                'general.confirmBeforeDelete',
                                e.target.checked
                            ),
                            className: 'sr-only peer'
                        }),
                        h('div', {
                            className: `
                                w-11 h-6 bg-muted
                                peer-focus:outline-none peer-focus:ring-2
                                peer-focus:ring-primary
                                rounded-full peer
                                peer-checked:after:translate-x-full
                                peer-checked:bg-primary
                                after:content-['']
                                after:absolute after:top-[2px] after:left-[2px]
                                after:bg-background
                                after:rounded-full after:h-5 after:w-5
                                after:transition-all
                            `
                        })
                    ])
                })
            ])
        },
        // Timer settings
        {
            id: 'timer',
            label: translationManager.translate('timerSettings'),
            icon: Clock,
            render: () => h(SettingSection, {
                title: translationManager.translate('timerSettings'),
                description: translationManager.translate('timerSettingsDescription')
            }, [
                // Show seconds toggle
                h(SettingItem, {
                    label: translationManager.translate('showSeconds'),
                    control: h('label', {
                        className: 'relative inline-flex items-center cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            id: 'showSeconds',
                            checked: formValues.timer?.showSeconds,
                            onChange: (e) => handleSettingChange(
                                'timer.showSeconds',
                                e.target.checked
                            ),
                            className: 'sr-only peer'
                        }),
                        h('div', {
                            className: `
                                w-11 h-6 bg-muted
                                peer-focus:outline-none peer-focus:ring-2
                                peer-focus:ring-primary
                                rounded-full peer
                                peer-checked:after:translate-x-full
                                peer-checked:bg-primary
                                after:content-['']
                                after:absolute after:top-[2px] after:left-[2px]
                                after:bg-background
                                after:rounded-full after:h-5 after:w-5
                                after:transition-all
                            `
                        })
                    ])
                }),

                // Round time selection
                h(SettingItem, {
                    label: translationManager.translate('roundTimeTo'),
                    description: translationManager.translate('roundTimeToDescription'),
                    control: h('select', {
                        id: 'roundTimeTo',
                        value: formValues.timer?.roundTimeTo,
                        onChange: (e) => handleSettingChange(
                            'timer.roundTimeTo',
                            parseInt(e.target.value)
                        ),
                        className: 'rounded-md border bg-background px-3 py-1'
                    }, [
                        h('option', { value: '0' }, 
                            translationManager.translate('noRounding')
                        ),
                        h('option', { value: '5' }, '5 min'),
                        h('option', { value: '15' }, '15 min'),
                        h('option', { value: '30' }, '30 min')
                    ])
                })
                                // Auto start on project select
                h(SettingItem, {
                    label: translationManager.translate('autoStartOnProjectSelect'),
                    description: translationManager.translate('autoStartOnProjectSelectDescription'),
                    control: h('label', {
                        className: 'relative inline-flex items-center cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            id: 'autoStartOnProjectSelect',
                            checked: formValues.timer?.autoStartOnProjectSelect,
                            onChange: (e) => handleSettingChange(
                                'timer.autoStartOnProjectSelect',
                                e.target.checked
                            ),
                            className: 'sr-only peer'
                        }),
                        h('div', {
                            className: `
                                w-11 h-6 bg-muted
                                peer-focus:outline-none peer-focus:ring-2
                                peer-focus:ring-primary
                                rounded-full peer
                                peer-checked:after:translate-x-full
                                peer-checked:bg-primary
                                after:content-['']
                                after:absolute after:top-[2px] after:left-[2px]
                                after:bg-background
                                after:rounded-full after:h-5 after:w-5
                                after:transition-all
                            `
                        })
                    ])
                }),

                // Default duration for manual entries
                h(SettingItem, {
                    label: translationManager.translate('defaultDuration'),
                    description: translationManager.translate('defaultDurationDescription'),
                    control: h('input', {
                        type: 'number',
                        id: 'defaultDuration',
                        min: 1,
                        max: 480, // 8 hours
                        value: formValues.timer?.defaultDuration,
                        onChange: (e) => handleSettingChange(
                            'timer.defaultDuration',
                            parseInt(e.target.value)
                        ),
                        className: 'w-20 rounded-md border bg-background px-3 py-1'
                    })
                })
            ])
        },
        {
            id: 'timeEntries',
            label: translationManager.translate('timeEntriesSettings'),
            icon: FileText,
            render: () => h(SettingSection, {
                title: translationManager.translate('timeEntriesSettings'),
                description: translationManager.translate('timeEntriesSettingsDescription')
            }, [
                // Entries per page
                h(SettingItem, {
                    label: translationManager.translate('entriesPerPage'),
                    control: h('select', {
                        id: 'entriesPerPage',
                        value: formValues.timeEntries?.entriesPerPage,
                        onChange: (e) => handleSettingChange(
                            'timeEntries.entriesPerPage',
                            parseInt(e.target.value)
                        ),
                        className: 'rounded-md border bg-background px-3 py-1'
                    }, [5, 10, 20, 30, 50].map(num =>
                        h('option', { key: num, value: num }, num)
                    ))
                }),

                // Default sort order
                h(SettingItem, {
                    label: translationManager.translate('defaultSortOrder'),
                    control: h('select', {
                        id: 'defaultSortOrder',
                        value: formValues.timeEntries?.defaultSortOrder,
                        onChange: (e) => handleSettingChange(
                            'timeEntries.defaultSortOrder',
                            e.target.value
                        ),
                        className: 'rounded-md border bg-background px-3 py-1'
                    }, [
                        h('option', { value: 'newest' }, 
                            translationManager.translate('newest')
                        ),
                        h('option', { value: 'oldest' }, 
                            translationManager.translate('oldest')
                        )
                    ])
                }),

                // Show descriptions
                h(SettingItem, {
                    label: translationManager.translate('showDescriptions'),
                    control: h('label', {
                        className: 'relative inline-flex items-center cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            id: 'showDescriptions',
                            checked: formValues.timeEntries?.showDescriptions,
                            onChange: (e) => handleSettingChange(
                                'timeEntries.showDescriptions',
                                e.target.checked
                            ),
                            className: 'sr-only peer'
                        }),
                        h('div', {
                            className: `
                                w-11 h-6 bg-muted
                                peer-focus:outline-none peer-focus:ring-2
                                peer-focus:ring-primary
                                rounded-full peer
                                peer-checked:after:translate-x-full
                                peer-checked:bg-primary
                                after:content-['']
                                after:absolute after:top-[2px] after:left-[2px]
                                after:bg-background
                                after:rounded-full after:h-5 after:w-5
                                after:transition-all
                            `
                        })
                    ])
                }),

                // Group by day
                h(SettingItem, {
                    label: translationManager.translate('groupByDay'),
                    control: h('label', {
                        className: 'relative inline-flex items-center cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            id: 'groupByDay',
                            checked: formValues.timeEntries?.groupByDay,
                            onChange: (e) => handleSettingChange(
                                'timeEntries.groupByDay',
                                e.target.checked
                            ),
                            className: 'sr-only peer'
                        }),
                        h('div', {
                            className: `
                                w-11 h-6 bg-muted
                                peer-focus:outline-none peer-focus:ring-2
                                peer-focus:ring-primary
                                rounded-full peer
                                peer-checked:after:translate-x-full
                                peer-checked:bg-primary
                                after:content-['']
                                after:absolute after:top-[2px] after:left-[2px]
                                after:bg-background
                                after:rounded-full after:h-5 after:w-5
                                after:transition-all
                            `
                        })
                    ])
                })
            ])
        },
        {
            id: 'projects',
            label: translationManager.translate('projectSettings'),
            icon: Folder,
            render: () => h(SettingSection, {
                title: translationManager.translate('projectSettings'),
                description: translationManager.translate('projectSettingsDescription')
            }, [
                // Show inactive projects
                h(SettingItem, {
                    label: translationManager.translate('showInactive'),
                    control: h('label', {
                        className: 'relative inline-flex items-center cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            id: 'showInactive',
                            checked: formValues.projects?.showInactive,
                            onChange: (e) => handleSettingChange(
                                'projects.showInactive',
                                e.target.checked
                            ),
                            className: 'sr-only peer'
                        }),
                        h('div', {
                            className: `
                                w-11 h-6 bg-muted
                                peer-focus:outline-none peer-focus:ring-2
                                peer-focus:ring-primary
                                rounded-full peer
                                peer-checked:after:translate-x-full
                                peer-checked:bg-primary
                                after:content-['']
                                after:absolute after:top-[2px] after:left-[2px]
                                after:bg-background
                                after:rounded-full after:h-5 after:w-5
                                after:transition-all
                            `
                        })
                    ])
                }),

                // Color coding
                h(SettingItem, {
                    label: translationManager.translate('colorCoding'),
                    control: h('label', {
                        className: 'relative inline-flex items-center cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            id: 'colorCoding',
                            checked: formValues.projects?.colorCoding,
                            onChange: (e) => handleSettingChange(
                                'projects.colorCoding',
                                e.target.checked
                            ),
                            className: 'sr-only peer'
                        }),
                        h('div', {
                            className: `
                                w-11 h-6 bg-muted
                                peer-focus:outline-none peer-focus:ring-2
                                peer-focus:ring-primary
                                rounded-full peer
                                peer-checked:after:translate-x-full
                                peer-checked:bg-primary
                                after:content-['']
                                after:absolute after:top-[2px] after:left-[2px]
                                after:bg-background
                                after:rounded-full after:h-5 after:w-5
                                after:transition-all
                            `
                        })
                    ])
                }),

                // Default goal period
                h(SettingItem, {
                    label: translationManager.translate('defaultGoalPeriod'),
                    control: h('select', {
                        id: 'defaultGoalPeriod',
                        value: formValues.projects?.defaultGoalPeriod,
                        onChange: (e) => handleSettingChange(
                            'projects.defaultGoalPeriod',
                            e.target.value
                        ),
                        className: 'rounded-md border bg-background px-3 py-1'
                    }, [
                        h('option', { value: 'daily' }, 
                            translationManager.translate('daily')
                        ),
                        h('option', { value: 'weekly' }, 
                            translationManager.translate('weekly')
                        ),
                        h('option', { value: 'monthly' }, 
                            translationManager.translate('monthly')
                        )
                    ])
                })
            ])
        },
        {
            id: 'reports',
            label: translationManager.translate('reportSettings'),
            icon: FileText,
            render: () => h(SettingSection, {
                title: translationManager.translate('reportSettings'),
                description: translationManager.translate('reportSettingsDescription')
            }, [
                // Default report type
                h(SettingItem, {
                    label: translationManager.translate('defaultReportType'),
                    control: h('select', {
                        id: 'defaultReportType',
                        value: formValues.reports?.defaultType,
                        onChange: (e) => handleSettingChange(
                            'reports.defaultType',
                            e.target.value
                        ),
                        className: 'rounded-md border bg-background px-3 py-1'
                    }, [
                        h('option', { value: 'weekly' }, 
                            translationManager.translate('weekly')
                        ),
                        h('option', { value: 'monthly' }, 
                            translationManager.translate('monthly')
                        )
                    ])
                }),

                // Default date range
                h(SettingItem, {
                    label: translationManager.translate('defaultDateRange'),
                    control: h('select', {
                        id: 'defaultDateRange',
                        value: formValues.reports?.defaultDateRange,
                        onChange: (e) => handleSettingChange(
                            'reports.defaultDateRange',
                            e.target.value
                        ),
                        className: 'rounded-md border bg-background px-3 py-1'
                    }, [
                        h('option', { value: 'thisWeek' }, 
                            translationManager.translate('thisWeek')
                        ),
                        h('option', { value: 'thisMonth' }, 
                            translationManager.translate('thisMonth')
                        ),
                        h('option', { value: 'lastWeek' }, 
                            translationManager.translate('lastWeek')
                        ),
                        h('option', { value: 'lastMonth' }, 
                            translationManager.translate('lastMonth')
                        )
                    ])
                }),

                // Include inactive projects
                h(SettingItem, {
                    label: translationManager.translate('includeInactiveProjects'),
                    control: h('label', {
                        className: 'relative inline-flex items-center cursor-pointer'
                    }, [
                        h('input', {
                            type: 'checkbox',
                            id: 'includeInactiveProjects',
                            checked: formValues.reports?.includeInactiveProjects,
                            onChange: (e) => handleSettingChange(
                                'reports.includeInactiveProjects',
                                e.target.checked
                            ),
                            className: 'sr-only peer'
                        }),
                        h('div', {
                            className: `
                                w-11 h-6 bg-muted
                                peer-focus:outline-none peer-focus:ring-2
                                peer-focus:ring-primary
                                rounded-full peer
                                peer-checked:after:translate-x-full
                                peer-checked:bg-primary
                                after:content-['']
                                after:absolute after:top-[2px] after:left-[2px]
                                after:bg-background
                                after:rounded-full after:h-5 after:w-5
                                after:transition-all
                            `
                        })
                    ])
                }),

                // Default columns multiselect
                h(SettingItem, {
                    label: translationManager.translate('defaultColumns'),
                    control: h('div', { className: 'space-y-2' }, [
                        ['period', 'project', 'description', 'timeSpent', 'totalTime']
                            .map(column => h('label', {
                                key: column,
                                className: 'flex items-center gap-2'
                            }, [
                                h('input', {
                                    type: 'checkbox',
                                    checked: formValues.reports?.defaultColumns?.includes(column),
                                    onChange: (e) => {
                                        const current = formValues.reports?.defaultColumns || [];
                                        const updated = e.target.checked
                                            ? [...current, column]
                                            : current.filter(c => c !== column);
                                        handleSettingChange('reports.defaultColumns', updated);
                                    },
                                    className: 'rounded border-gray-300'
                                }),
                                translationManager.translate(column)
                            ]))
                    ])
                })
            ])
        }
    ];

    return h('div', {
        className: `space-y-6 ${className}`
    }, [
        // Header with save/reset buttons
        h('header', {
            className: 'flex justify-between items-center'
        }, [
            h('h2', { 
                className: 'text-2xl font-semibold'
            }, translationManager.translate('settings')),
            h('div', { className: 'space-x-2' }, [
                // Save button
                h('button', {
                    onClick: handleSave,
                    disabled: !unsavedChanges || loading,
                    className: `
                        inline-flex items-center gap-2 px-4 py-2
                        bg-primary text-primary-foreground rounded-md
                        hover:bg-primary/90 disabled:opacity-50
                    `
                }, [
                    loading ? h(Loader, { 
                        size: 16,
                        className: 'animate-spin'
                    }) : h(Save, { size: 16 }),
                    translationManager.translate('save')
                ]),

                // Reset button
                h('button', {
                    onClick: () => handleReset(),
                    disabled: loading,
                    className: `
                        inline-flex items-center gap-2 px-4 py-2
                        bg-destructive text-destructive-foreground rounded-md
                        hover:bg-destructive/90 disabled:opacity-50
                    `
                }, [
                    h(Reset, { size: 16 }),
                    translationManager.translate('reset')
                ])
            ])
        ]),

        // Error message
        error && h('div', {
            className: 'bg-destructive/10 text-destructive rounded-lg p-4 flex items-center gap-2',
            role: 'alert'
        }, [
            h(AlertCircle, { size: 16 }),
            h('span', {}, error)
        ]),

        // Main content
        h('div', {
            className: 'grid grid-cols-[200px_1fr] gap-6'
        }, [
            // Navigation sidebar
            h('nav', {
                className: 'space-y-1',
                'aria-label': translationManager.translate('settingsNavigation')
            }, sections.map(section =>
                h('button', {
                    key: section.id,
                    onClick: () => setCurrentSection(section.id),
                    className: `
                        w-full flex items-center gap-2 px-3 py-2 rounded-md
                        transition-colors duration-200
                        ${currentSection === section.id ?
                            'bg-primary text-primary-foreground' :
                            'hover:bg-muted'
                        }
                    `,
                    'aria-current': currentSection === section.id ? 'page' : undefined
                }, [
                    h(section.icon, { size: 16 }),
                    h('span', {}, section.label),
                    h(ChevronRight, { 
                        size: 16,
                        className: 'ml-auto opacity-50'
                    })
                ])
            )),

            // Settings content
            h('div', { 
                className: 'space-y-6',
                role: 'region',
                'aria-label': sections.find(s => s.id === currentSection)?.label
            }, [
                // Current section content
                sections.find(s => s.id === currentSection)?.render(),

                // Import/Export section (always visible at bottom)
                h(SettingSection, {
                    title: translationManager.translate('importExport'),
                    description: translationManager.translate('importExportDescription'),
                    className: 'border-t pt-6 mt-6'
                }, [
                    h('div', { 
                        className: 'flex flex-col gap-4 sm:flex-row sm:gap-6' 
                    }, [
                        // Export button
                        h('button', {
                            onClick: handleExport,
                            disabled: loading,
                            className: `
                                flex items-center gap-2 px-4 py-2
                                bg-secondary text-secondary-foreground rounded-md
                                hover:bg-secondary/90 disabled:opacity-50
                            `
                        }, [
                            h(Download, { size: 16 }),
                            translationManager.translate('exportSettings')
                        ]),

                        // Import button group
                        h('div', { className: 'relative' }, [
                            h('input', {
                                type: 'file',
                                id: 'importFile',
                                accept: '.json',
                                onChange: handleImport,
                                className: 'hidden'
                            }),
                            h('label', {
                                htmlFor: 'importFile',
                                className: `
                                    flex items-center gap-2 px-4 py-2 cursor-pointer
                                    bg-secondary text-secondary-foreground rounded-md
                                    hover:bg-secondary/90 disabled:opacity-50
                                    ${importing ? 'opacity-50 cursor-not-allowed' : ''}
                                `
                            }, [
                                importing ? 
                                    h(Loader, { 
                                        size: 16,
                                        className: 'animate-spin'
                                    }) : 
                                    h(Upload, { size: 16 }),
                                translationManager.translate('importSettings')
                            ])
                        ])
                    ]),

                    // Backup management
                    h('div', { 
                        className: 'mt-6 space-y-4' 
                    }, [
                        h('div', { 
                            className: 'flex justify-between items-center' 
                        }, [
                            h('h4', { 
                                className: 'text-sm font-medium' 
                            }, translationManager.translate('backups')),
                            h('button', {
                                onClick: () => settingsFeature.createBackup(),
                                disabled: loading,
                                className: `
                                    flex items-center gap-2 px-3 py-1 text-sm
                                    bg-secondary text-secondary-foreground rounded-md
                                    hover:bg-secondary/90 disabled:opacity-50
                                `
                            }, [
                                h(Database, { size: 14 }),
                                translationManager.translate('createBackup')
                            ])
                        ]),

                        // Backup list
                        h('div', { 
                            className: 'space-y-2 max-h-48 overflow-y-auto' 
                        }, Object.entries(settingsFeature.getBackups())
                            .sort(([a], [b]) => b.localeCompare(a))
                            .map(([timestamp, backup]) =>
                                h('div', {
                                    key: timestamp,
                                    className: 'flex items-center justify-between p-2 rounded-md bg-muted/50'
                                }, [
                                    h('div', { className: 'space-y-1' }, [
                                        h('div', { 
                                            className: 'text-sm' 
                                        }, new Date(timestamp).toLocaleString()),
                                        h('div', { 
                                            className: 'text-xs text-muted-foreground' 
                                        }, backup.metadata.version)
                                    ]),
                                    h('div', { className: 'space-x-2' }, [
                                        h('button', {
                                            onClick: () => settingsFeature.restoreBackup(timestamp),
                                            className: 'text-primary hover:underline text-sm'
                                        }, translationManager.translate('restore'))
                                    ])
                                ])
                            )
                        )
                    ])
                ])
            ])
        ]),

        // Unsaved changes warning
        unsavedChanges && h('div', {
            className: `
                fixed bottom-4 right-4 
                flex items-center gap-3 p-4 
                bg-card border shadow-lg rounded-lg
            `,
            role: 'alert'
        }, [
            h(AlertCircle, { 
                size: 16,
                className: 'text-warning'
            }),
            h('span', {}, translationManager.translate('unsavedChanges')),
            h('div', { className: 'space-x-2' }, [
                h('button', {
                    onClick: handleSave,
                    disabled: loading,
                    className: `
                        px-3 py-1 text-sm
                        bg-primary text-primary-foreground rounded-md
                        hover:bg-primary/90 disabled:opacity-50
                    `
                }, translationManager.translate('save')),
                h('button', {
                    onClick: () => setFormValues(settings),
                    className: 'px-3 py-1 text-sm hover:underline'
                }, translationManager.translate('revert'))
            ])
        ])
    ]);
};

export default Settings;
