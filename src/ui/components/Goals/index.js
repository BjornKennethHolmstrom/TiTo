// src/ui/components/Goals/index.js
import { createElement as h } from 'react';
import { useState, useEffect } from 'react';
import { 
    Target,
    Calendar,
    Clock,
    AlertCircle,
    X,
    CheckCircle2,
    Bell,
    Settings,
    Loader
} from 'lucide-react';

// Progress bar component
const ProgressBar = ({ progress, className = '' }) => {
    const percentage = Math.min(Math.max(progress, 0), 100);
    
    return h('div', {
        className: `h-2 bg-muted rounded-full overflow-hidden ${className}`,
        role: 'progressbar',
        'aria-valuenow': percentage,
        'aria-valuemin': 0,
        'aria-valuemax': 100
    }, [
        h('div', {
            className: `h-full transition-all duration-500 
                ${percentage < 90 ? 'bg-primary' : percentage < 100 ? 'bg-warning' : 'bg-success'}`,
            style: { width: `${percentage}%` }
        })
    ]);
};

// Goal card component
const GoalCard = ({ 
    title, 
    hours, 
    period, 
    progress, 
    onRemove,
    className = '' 
}) => {
    return h('div', {
        className: `
            relative bg-card rounded-lg p-4 shadow-sm
            hover:shadow-md transition-shadow
            ${className}
        `
    }, [
        // Header
        h('div', { className: 'flex justify-between items-start mb-3' }, [
            h('h3', { className: 'font-medium' }, title),
            h('button', {
                onClick: onRemove,
                className: 'text-muted-foreground hover:text-destructive',
                'aria-label': 'Remove goal'
            }, [
                h(X, { size: 16 })
            ])
        ]),

        // Goal details
        h('div', { className: 'space-y-3' }, [
            h('div', { className: 'flex items-center gap-2 text-sm text-muted-foreground' }, [
                h(Target, { size: 16 }),
                `${hours} hours ${period}`
            ]),

            // Progress
            h('div', { className: 'space-y-1' }, [
                h('div', { className: 'flex justify-between text-sm' }, [
                    h('span', {}, 'Progress'),
                    h('span', { 
                        className: progress >= 100 ? 'text-success' : 
                                 progress >= 90 ? 'text-warning' : ''
                    }, `${Math.round(progress)}%`)
                ]),
                h(ProgressBar, { progress })
            ])
        ])
    ]);
};

// Notification component
const Notification = ({ notification, onRemove }) => {
    return h('div', {
        className: `
            flex items-center gap-3 p-3 rounded-lg shadow-lg
            ${notification.type === 'success' ? 'bg-success/10 text-success' :
              notification.type === 'warning' ? 'bg-warning/10 text-warning' :
              'bg-muted'}
        `,
        role: 'alert'
    }, [
        notification.type === 'success' ? h(CheckCircle2, { size: 16 }) :
        notification.type === 'warning' ? h(Bell, { size: 16 }) :
        h(AlertCircle, { size: 16 }),
        h('span', { className: 'flex-1' }, notification.message),
        h('button', {
            onClick: () => onRemove(notification.id),
            className: 'opacity-70 hover:opacity-100',
            'aria-label': 'Dismiss notification'
        }, [
            h(X, { size: 16 })
        ])
    ]);
};

// Main Goals component
export const Goals = ({
    goalsFeature,
    stateManager,
    translationManager,
    className = ''
}) => {
    // Local state for forms
    const [showAddProjectGoal, setShowAddProjectGoal] = useState(false);
    const [showAddOverallGoal, setShowAddOverallGoal] = useState(false);
    const [newProjectGoal, setNewProjectGoal] = useState({
        projectId: '',
        hours: '',
        period: 'weekly'
    });
    const [newOverallGoal, setNewOverallGoal] = useState({
        hours: '',
        period: 'weekly'
    });

    // State subscriptions
    const [enabled, setEnabled] = useState(false);
    const [projectGoals, setProjectGoals] = useState([]);
    const [overallGoal, setOverallGoal] = useState(null);
    const [progress, setProgress] = useState({ byProject: {}, overall: 0 });
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        const unsubscribers = [
            stateManager.subscribe('goals.enabled', setEnabled),
            stateManager.subscribe('goals.items', setProjectGoals),
            stateManager.subscribe('goals.overall', setOverallGoal),
            stateManager.subscribe('goals.progress', setProgress),
            stateManager.subscribe('goals.notifications', setNotifications),
            stateManager.subscribe('goals.loading', setLoading),
            stateManager.subscribe('goals.error', setError),
            stateManager.subscribe('projects.items', setProjects)
        ];

        return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    }, [stateManager]);

    // Toggle goals feature
    const toggleGoals = () => {
        stateManager.update('goals.enabled', !enabled);
    };

    // Handle project goal submission
    const handleAddProjectGoal = async (e) => {
        e.preventDefault();
        try {
            await goalsFeature.setProjectGoal(
                parseInt(newProjectGoal.projectId),
                parseFloat(newProjectGoal.hours),
                newProjectGoal.period
            );
            setShowAddProjectGoal(false);
            setNewProjectGoal({
                projectId: '',
                hours: '',
                period: 'weekly'
            });
        } catch (error) {
            console.error('Error adding project goal:', error);
        }
    };

    // Handle overall goal submission
    const handleAddOverallGoal = async (e) => {
        e.preventDefault();
        try {
            await goalsFeature.setOverallGoal(
                parseFloat(newOverallGoal.hours),
                newOverallGoal.period
            );
            setShowAddOverallGoal(false);
            setNewOverallGoal({
                hours: '',
                period: 'weekly'
            });
        } catch (error) {
            console.error('Error adding overall goal:', error);
        }
    };

    // Goal removal handlers
    const handleRemoveProjectGoal = async (projectId) => {
        try {
            await goalsFeature.removeProjectGoal(projectId);
        } catch (error) {
            console.error('Error removing project goal:', error);
        }
    };

    const handleRemoveOverallGoal = async () => {
        try {
            await goalsFeature.removeOverallGoal();
        } catch (error) {
            console.error('Error removing overall goal:', error);
        }
    };

    return h('div', { className: `space-y-6 ${className}` }, [
        // Header with toggle
        h('div', { className: 'flex justify-between items-center' }, [
            h('h2', { className: 'text-lg font-semibold flex items-center gap-2' }, [
                h(Target, { size: 20 }),
                translationManager.translate('timeGoals')
            ]),
            h('button', {
                onClick: toggleGoals,
                className: `
                    flex items-center gap-2 px-3 py-1.5 rounded-full
                    ${enabled ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                    transition-colors
                `,
                'aria-pressed': enabled
            }, [
                h(Settings, { size: 16 }),
                enabled ? 
                    translationManager.translate('goalsEnabled') :
                    translationManager.translate('goalsDisabled')
            ])
        ]),

        // Error message
        error && h('div', {
            className: 'bg-destructive/10 text-destructive rounded-lg p-4 flex items-center gap-2'
        }, [
            h(AlertCircle, { size: 16 }),
            h('span', {}, error)
        ]),

        // Goals content (only shown when enabled)
        enabled && h('div', { className: 'space-y-6' }, [
            // Overall goal section
            h('section', { className: 'space-y-4' }, [
                h('div', { className: 'flex justify-between items-center' }, [
                    h('h3', { className: 'font-medium' },
                        translationManager.translate('overallGoal')
                    ),
                    !overallGoal && h('button', {
                        onClick: () => setShowAddOverallGoal(true),
                        className: 'text-sm text-primary hover:underline'
                    }, translationManager.translate('setOverallGoal'))
                ]),

                // Overall goal form
                showAddOverallGoal && h('form', {
                    onSubmit: handleAddOverallGoal,
                    className: 'space-y-4 p-4 bg-muted/50 rounded-lg'
                }, [
                    // Hours input
                    h('div', { className: 'space-y-2' }, [
                        h('label', { 
                            className: 'block text-sm font-medium',
                            htmlFor: 'overallHours'
                        }, translationManager.translate('targetHours')),
                        h('input', {
                            id: 'overallHours',
                            type: 'number',
                            min: 0,
                            step: 0.5,
                            value: newOverallGoal.hours,
                            onChange: (e) => setNewOverallGoal({
                                ...newOverallGoal,
                                hours: e.target.value
                            }),
                            className: 'w-full rounded-md border bg-background px-3 py-2'
                        })
                    ]),

                    // Period selection
                    h('div', { className: 'space-y-2' }, [
                        h('label', {
                            className: 'block text-sm font-medium',
                            htmlFor: 'overallPeriod'
                        }, translationManager.translate('period')),
                        h('select', {
                            id: 'overallPeriod',
                            value: newOverallGoal.period,
                            onChange: (e) => setNewOverallGoal({
                                ...newOverallGoal,
                                period: e.target.value
                            }),
                            className: 'w-full rounded-md border bg-background px-3 py-2'
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
                    ]),

                    // Form buttons
                    h('div', { className: 'flex justify-end gap-2' }, [
                        h('button', {
                            type: 'button',
                            onClick: () => setShowAddOverallGoal(false),
                            className: 'px-3 py-2 text-sm rounded-md hover:bg-muted'
                        }, translationManager.translate('cancel')),
                        h('button', {
                            type: 'submit',
                            disabled: loading,
                            className: `
                                px-3 py-2 text-sm bg-primary text-primary-foreground 
                                rounded-md hover:bg-primary/90 
                                disabled:opacity-50
                            `
                        }, translationManager.translate('set'))
                    ])
                ]),

                // Overall goal display
                overallGoal && h(GoalCard, {
                    title: translationManager.translate('overallGoal'),
                    hours: overallGoal.hours,
                    period: translationManager.translate(overallGoal.period),
                    progress: progress.overall,
                    onRemove: handleRemoveOverallGoal
                })
            ]),

            // Project goals section
            h('section', { className: 'space-y-4' }, [
                h('div', { className: 'flex justify-between items-center' }, [
                    h('h3', { className: 'font-medium' },
                        translationManager.translate('projectGoals')
                    ),
                    h('button', {
                        onClick: () => setShowAddProjectGoal(true),
                        className: 'text-sm text-primary hover:underline',
                        'aria-label': translationManager.translate('addProjectGoal')
                    }, translationManager.translate('addProjectGoal'))
                ]),

                // Project goal form
                showAddProjectGoal && h('form', {
                    onSubmit: handleAddProjectGoal,
                    className: 'space-y-4 p-4 bg-muted/50 rounded-lg'
                }, [
                    // Project selection
                    h('div', { className: 'space-y-2' }, [
                        h('label', {
                            className: 'block text-sm font-medium',
                            htmlFor: 'projectSelect'
                        }, translationManager.translate('selectProject')),
                        h('select', {
                            id: 'projectSelect',
                            value: newProjectGoal.projectId,
                            onChange: (e) => setNewProjectGoal({
                                ...newProjectGoal,
                                projectId: e.target.value
                            }),
                            className: 'w-full rounded-md border bg-background px-3 py-2',
                            required: true
                        }, [
                            h('option', { value: '' }, 
                                translationManager.translate('selectProject')
                            ),
                            ...projects.map(project =>
                                h('option', { 
                                    key: project.id,
                                    value: project.id
                                }, project.name)
                            )
                        ])
                    ]),

                    // Hours input
                    h('div', { className: 'space-y-2' }, [
                        h('label', {
                            className: 'block text-sm font-medium',
                            htmlFor: 'projectHours'
                        }, translationManager.translate('targetHours')),
                        h('input', {
                            id: 'projectHours',
                            type: 'number',
                            min: 0,
                            step: 0.5,
                            value: newProjectGoal.hours,
                            onChange: (e) => setNewProjectGoal({
                                ...newProjectGoal,
                                hours: e.target.value
                            }),
                            className: 'w-full rounded-md border bg-background px-3 py-2',
                            required: true
                        })
                    ]),

                    // Period selection
                    h('div', { className: 'space-y-2' }, [
                        h('label', {
                            className: 'block text-sm font-medium',
                            htmlFor: 'projectPeriod'
                        }, translationManager.translate('period')),
                        h('select', {
                            id: 'projectPeriod',
                            value: newProjectGoal.period,
                            onChange: (e) => setNewProjectGoal({
                                ...newProjectGoal,
                                period: e.target.value
                            }),
                            className: 'w-full rounded-md border bg-background px-3 py-2'
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
                    ]),

                    // Form buttons
                    h('div', { className: 'flex justify-end gap-2' }, [
                        h('button', {
                            type: 'button',
                            onClick: () => setShowAddProjectGoal(false),
                            className: 'px-3 py-2 text-sm rounded-md hover:bg-muted'
                        }, translationManager.translate('cancel')),
                        h('button', {
                            type: 'submit',
                            disabled: loading,
                            className: `
                                px-3 py-2 text-sm bg-primary text-primary-foreground 
                                rounded-md hover:bg-primary/90 
                                disabled:opacity-50
                                inline-flex items-center gap-2
                            `
                        }, [
                            loading && h(Loader, { 
                                size: 16,
                                className: 'animate-spin'
                            }),
                            translationManager.translate('add')
                        ])
                    ])
                ]),

                // Project goals grid
                h('div', { 
                    className: 'grid grid-cols-1 md:grid-cols-2 gap-4',
                    role: 'list',
                    'aria-label': translationManager.translate('projectGoals')
                }, projectGoals.map(goal => {
                    const project = projects.find(p => p.id === goal.projectId);
                    return h(GoalCard, {
                        key: goal.projectId,
                        title: project?.name || translationManager.translate('unknownProject'),
                        hours: goal.hours,
                        period: translationManager.translate(goal.period),
                        progress: progress.byProject[goal.projectId] || 0,
                        onRemove: () => handleRemoveProjectGoal(goal.projectId)
                    });
                }))
            ]),

            // Notifications
            notifications.length > 0 && h('div', {
                className: 'fixed bottom-4 right-4 flex flex-col gap-2 max-w-md z-50',
                role: 'log',
                'aria-label': translationManager.translate('notifications')
            }, notifications.map(notification =>
                h(Notification, {
                    key: notification.id,
                    notification,
                    onRemove: (id) => goalsFeature.removeNotification(id)
                })
            ))
        ])
    ]);
};

export default Goals;
