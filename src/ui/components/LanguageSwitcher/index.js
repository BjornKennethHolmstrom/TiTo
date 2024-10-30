// src/ui/components/LanguageSwitcher/index.js
import { createElement as h } from 'react';
import { useState, useEffect, useRef } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';

export const LanguageSwitcher = ({
    settingsFeature,
    stateManager,
    translationManager,
    className = ''
}) => {
    // Local state
    const [isOpen, setIsOpen] = useState(false);
    const [currentLanguage, setCurrentLanguage] = useState(
        translationManager.getCurrentLanguage()
    );
    const dropdownRef = useRef(null);

    // Available languages configuration
    const languages = [
        { code: 'en', name: 'English', flag: '🇬🇧' },
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'se', name: 'Svenska', flag: '🇸🇪' },
        { code: 'eu', name: 'Euskara', flag: '🇪🇺' },
        { code: 'fr', name: 'Française', flag: '🇫🇷' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
        { code: 'ja', name: '日本語', flag: '🇯🇵' }
    ];

    // Get language details
    const getCurrentLanguageDetails = () => 
        languages.find(lang => lang.code === currentLanguage) || languages[0];

    // Effect for clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Effect for keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!isOpen) return;

            if (event.key === 'Escape') {
                setIsOpen(false);
                return;
            }

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const currentIndex = languages.findIndex(lang => lang.code === currentLanguage);
                const nextIndex = event.key === 'ArrowDown'
                    ? (currentIndex + 1) % languages.length
                    : (currentIndex - 1 + languages.length) % languages.length;
                handleLanguageChange(languages[nextIndex].code);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentLanguage]);

    // Handle language change
    const handleLanguageChange = async (languageCode) => {
        try {
            // Update settings
            await settingsFeature.updateSettings('general.language', languageCode);
            
            // Update translation manager
            translationManager.setLanguage(languageCode);
            
            // Update local state
            setCurrentLanguage(languageCode);
            
            // Close dropdown
            setIsOpen(false);
            
            // Save settings
            await settingsFeature.saveSettings();

        } catch (error) {
            console.error('Error changing language:', error);
        }
    };

    return h('div', {
        className: `relative ${className}`,
        ref: dropdownRef
    }, [
        // Current language button
        h('button', {
            onClick: () => setIsOpen(!isOpen),
            className: `
                flex items-center gap-2 px-3 py-2 
                rounded-md transition-colors
                hover:bg-muted
                ${isOpen ? 'bg-muted' : ''}
            `,
            'aria-expanded': isOpen,
            'aria-haspopup': true,
            'aria-label': translationManager.translate('selectLanguage')
        }, [
            h(Globe, { 
                size: 16,
                className: 'text-muted-foreground'
            }),
            h('span', { 
                className: 'text-sm hidden sm:inline-block' 
            }, getCurrentLanguageDetails().name),
            h('span', { 
                className: 'text-sm sm:hidden' 
            }, getCurrentLanguageDetails().flag),
            h(ChevronDown, { 
                size: 16,
                className: `
                    text-muted-foreground transition-transform
                    ${isOpen ? 'transform rotate-180' : ''}
                `
            })
        ]),

        // Language dropdown
        isOpen && h('div', {
            className: `
                absolute z-50 mt-1 w-48
                bg-background border rounded-md shadow-lg
                py-1 origin-top-right
                animate-in fade-in-0 zoom-in-95
            `,
            role: 'menu',
            'aria-orientation': 'vertical',
            'aria-labelledby': 'language-menu'
        }, languages.map(language =>
            h('button', {
                key: language.code,
                onClick: () => handleLanguageChange(language.code),
                className: `
                    w-full flex items-center gap-3 px-4 py-2
                    text-sm transition-colors
                    hover:bg-muted
                    ${language.code === currentLanguage ? 'bg-muted' : ''}
                `,
                role: 'menuitem'
            }, [
                h('span', { 
                    className: 'text-base' 
                }, language.flag),
                h('span', { 
                    className: 'flex-1 text-left' 
                }, language.name),
                language.code === currentLanguage && h(Check, { 
                    size: 16,
                    className: 'text-primary'
                })
            ])
        ))
    ]);
};
