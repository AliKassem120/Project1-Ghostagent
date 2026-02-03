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
        { name: 'Protocol', href: '#features', section: 'features' },
        { name: 'Clearance', href: '#pricing', section: 'pricing' },
        { name: 'Contact', href: '/contact', section: null },
        { name: 'About Us', href: '/about', section: null },
    ];

    // Scroll tracking for active state
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

    // Smooth scroll for anchor links
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
            <div className="max-w-7xl mx-auto flex items-center justify-between rounded-full px-6 py-3 border border-white/5 bg-black/30 backdrop-blur-md relative overflow-hidden group">
                {/* Scanline */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/10 overflow-hidden">
                    <motion.div
                        className="w-1/4 h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                        animate={{ x: ["-100%", "500%"] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    />
                </div>

                {/* Logo */}
                <Link href="/" className="text-xl font-bold tracking-tighter flex items-center gap-3 group/logo relative z-10">
                    <div className="p-1 rounded-lg transition-colors">
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            whileHover={{ rotate: 360, transition: { duration: 0.5 } }}
                        >
                            <GhostLogo className="w-8 h-8" />
                        </motion.div>
                    </div>
                    <span className="font-black text-xl tracking-tight text-white">
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
                                className={`text-sm font-medium transition-all duration-300 group font-mono tracking-wide ${isActive ? 'text-cyan-400' : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                <span className={`opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-cyan-400 inline-block mr-1 ${isActive ? 'opacity-100 translate-x-0' : ''
                                    }`}>[</span>
                                <span className={`transition-all ${isActive ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                                    }`}>{item.name}</span>
                                <span className={`opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-cyan-400 inline-block ml-1 ${isActive ? 'opacity-100 translate-x-0' : ''
                                    }`}>]</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Right Side: Login (Desktop) + Menu (Mobile) */}
                <div className="flex items-center gap-4 z-10">
                    <Link href="/login" className="hidden md:block relative px-6 py-2 rounded-full border border-white/20 text-sm font-medium overflow-hidden group/btn hover:border-purple-500/50 transition-colors">
                        <span className="relative z-10 transition-colors group-hover/btn:text-white">Login</span>
                        <div className="absolute inset-0 bg-purple-600 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 shadow-[0_0_15px_rgba(147,51,234,0.5)]" />
                    </Link>

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setIsOpen(true)}
                        className="md:hidden p-2 text-white/80 hover:text-white"
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
                            className="fixed right-0 top-0 bottom-0 w-3/4 max-w-sm bg-black/90 backdrop-blur-xl border-l border-white/10 z-50 p-6 md:hidden shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-12">
                                <span className="font-bold text-xl tracking-tight text-white">Navigation</span>
                                <button onClick={() => setIsOpen(false)} className="p-2 text-white/60 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-6">
                                {links.map((item, i) => (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={(e) => handleClick(e, item.href)}
                                        className="text-xl font-medium text-white/80 hover:text-cyan-400 hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.6)] transition-all duration-300 flex items-center gap-3"
                                    >
                                        <span className="text-primary/50 text-xs font-mono">0{i + 1}</span>
                                        {item.name}
                                    </Link>
                                ))}
                                <hr className="border-white/10 my-2" />
                                <Link
                                    href="/login"
                                    onClick={() => setIsOpen(false)}
                                    className="px-6 py-3 rounded-xl border border-purple-500 text-purple-400 font-bold text-center hover:bg-purple-500/10 hover:text-purple-300 transition-all"
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
