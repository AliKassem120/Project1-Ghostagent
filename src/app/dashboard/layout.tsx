'use client';

import Link from 'next/link';
import { LayoutDashboard, MessageSquareText, Package, Settings, LogOut, CreditCard, Zap } from 'lucide-react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useState } from 'react';
import GhostLogo from '@/components/GhostLogo';
import StarBackground from '@/components/StarBackground';
import ActivityFeed from '@/components/ActivityFeed';
import { AutopilotProvider, useAutopilot } from '@/context/AutopilotContext';
import { Menu, X, Activity as ActivityIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function DashboardSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const { autopilot, setAutopilot } = useAutopilot();

    const navItems = [
        { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
        { icon: MessageSquareText, label: 'Interactions', href: '/dashboard/interactions' },
        { icon: Package, label: 'Inventory', href: '/dashboard/inventory' },
        { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
        { icon: CreditCard, label: 'Billing', href: '/dashboard/billing' },
    ];

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error.message);
        }
        router.push('/login');
        router.refresh();
    };

    return (
        <>
            {/* Backdrop for mobile */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            <aside className={clsx(
                "w-64 border-r border-white/10 bg-black/90 lg:bg-black/50 p-6 flex flex-col fixed h-full glass-dark z-50 transition-transform duration-300 lg:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex items-center justify-between mb-10">
                    <Link href="/" className="flex items-center gap-3 px-2 group">
                        <div className="bg-white/5 p-2 rounded-xl group-hover:bg-white/10 transition-colors">
                            <GhostLogo />
                        </div>
                        <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            GhostAgent
                        </span>
                    </Link>
                    <button onClick={onClose} className="lg:hidden p-2 text-white/60 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Autopilot Toggle */}
                <div className="mb-6 p-4 glass rounded-xl border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            Agent Autopilot
                        </span>
                        <button
                            onClick={() => setAutopilot(!autopilot)}
                            className={clsx(
                                "relative w-11 h-6 rounded-full transition-colors",
                                autopilot ? "bg-primary" : "bg-white/20"
                            )}
                        >
                            <div className={clsx(
                                "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                                autopilot ? "translate-x-5" : "translate-x-0.5"
                            )} />
                        </button>
                    </div>
                    <p className="text-xs text-white/40">
                        {autopilot ? "Auto-replying to comments" : "Manual approval required"}
                    </p>
                </div>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                                className={clsx(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                                    isActive
                                        ? "bg-primary text-black shadow-[0_0_20px_rgba(192,132,252,0.3)]"
                                        : "text-white/60 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors mt-auto w-full text-left"
                >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>
            </aside>
        </>
    );
}

function DashboardContent({ children, toggleSidebar, toggleFeed }: { children: React.ReactNode; toggleSidebar: () => void; toggleFeed: () => void }) {
    const { autopilot } = useAutopilot();
    return (
        <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile Header */}
            <header className="lg:hidden h-16 border-b border-white/10 bg-black/50 glass-dark fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4">
                <button onClick={toggleSidebar} className="p-2 text-white/60 hover:text-white">
                    <Menu className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-2">
                    <GhostLogo className="w-6 h-6" />
                    <span className="font-bold text-lg tracking-tight">GhostAgent</span>
                </div>
                <button onClick={toggleFeed} className="p-2 text-white/60 hover:text-white relative">
                    <ActivityIcon className="w-6 h-6" />
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                </button>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 lg:ml-64 lg:mr-80 relative z-10">
                <main className="p-4 lg:p-8 pt-20 lg:pt-8 overflow-y-auto min-h-screen">
                    <div className="max-w-6xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

function DashboardActivityFeed({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { autopilot } = useAutopilot();
    return <ActivityFeed autopilot={autopilot} isOpen={isOpen} onClose={onClose} />;
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isFeedOpen, setIsFeedOpen] = useState(false);

    return (
        <AutopilotProvider>
            <div className="min-h-screen bg-black text-white flex relative overflow-hidden">
                <StarBackground />
                <DashboardSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                <DashboardContent
                    toggleSidebar={() => setIsSidebarOpen(true)}
                    toggleFeed={() => setIsFeedOpen(!isFeedOpen)}
                >
                    {children}
                </DashboardContent>
                <DashboardActivityFeed isOpen={isFeedOpen} onClose={() => setIsFeedOpen(false)} />
            </div>
        </AutopilotProvider>
    );
}

