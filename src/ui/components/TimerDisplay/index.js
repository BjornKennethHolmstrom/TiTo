// src/ui/components/TimerDisplay/index.js
import { createElement as h } from 'react';
import { useEffect, useState } from 'react';
import { Play, Square, Loader } from 'lucide-react';

export const TimerDisplay = ({
    timerFeature,
    stateManager,
    translationManager,
    className = ''
}) => {
    // State subscriptions
    const [isRunning, setIsRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState({ hours: '00', minutes: '00', seconds: '00' });
    const [currentProject, setCurrentProject] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const unsubscribers = [
            stateManager.subscribe('timer.isRunning', setIsRunning),
            stateManager.subscribe('timer.elapsedTime', (time) => {
                setElapsedTime(timerFeature.formatDuration(time));
            }),
            stateManager.subscribe('timer.loading', setLoading),
            stateManager.subscribe('timer.error', setError)
        ];

        // Update current project name when timer is running
        const projectNameUpdater = setInterval(() => {
            if (isRunning) {
                setCurrentProject(timerFeature.getCurrentProjectName());
            }
        }, 1000);

        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
            clearInterval(projectNameUpdater);
        };
    }, [stateManager, timerFeature, isRunning]);

    const handleStartStop = async () => {
        try {
            if (isRunning) {
                await timerFeature.stop();
            } else {
                timerFeature.start();
            }
        } catch (error) {
            console.error('Timer operation failed:', error);
        }
    };

    return h('div', {
        className: `flex flex-col items-center gap-4 ${className}`
    }, [
        // Timer display
        h('div', {
            className: 'text-4xl font-mono tabular-nums',
            role: 'timer',
            'aria-label': translationManager.translate('timerDisplay')
        }, [
            h('span', {
                className: isRunning ? 'text-primary' : undefined
            }, `${elapsedTime.hours}:${elapsedTime.minutes}:${elapsedTime.seconds}`)
        ]),

        // Project name display
        currentProject && h('div', {
            className: 'text-sm text-muted-foreground',
            role: 'status'
        }, [
            translationManager.translate('timerRunningFor'),
            ': ',
            currentProject
        ]),

        // Start/Stop button
        h('button', {
            onClick: handleStartStop,
            disabled: loading,
            className: `
                inline-flex items-center justify-center
                w-16 h-16 rounded-full
                ${isRunning ? 
                    'bg-destructive hover:bg-destructive/90' : 
                    'bg-primary hover:bg-primary/90'}
                text-primary-foreground
                transition-colors duration-200
                disabled:opacity-50
            `,
            'aria-label': isRunning ? 
                translationManager.translate('stopTimer') :
                translationManager.translate('startTimer')
        }, [
            loading ? h(Loader, { 
                size: 24,
                className: 'animate-spin'
            }) : 
            isRunning ? h(Square, { size: 24 }) : h(Play, { size: 24 })
        ]),

        // Error message
        error && h('div', {
            className: 'text-sm text-destructive',
            role: 'alert'
        }, error)
    ]);
};
