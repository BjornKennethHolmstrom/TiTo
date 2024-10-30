// src/ui/components/ThemeSwitcher/index.js
import { Moon, Sun, Monitor } from 'lucide-react';

export const ThemeSwitcher = ({
    themesFeature,
    stateManager,
    translationManager,
    className = ''
}) => {
    // State subscriptions
    const [currentTheme, setCurrentTheme] = useState(null);
    const [autoDetect, setAutoDetect] = useState(false);
    const [customThemes, setCustomThemes] = useState([]);
    const [showCustomizer, setShowCustomizer] = useState(false);

    useEffect(() => {
        const unsubscribers = [
            stateManager.subscribe('theme.current', setCurrentTheme),
            stateManager.subscribe('theme.autoDetect', setAutoDetect),
            stateManager.subscribe('theme.customThemes', setCustomThemes)
        ];

        return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    }, [stateManager]);

    // Quick theme toggle
    const handleQuickToggle = () => {
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        themesFeature.setTheme(nextTheme, false);
    };

    // Theme selection from dropdown
    const handleThemeChange = (e) => {
        const themeId = e.target.value;
        if (themeId === 'auto') {
            themesFeature.toggleAutoDetect();
        } else {
            themesFeature.setTheme(themeId, false);
        }
    };

    return h('div', {
        className: `relative ${className}`
    }, [
        // Quick toggle button
        h('button', {
            onClick: handleQuickToggle,
            className: `
                p-2 rounded-md
                hover:bg-muted
                inline-flex items-center gap-2
            `,
            'aria-label': translationManager.translate(
                currentTheme === 'light' ? 'switchToDark' : 'switchToLight'
            )
        }, [
            currentTheme === 'light' ? 
                h(Moon, { size: 20 }) : 
                h(Sun, { size: 20 }),
            h('span', { className: 'sr-only' },
                currentTheme === 'light' ?
                    translationManager.translate('darkMode') :
                    translationManager.translate('lightMode')
            )
        ]),

        // Full theme selector dropdown
        h('select', {
            value: autoDetect ? 'auto' : currentTheme,
            onChange: handleThemeChange,
            className: `
                ml-2 rounded-md border bg-background
                px-2 py-1 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary
            `
        }, [
            // System preference option
            h('option', { value: 'auto' }, [
                h('div', { className: 'flex items-center gap-2' }, [
                    h(Monitor, { size: 16 }),
                    translationManager.translate('systemPreference')
                ])
            ]),

            // Built-in themes
            h('optgroup', { 
                label: translationManager.translate('builtinThemes') 
            }, [
                h('option', { value: 'light' }, 
                    translationManager.translate('lightMode')
                ),
                h('option', { value: 'dark' }, 
                    translationManager.translate('darkMode')
                )
            ]),

            // Custom themes
            customThemes.length > 0 && h('optgroup', {
                label: translationManager.translate('customThemes')
            }, customThemes.map(theme =>
                h('option', { 
                    key: theme.id,
                    value: theme.id
                }, theme.name)
            ))
        ]),

        // Theme customizer button
        h('button', {
            onClick: () => setShowCustomizer(true),
            className: `
                ml-2 p-1 rounded-md
                hover:bg-muted
                text-sm text-muted-foreground
                hover:text-foreground
            `
        }, translationManager.translate('customize')),

        // Theme customizer modal (simplified for brevity)
        showCustomizer && h('div', {
            className: 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50'
        }, [
            h('div', {
                className: `
                    fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]
                    w-full max-w-lg
                    bg-background rounded-lg shadow-lg
                    p-6
                `,
                role: 'dialog',
                'aria-label': translationManager.translate('themeCustomizer')
            }, [
                // Modal content would go here
                // (Theme customization interface)
                h('button', {
                    onClick: () => setShowCustomizer(false),
                    className: 'absolute top-4 right-4 text-muted-foreground hover:text-foreground'
                }, [
                    h(X, { size: 16 }),
                    h('span', { className: 'sr-only' },
                        translationManager.translate('close')
                    )
                ])
            ])
        ])
    ]);
};
