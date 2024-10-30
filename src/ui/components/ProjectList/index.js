// src/ui/components/ProjectList/index.js
import { createElement as h } from 'react';
import { useState, useEffect, useRef } from 'react';
import { Trash2, Edit2, MoreVertical, Plus } from 'lucide-react';

export const ProjectList = ({ 
    projectsFeature, 
    stateManager, 
    translationManager,
    className = '' 
}) => {
    const [draggedItem, setDraggedItem] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [newProjectName, setNewProjectName] = useState('');
    const editInputRef = useRef(null);

    // State subscriptions
    const [projects, setProjects] = useState([]);
    const [currentProjectId, setCurrentProjectId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Subscribe to state changes
        const unsubscribers = [
            stateManager.subscribe('projects.items', setProjects),
            stateManager.subscribe('projects.currentProjectId', setCurrentProjectId),
            stateManager.subscribe('projects.loading', setLoading),
            stateManager.subscribe('projects.error', setError)
        ];

        // Cleanup subscriptions
        return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    }, [stateManager]);

    // Handle new project creation
    const handleAddProject = async (e) => {
        e.preventDefault();
        if (!newProjectName.trim()) {
            return;
        }

        try {
            await projectsFeature.addProject(newProjectName);
            setNewProjectName('');
        } catch (error) {
            console.error('Error adding project:', error);
        }
    };

    // Handle project selection
    const handleProjectClick = (projectId) => {
        if (editingId === projectId) {
            return;
        }
        projectsFeature.setCurrentProject(projectId);
    };

    // Handle project editing
    const startEditing = (projectId, initialName) => {
        setEditingId(projectId);
        setNewProjectName(initialName);
        // Focus the input after render
        setTimeout(() => editInputRef.current?.focus(), 0);
    };

    const handleEditSubmit = async (projectId) => {
        if (!newProjectName.trim()) {
            return;
        }

        try {
            await projectsFeature.updateProject(projectId, { name: newProjectName });
            setEditingId(null);
            setNewProjectName('');
        } catch (error) {
            console.error('Error updating project:', error);
        }
    };

    // Handle project deletion
    const handleDeleteProject = async (projectId, e) => {
        e.stopPropagation();
        try {
            await projectsFeature.deleteProject(projectId);
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    };

    // Drag and drop handlers
    const handleDragStart = (e, index) => {
        setDraggedItem(index);
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('opacity-50');
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedItem === null) return;

        const items = [...projects];
        const draggedProject = items[draggedItem];
        items.splice(draggedItem, 1);
        items.splice(index, 0, draggedProject);

        projectsFeature.reorderProjects(draggedItem, index);
        setDraggedItem(index);
    };

    const handleDragEnd = (e) => {
        e.target.classList.remove('opacity-50');
        setDraggedItem(null);
    };

    return h('div', { className: `flex flex-col h-full ${className}` }, [
        // Add project form
        h('form', { 
            className: 'flex gap-2 mb-4 p-2',
            onSubmit: handleAddProject 
        }, [
            h('input', {
                type: 'text',
                value: newProjectName,
                onChange: (e) => setNewProjectName(e.target.value),
                placeholder: translationManager.translate('enterProjectName'),
                className: 'flex-1 px-3 py-2 border rounded-lg bg-background text-foreground'
            }),
            h('button', {
                type: 'submit',
                disabled: loading,
                className: 'p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50'
            }, [
                h(Plus, { size: 20 })
            ])
        ]),

        // Project list
        h('div', { 
            className: 'flex-1 overflow-y-auto min-h-0',
            'aria-label': translationManager.translate('projectsList')
        }, [
            loading ? h('div', { 
                className: 'flex items-center justify-center h-full' 
            }, translationManager.translate('loading')) :
            
            error ? h('div', { 
                className: 'text-destructive p-4 text-center' 
            }, error) :
            
            projects.length === 0 ? h('div', { 
                className: 'text-muted-foreground p-4 text-center' 
            }, translationManager.translate('noProjects')) :
            
            h('ul', { className: 'space-y-2 p-2' }, projects.map((project, index) => 
                h('li', {
                    key: project.id,
                    draggable: true,
                    onDragStart: (e) => handleDragStart(e, index),
                    onDragOver: (e) => handleDragOver(e, index),
                    onDragEnd: handleDragEnd,
                    onClick: () => handleProjectClick(project.id),
                    className: `
                        relative group flex items-center gap-2 p-3 
                        rounded-lg cursor-pointer select-none
                        ${currentProjectId === project.id ? 'bg-primary/10' : 'hover:bg-muted'}
                        ${draggedItem === index ? 'opacity-50' : ''}
                    `
                }, [
                    h(MoreVertical, { 
                        size: 16,
                        className: 'text-muted-foreground cursor-grab'
                    }),

                    editingId === project.id ?
                        h('input', {
                            ref: editInputRef,
                            type: 'text',
                            value: newProjectName,
                            onChange: (e) => setNewProjectName(e.target.value),
                            onBlur: () => handleEditSubmit(project.id),
                            onKeyDown: (e) => {
                                if (e.key === 'Enter') handleEditSubmit(project.id);
                                if (e.key === 'Escape') setEditingId(null);
                            },
                            className: 'flex-1 bg-background px-2 py-1 rounded border'
                        }) :
                        h('span', { 
                            className: 'flex-1 truncate',
                            title: project.name
                        }, project.name),

                    h('div', { 
                        className: `
                            absolute right-2 flex gap-1
                            opacity-0 group-hover:opacity-100
                            transition-opacity duration-200
                        `
                    }, [
                        h('button', {
                            onClick: (e) => {
                                e.stopPropagation();
                                startEditing(project.id, project.name);
                            },
                            className: 'p-1 hover:bg-muted rounded',
                            'aria-label': translationManager.translate('editProject')
                        }, [
                            h(Edit2, { size: 16 })
                        ]),
                        h('button', {
                            onClick: (e) => handleDeleteProject(project.id, e),
                            className: 'p-1 hover:bg-destructive/10 text-destructive rounded',
                            'aria-label': translationManager.translate('deleteProject')
                        }, [
                            h(Trash2, { size: 16 })
                        ])
                    ])
                ])
            ))
        ])
    ]);
};
