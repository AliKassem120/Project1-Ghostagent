import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['en', 'ar', 'fr', 'es'],
    defaultLocale: 'en',
    localePrefix: 'as-needed', // No /en prefix for default locale
});

export const localeNames: Record<string, string> = {
    en: 'English',
    ar: 'العربية',
    fr: 'Français',
    es: 'Español',
};

export const localeFlags: Record<string, string> = {
    en: '🇬🇧',
    ar: '🇸🇦',
    fr: '🇫🇷',
    es: '🇪🇸',
};

export const rtlLocales = ['ar'];

export function isRtlLocale(locale: string): boolean {
    return rtlLocales.includes(locale);
}
