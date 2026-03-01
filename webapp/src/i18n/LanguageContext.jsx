import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import vi from './vi';
import en from './en';

const dictionaries = { vi, en };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [locale, setLocale] = useState(() => localStorage.getItem('nksss_lang') || 'vi');

    const changeLocale = useCallback((lang) => {
        setLocale(lang);
        localStorage.setItem('nksss_lang', lang);
    }, []);

    const t = useCallback((key, params) => {
        const dict = dictionaries[locale] || dictionaries.vi;
        const keys = key.split('.');
        let val = dict;
        for (const k of keys) {
            val = val?.[k];
            if (val === undefined) break;
        }
        if (typeof val !== 'string') {
            // Fallback to Vietnamese if English key is missing
            let fb = dictionaries.vi;
            for (const k of keys) { fb = fb?.[k]; if (fb === undefined) break; }
            val = typeof fb === 'string' ? fb : key;
        }
        // Simple parameter substitution: t('key', { count: 5 }) → "Hello {count}" → "Hello 5"
        if (params && typeof val === 'string') {
            Object.entries(params).forEach(([k, v]) => {
                val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
            });
        }
        return val;
    }, [locale]);

    const value = useMemo(() => ({ locale, setLocale: changeLocale, t }), [locale, changeLocale, t]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useTranslation() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useTranslation must be used within LanguageProvider');
    return ctx;
}
