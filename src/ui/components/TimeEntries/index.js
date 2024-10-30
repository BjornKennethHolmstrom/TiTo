// src/ui/components/TimeEntries/index.js
import { createElement as h } from 'react';
import { useState, useEffect, useRef } from 'react';
import { 
    Trash2, 
    Plus, 
    Calendar, 
    Clock, 
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ArrowUpDown
} from 'lucide-react';

export const TimeEntries = ({
    timeEntriesFeature,
    stateManager,
    translationManager,
    className = ''
}) => {
    // Local state
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddEntry, setShowAddEntry] = useState(false);
    const editFormRef = useRef(null);

    // Subscribe to state
    const [entries, setEntries] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [sortOrder, setSortOrder] = useState('newest');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const unsubscribers = [
            stateManager.subscribe('timeEntries.filteredItems', entries => {
                const currentPageEntries = timeEntriesFeature.getCurrentPageEntries();
                setEntries(currentPageEntries);
            }),
            stateManager.subscribe('timeEntries.currentPage', setCurrentPage),
            stateManager.subscribe('timeEntries.totalPages', setTotalPages),
            stateManager.subscribe('timeEntries.entriesPerPage', setEntriesPerPage),
            stateManager.subscribe('timeEntries.sortOrder', setSortOrder),
            stateManager.subscribe('timeEntries.loading', setLoading),
            stateManager.subscribe('timeEntries.error', setError)
        ];

        return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    }, [stateManager, timeEntriesFeature]);

    // Add new time entry
    const handleAddEntry = async (formData) => {
        try {
            await timeEntriesFeature.addEntry({
                start: new Date(formData.get('start')),
                end: new Date(formData.get('end')),
                description: formData.get('description') || ''
            });
            setShowAddEntry(false);
        } catch (error) {
            console.error('Error adding time entry:', error);
        }
    };

    // Update time entry
    const handleUpdateEntry = async (entryId, formData) => {
        try {
            await timeEntriesFeature.updateEntry(entryId, {
                start: new Date(formData.get('start')),
                end: new Date(formData.get('end')),
                description: formData.get('description')
            });
            setEditingId(null);
        } catch (error) {
            console.error('Error updating time entry:', error);
        }
    };

    // Delete time entry
    const handleDeleteEntry = async (entryId) => {
        try {
            await timeEntriesFeature.deleteEntry(entryId);
        } catch (error) {
            console.error('Error deleting time entry:', error);
        }
    };

    // Pagination handlers
    const handlePageChange = (page) => {
        timeEntriesFeature.setPage(page);
    };

    const handleEntriesPerPageChange = (e) => {
        const value = parseInt(e.target.value);
        if (value > 0) {
            timeEntriesFeature.setEntriesPerPage(value);
        }
    };

    // Sort order handler
    const handleSortOrderChange = () => {
        const newOrder = sortOrder === 'newest' ? 'oldest' : 'newest';
        timeEntriesFeature.setSortOrder(newOrder);
    };

    // Search handler
    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        timeEntriesFeature.setDescriptionFilter(term);
    };

    const TimeEntryForm = ({ entry = null, onSubmit }) => {
        const now = new Date();
        const formattedNow = now.toISOString().slice(0, 16); // YYYY-MM-DDThh:mm

        return h('form', {
            ref: editFormRef,
            onSubmit: (e) => {
                e.preventDefault();
                onSubmit(new FormData(e.target));
            },
            className: 'space-y-4 p-4 bg-muted/50 rounded-lg'
        }, [
            // Date and time inputs
            h('div', { className: 'grid grid-cols-2 gap-4' }, [
                h('div', { className: 'space-y-2' }, [
                    h('label', { 
                        className: 'block text-sm font-medium',
                        htmlFor: 'start'
                    }, translationManager.translate('start')),
                    h('input', {
                        type: 'datetime-local',
                        id: 'start',
                        name: 'start',
                        defaultValue: entry?.start?.slice(0, 16) || formattedNow,
                        className: 'w-full rounded-md border bg-background px-3 py-2'
                    })
                ]),
                h('div', { className: 'space-y-2' }, [
                    h('label', { 
                        className: 'block text-sm font-medium',
                        htmlFor: 'end'
                    }, translationManager.translate('end')),
                    h('input', {
                        type: 'datetime-local',
                        id: 'end',
                        name: 'end',
                        defaultValue: entry?.end?.slice(0, 16) || formattedNow,
                        className: 'w-full rounded-md border bg-background px-3 py-2'
                    })
                ])
            ]),

            // Description input
            h('div', { className: 'space-y-2' }, [
                h('label', { 
                    className: 'block text-sm font-medium',
                    htmlFor: 'description'
                }, translationManager.translate('description')),
                h('input', {
                    type: 'text',
                    id: 'description',
                    name: 'description',
                    defaultValue: entry?.description || '',
                    placeholder: translationManager.translate('enterDescription'),
                    className: 'w-full rounded-md border bg-background px-3 py-2'
                })
            ]),

            // Form buttons
            h('div', { className: 'flex justify-end gap-2' }, [
                h('button', {
                    type: 'button',
                    onClick: () => {
                        setEditingId(null);
                        setShowAddEntry(false);
                    },
                    className: 'px-3 py-2 text-sm rounded-md hover:bg-muted'
                }, translationManager.translate('cancel')),
                h('button', {
                    type: 'submit',
                    className: 'px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90'
                }, entry ? translationManager.translate('update') : translationManager.translate('add'))
            ])
        ]);
    };

    return h('div', { className: `flex flex-col h-full ${className}` }, [
        // Header controls
        h('div', { className: 'flex items-center justify-between gap-4 mb-4 p-2' }, [
            // Search input
            h('div', { className: 'flex-1' }, [
                h('div', { className: 'relative' }, [
                    h(Search, {
                        size: 16,
                        className: 'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'
                    }),
                    h('input', {
                        type: 'text',
                        value: searchTerm,
                        onChange: handleSearch,
                        placeholder: translationManager.translate('searchEntries'),
                        className: 'w-full pl-9 pr-3 py-2 rounded-md border bg-background'
                    })
                ])
            ]),

            // Sort and add buttons
            h('div', { className: 'flex items-center gap-2' }, [
                h('button', {
                    onClick: handleSortOrderChange,
                    className: 'p-2 hover:bg-muted rounded-md inline-flex items-center gap-2'
                }, [
                    h(ArrowUpDown, { size: 16 }),
                    sortOrder === 'newest' ? 
                        translationManager.translate('sortNewest') :
                        translationManager.translate('sortOldest')
                ]),
                h('button', {
                    onClick: () => setShowAddEntry(true),
                    className: 'p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 inline-flex items-center gap-2'
                }, [
                    h(Plus, { size: 16 }),
                    translationManager.translate('addEntry')
                ])
            ])
        ]),

        // Add entry form
        showAddEntry && h(TimeEntryForm, {
            onSubmit: handleAddEntry
        }),

        // Time entries list
        h('div', { 
            className: 'flex-1 overflow-y-auto min-h-0',
            'aria-label': translationManager.translate('timeEntriesList')
        }, [
            loading ? h('div', { 
                className: 'flex items-center justify-center h-full' 
            }, translationManager.translate('loading')) :
            
            error ? h('div', { 
                className: 'text-destructive p-4 text-center' 
            }, error) :
            
            entries.length === 0 ? h('div', { 
                className: 'text-muted-foreground p-4 text-center' 
            }, translationManager.translate('noTimeEntries')) :
            
            h('ul', { className: 'space-y-2 p-2' }, entries.map(entry => 
                h('li', {
                    key: entry.id,
                    className: `
                        relative group p-4 rounded-lg
                        ${editingId === entry.id ? 'bg-muted' : 'hover:bg-muted/50'}
                    `
                }, 
                    editingId === entry.id ?
                        h(TimeEntryForm, {
                            entry,
                            onSubmit: (formData) => handleUpdateEntry(entry.id, formData)
                        }) :
                        [
                            h('div', { className: 'flex items-center justify-between gap-4' }, [
                                h('div', { className: 'space-y-1' }, [
                                    h('div', { className: 'flex items-center gap-2 text-sm' }, [
                                        h(Calendar, { size: 16 }),
                                        new Date(entry.start).toLocaleDateString(),
                                        h(Clock, { size: 16, className: 'ml-2' }),
                                        `${new Date(entry.start).toLocaleTimeString()} - ${new Date(entry.end).toLocaleTimeString()}`
                                    ]),
                                    entry.description && h('p', { 
                                        className: 'text-muted-foreground' 
                                    }, entry.description)
                                ]),
                                h('div', { 
                                    className: `
                                        flex items-center gap-2
                                        opacity-0 group-hover:opacity-100
                                        transition-opacity duration-200
                                    `
                                }, [
                                    h('button', {
                                        onClick: () => setEditingId(entry.id),
                                        className: 'p-1 hover:bg-muted rounded',
                                        'aria-label': translationManager.translate('editEntry')
                                    }, translationManager.translate('edit')),
                                    h('button', {
                                        onClick: () => handleDeleteEntry(entry.id),
                                        className: 'p-1 hover:bg-destructive/10 text-destructive rounded',
                                        'aria-label': translationManager.translate('deleteEntry')
                                    }, [
                                        h(Trash2, { size: 16 })
                                    ])
                                ])
                            ])
                        ]
                )
            ))
        ]),

        // Pagination controls
        h('div', { 
            className: 'flex items-center justify-between gap-4 mt-4 p-2',
            'aria-label': translationManager.translate('paginationControls')
        }, [
            // Entries per page selector
            h('div', { className: 'flex items-center gap-2' }, [
                h('span', { className: 'text-sm' }, 
                    translationManager.translate('entriesPerPage')
                ),
                h('select', {
                    value: entriesPerPage,
                    onChange: handleEntriesPerPageChange,
                    className: 'rounded-md border bg-background px-2 py-1'
                }, [5, 10, 20, 30, 50].map(value =>
                    h('option', { key: value, value }, value)
                ))
            ]),

            // Page navigation
            h('div', { className: 'flex items-center gap-2' }, [
                // First page button
                h('button', {
                    onClick: () => handlePageChange(1),
                    disabled: currentPage === 1,
                    className: 'p-1 hover:bg-muted rounded disabled:opacity-50',
                    'aria-label': translationManager.translate('firstPage')
                }, [
                    h(ChevronsLeft, { size: 16 })
                ]),

                // Previous page button
                h('button', {
                    onClick: () => handlePageChange(currentPage - 1),
                    disabled: currentPage === 1,
                    className: 'p-1 hover:bg-muted rounded disabled:opacity-50',
                    'aria-label': translationManager.translate('previousPage')
                }, [
                    h(ChevronLeft, { size: 16 })
                ]),

                // Page number input/display
                h('div', { className: 'flex items-center gap-1' }, [
                    h('input', {
                        type: 'number',
                        min: 1,
                        max: totalPages,
                        value: currentPage,
                        onChange: (e) => {
                            const page = parseInt(e.target.value);
                            if (page >= 1 && page <= totalPages) {
                                handlePageChange(page);
                            }
                        },
                        className: 'w-12 text-center rounded-md border bg-background px-1 py-1'
                    }),
                    h('span', { className: 'text-sm text-muted-foreground' },
                        `/ ${totalPages}`
                    )
                ]),

                // Next page button
                h('button', {
                    onClick: () => handlePageChange(currentPage + 1),
                    disabled: currentPage === totalPages,
                    className: 'p-1 hover:bg-muted rounded disabled:opacity-50',
                    'aria-label': translationManager.translate('nextPage')
                }, [
                    h(ChevronRight, { size: 16 })
                ]),

                // Last page button
                h('button', {
                    onClick: () => handlePageChange(totalPages),
                    disabled: currentPage === totalPages,
                    className: 'p-1 hover:bg-muted rounded disabled:opacity-50',
                    'aria-label': translationManager.translate('lastPage')
                }, [
                    h(ChevronsRight, { size: 16 })
                ])
            ])
        ]),

        // Statistics summary
        h('div', { 
            className: 'mt-4 p-2 bg-muted/50 rounded-lg text-sm',
            role: 'status',
            'aria-label': translationManager.translate('statisticsSummary')
        }, [
            h('div', { className: 'flex justify-between items-center' }, [
                h('span', {}, [
                    translationManager.translate('totalEntries'),
                    ': ',
                    entries.length
                ]),
                h('span', {}, [
                    translationManager.translate('totalTime'),
                    ': ',
                    timeEntriesFeature.getStatistics().totalDuration
                ])
            ])
        ])
    ]);
};
