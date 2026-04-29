'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { routing, localeNames, localeFlags } from '@/i18n/routing';

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function switchLocale(newLocale: string) {
        router.replace(pathname, { locale: newLocale });
        setIsOpen(false);
    }

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-1 border border-border hover:bg-surface-2 transition-colors text-sm font-medium"
                aria-label="Switch language"
            >
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider">
                    {localeFlags[locale]} {locale.toUpperCase()}
                </span>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-44 bg-surface-1 border border-border rounded-xl shadow-xl overflow-hidden z-[200] backdrop-blur-xl">
                    {routing.locales.map((l) => (
                        <button
                            key={l}
                            onClick={() => switchLocale(l)}
                            className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-3 transition-colors hover:bg-surface-2 ${
                                locale === l
                                    ? 'text-primary bg-primary/5'
                                    : 'text-foreground'
                            }`}
                        >
                            <span className="text-base">{localeFlags[l]}</span>
                            <span>{localeNames[l]}</span>
                            {locale === l && (
                                <span className="ml-auto text-primary text-xs">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
