'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import GhostLogo from '@/components/GhostLogo';

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('');
    const pathname = usePathname();

    const links = [
        { name: 'Features', href: '#features', section: 'features' },
        { name: 'Pricing', href: '#pricing', section: 'pricing' },
        { name: 'Contact', href: '/contact', section: null },
        { name: 'About', href: '/about', section: null },
    ];

    useEffect(() => {
        if (pathname !== '/') return;

        const handleScroll = () => {
            const sections = ['features', 'pricing', 'contact'];
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
        if (href.startsWith('#')) {
            e.preventDefault();
            const element = document.getElementById(href.slice(1));
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setIsOpen(false);
        }
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between rounded-2xl px-6 py-3 border border-white/[0.06] bg-[#0B0C10]/80 backdrop-blur-xl shadow-lg relative overflow-hidden">

                {/* Logo */}
                <Link href="/" className="text-xl font-semibold tracking-tight flex items-center gap-3 relative z-10">
                    <div className="p-1.5 rounded-xl bg-white/[0.04]">
                        <GhostLogo className="w-7 h-7" />
                    </div>
                    <span className="font-semibold text-lg text-white">
                        GhostAgent
                    </span>
                </Link>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2 z-10">
                    {links.map((item) => {
                        const isActive = item.section && activeSection === item.section;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={(e) => handleClick(e, item.href)}
                                className={`text-sm font-medium transition-all duration-200 ${isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
                                    }`}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </div>

                {/* Right Side */}
                <div className="flex items-center gap-4 z-10">
                    <Link href="/login" className="hidden md:block px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity">
                        Login
                    </Link>

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setIsOpen(true)}
                        className="md:hidden p-2 text-white/60 hover:text-white"
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
                            className="fixed right-0 top-0 bottom-0 w-3/4 max-w-sm bg-[#0E0F15] border-l border-white/[0.06] z-50 p-6 md:hidden shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-12">
                                <span className="font-semibold text-xl text-white">Menu</span>
                                <button onClick={() => setIsOpen(false)} className="p-2 text-white/40 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-5">
                                {links.map((item) => {
                                    const isAnchor = item.href.startsWith('#');
                                    return (
                                        <Link
                                            key={item.name}
                                            href={isAnchor ? '/' + item.href : item.href}
                                            onClick={(e) => {
                                                if (isAnchor) {
                                                    e.preventDefault();
                                                    const element = document.getElementById(item.href.slice(1));
                                                    if (element) {
                                                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }
                                                }
                                                setIsOpen(false);
                                            }}
                                            className="text-lg font-medium text-white/50 hover:text-white transition-colors"
                                        >
                                            {item.name}
                                        </Link>
                                    );
                                })}
                                <hr className="border-white/[0.06] my-2" />
                                <Link
                                    href="/login"
                                    onClick={() => setIsOpen(false)}
                                    className="px-6 py-3 rounded-xl bg-primary text-white font-medium text-center hover:opacity-90 transition-opacity"
                                >
                                    Login
                                </Link>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </nav>
    );
}
