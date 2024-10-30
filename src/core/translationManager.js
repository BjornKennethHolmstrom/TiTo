// src/core/translationManager.js
export class TranslationManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('titoLanguage') || 'en';
    }

    translate(key, vars = null) {
        if (!translations[this.currentLanguage]) {
            return translations.en[key] || key;
        }
        
        let translation = translations[this.currentLanguage][key] || translations.en[key] || key;
        
        if (vars) {
            Object.keys(vars).forEach(key => {
                translation = translation.replace(`{${key}}`, vars[key]);
            });
        }
        
        return translation;
    }

    setLanguage(lang) {
        if (translations[lang]) {
            this.currentLanguage = lang;
            localStorage.setItem('titoLanguage', lang);
        }
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }
}

