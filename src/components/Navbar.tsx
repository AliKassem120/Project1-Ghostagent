'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon, Zap, Tag, Info, Mail, User } from 'lucide-react';
import GhostLogo from '@/components/GhostLogo';
import { useTheme } from 'next-themes';

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('');
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const links = [
        { name: 'Features', href: '/#features', section: 'features', icon: Zap },
        { name: 'Pricing', href: '/#pricing', section: 'pricing', icon: Tag },
        { name: 'About', href: '/about', section: null, icon: Info },
        { name: 'Contact', href: '/contact', section: null, icon: Mail },
    ];

    useEffect(() => {
        if (pathname !== '/') return;

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

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (pathname === '/' && href.startsWith('/#')) {
            e.preventDefault();
            const element = document.getElementById(href.slice(2));
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setIsOpen(false);
        }
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between rounded-2xl px-5 md:px-6 py-3 border border-border bg-surface-0/80 backdrop-blur-xl shadow-lg relative overflow-hidden">
                {/* Logo */}
                <Link href="/" className="text-xl font-semibold tracking-tight flex items-center gap-2.5 relative z-10">
                    <div className="p-1.5 rounded-xl bg-foreground/5">
                        <GhostLogo className="w-7 h-7" />
                    </div>
                    <span className="font-semibold text-lg text-foreground">
                        GhostAgent
                    </span>
                </Link>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2 z-10">
                    {links.map((item) => {
                        const isActive =
                            (item.section && activeSection === item.section) ||
                            (!item.section && pathname === item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={(e) => handleClick(e, item.href)}
                                className={`text-sm font-medium transition-all duration-200 ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </div>

                {/* Right Side */}
                <div className="flex items-center gap-2 md:gap-4 z-10">
                    <button
                        onClick={toggleTheme}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors"
                        aria-label="Toggle theme"
                    >
                        {mounted && theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>

                    <Link
                        href="/login"
                        className="hidden md:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ml-2"
                    >
                        Login
                    </Link>
                    <Link
                        href="/login"
                        className="hidden md:block px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.35)]"
                    >
                        Start Free Trial
                    </Link>

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setIsOpen(true)}
                        className="md:hidden p-2 text-muted-foreground hover:text-foreground"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed right-0 top-0 bottom-0 w-3/4 max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-slate-200 dark:border-slate-800 z-50 p-6 md:hidden shadow-2xl flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-10">
                                <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">Menu</span>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex flex-col space-y-4 flex-1">
                                {links.map((item) => (
                                    <div key={item.name} className="group/item overflow-hidden">
                                        <Link
                                            href={item.href}
                                            onClick={(e) => {
                                                handleClick(e, item.href);
                                                setIsOpen(false);
                                            }}
                                            className="flex items-center gap-4 py-2 text-lg font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 hover:translate-x-2"
                                        >
                                            <item.icon className="w-5 h-5 text-indigo-500 shrink-0" />
                                            {item.name}
                                        </Link>
                                    </div>
                                ))}

                                <div className="pt-6 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-4">
                                    <div className="group/item overflow-hidden">
                                        <Link
                                            href="/login"
                                            onClick={() => setIsOpen(false)}
                                            className="flex items-center gap-4 py-2 text-lg font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 hover:translate-x-2"
                                        >
                                            <User className="w-5 h-5 text-indigo-500 shrink-0" />
                                            Login
                                        </Link>
                                    </div>
                                    <Link
                                        href="/login"
                                        onClick={() => setIsOpen(false)}
                                        className="inline-flex items-center justify-center w-full px-6 py-4 mt-2 rounded-xl bg-indigo-600 text-white font-semibold text-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30"
                                    >
                                        Start Free Trial
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </nav>
    );
}
