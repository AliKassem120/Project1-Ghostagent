'use client';

import { useState, useEffect, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import GhostLogo from '@/components/GhostLogo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('');
    const [scrolled, setScrolled] = useState(false);
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);
    const t = useTranslations('Navbar');

    useEffect(() => { setMounted(true); }, []);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Scroll shadow
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const links = [
        { name: t('features'), href: '/#features', section: 'features' },
        { name: t('pricing'), href: '/#pricing', section: 'pricing' },
        { name: t('about'), href: '/about', section: null },
        { name: t('contact'), href: '/contact', section: null },
    ];

    useEffect(() => {
        // Strip locale prefix for section detection
        const basePath = pathname.replace(/^\/(en|ar|fr|es)/, '') || '/';
        if (basePath !== '/') return;
        const handleScroll = () => {
            const sections = ['features', 'pricing'];
            const scrollPosition = window.scrollY + 100;
            for (const sectionId of sections) {
                const element = document.getElementById(sectionId);
                if (element) {
                    const { offsetTop, offsetHeight } = element;
                    if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
                        setActiveSection(sectionId);
                        return;
                    }
                }
            }
            setActiveSection('');
        };
        window.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, [pathname]);

    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        // Strip locale prefix for comparison
        const basePath = pathname.replace(/^\/(en|ar|fr|es)/, '') || '/';
        if (basePath === '/' && href.startsWith('/#')) {
            e.preventDefault();
            const element = document.getElementById(href.slice(2));
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setIsOpen(false);
    };

    // 3-line hamburger icon
    const HamburgerIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    );

    return (
        <nav ref={navRef} className="fixed top-0 left-0 right-0 z-50">
            {/* ── Top Bar ── */}
            <div className={`flex items-center justify-between px-5 md:px-10 py-4 bg-background/95 backdrop-blur-xl border-b border-border transition-shadow duration-200 ${scrolled ? 'shadow-md' : ''}`}>
                {/* Logo */}
                <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-foreground/5">
                        <GhostLogo className="w-7 h-7" />
                    </div>
                    <span className="font-bold text-lg text-foreground tracking-tight">GhostAgent</span>
                </Link>

                {/* Desktop Links (centered) */}
                <div className="hidden md:flex items-center gap-8">
                    {links.map((item) => {
                        const isActive =
                            (item.section && activeSection === item.section) ||
                            (!item.section && pathname === item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={(e) => handleNavClick(e, item.href)}
                                className={`text-sm font-semibold transition-colors duration-200 ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </div>

                {/* Desktop Right */}
                <div className="hidden md:flex items-center gap-3">
                    <LanguageSwitcher />
                    {mounted && (
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors"
                        >
                            {theme === 'dark' ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            )}
                        </button>
                    )}
                    <Link href="/login" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                        {t('login')}
                    </Link>
                    <Link
                        href="/register"
                        className="px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:scale-[1.03]"
                        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)' }}
                    >
                        {t('getStarted')}
                    </Link>
                </div>

                {/* Mobile: Hamburger */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="md:hidden p-1 text-foreground"
                    aria-label="Toggle menu"
                >
                    <HamburgerIcon />
                </button>
            </div>

            {/* ── Mobile Dropdown ── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="md:hidden bg-background border-b border-border shadow-xl"
                    >
                        <div className="flex flex-col items-center py-6 gap-1">
                            {links.map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={(e) => handleNavClick(e, item.href)}
                                    className="w-full text-center py-4 text-base font-bold uppercase tracking-widest text-foreground hover:text-primary transition-colors"
                                >
                                    {item.name}
                                </Link>
                            ))}

                            {/* Log In */}
                            <Link
                                href="/login"
                                onClick={() => setIsOpen(false)}
                                className="w-full text-center py-4 text-base font-bold uppercase tracking-widest text-foreground hover:text-primary transition-colors"
                            >
                                {t('login')}
                            </Link>

                            {/* CTA Button */}
                            <div className="pt-4 pb-2 px-8 w-full">
                                <Link
                                    href="/register"
                                    onClick={() => setIsOpen(false)}
                                    className="block text-center w-full py-4 rounded-full text-sm font-extrabold text-white uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all active:scale-95"
                                    style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)' }}
                                >
                                    {t('getStarted')}
                                </Link>
                            </div>

                            {/* Language Switcher (Mobile) */}
                            <div className="py-2">
                                <LanguageSwitcher />
                            </div>

                            {/* Mobile Theme Switch */}
                            {mounted && (
                                <div className="pb-6 pt-2">
                                    <button
                                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                        className="p-3 text-muted-foreground hover:text-foreground bg-surface-2 hover:bg-surface-3 border border-border rounded-full transition-colors flex items-center justify-center"
                                        aria-label="Toggle theme"
                                    >
                                        {theme === 'dark' ? (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
