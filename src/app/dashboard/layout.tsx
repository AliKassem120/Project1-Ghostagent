'use client';

import Link from 'next/link';
import { LayoutDashboard, MessageSquareText, Package, Settings, LogOut, CreditCard, Zap } from 'lucide-react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import GhostLogo from '@/components/GhostLogo';
import StarBackground from '@/components/StarBackground';
import { AutopilotProvider, useAutopilot } from '@/context/AutopilotContext';
import { RealtimeProvider } from '@/contexts/RealtimeContext';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DashboardProvider } from '@/contexts/DashboardContext';

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
                "w-[240px] border-r border-white/[0.06] bg-[#0E0F15] p-5 flex flex-col fixed h-full z-50 transition-transform duration-300 lg:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex items-center justify-between mb-8">
                    <Link href="/" className="flex items-center gap-2.5 px-1 group">
                        <div className="bg-white/[0.04] p-2 rounded-xl group-hover:bg-white/[0.06] transition-colors">
                            <GhostLogo />
                        </div>
                        <span className="font-semibold text-lg tracking-tight text-white/90">
                            GhostAgent
                        </span>
                    </Link>
                    <button onClick={onClose} className="lg:hidden p-2 text-white/40 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Autopilot Toggle */}
                <div className="mb-5 p-3.5 rounded-xl bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium flex items-center gap-2 text-white/50">
                            <Zap className="w-3.5 h-3.5 text-primary" />
                            Autopilot
                        </span>
                        <button
                            onClick={() => setAutopilot(!autopilot)}
                            className={clsx(
                                "relative w-10 rounded-full transition-all duration-300",
                                autopilot ? "bg-primary" : "bg-white/10"
                            )}
                            style={{ height: '22px' }}
                        >
                            <div className={clsx(
                                "absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform duration-300",
                                autopilot ? "translate-x-[20px]" : "translate-x-[2px]"
                            )} />
                        </button>
                    </div>
                    <p className="text-[10px] text-white/25">
                        {autopilot ? "Auto-replying to DMs" : "Manual approval mode"}
                    </p>
                </div>

                <nav className="flex-1 space-y-0.5">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                                className={clsx(
                                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
                                )}
                            >
                                <item.icon className="w-[18px] h-[18px]" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/25 hover:text-red-400 hover:bg-red-500/[0.05] transition-colors mt-auto w-full text-left text-sm"
                >
                    <LogOut className="w-[18px] h-[18px]" />
                    Sign Out
                </button>
            </aside>
        </>
    );
}

function DashboardContent({ children, toggleSidebar }: { children: React.ReactNode; toggleSidebar: () => void }) {
    return (
        <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile Header */}
            <header className="lg:hidden h-14 border-b border-white/[0.06] bg-[#0B0C10]/95 fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 backdrop-blur-xl">
                <button onClick={toggleSidebar} className="p-2 text-white/40 hover:text-white">
                    <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                    <GhostLogo className="w-5 h-5" />
                    <span className="font-semibold text-base tracking-tight">GhostAgent</span>
                </div>
                <div className="w-9" />
            </header>

            {/* Main Content Area */}
            <div className="flex-1 lg:ml-[240px] relative z-10">
                <main className="p-4 lg:p-6 pt-[72px] lg:pt-6 overflow-y-auto min-h-screen">
                    <div className="max-w-[1600px] mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userId, setUserId] = useState<string | undefined>(undefined);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            }
        };
        getUser();
    }, []);

    return (
        <AutopilotProvider>
            <RealtimeProvider userId={userId}>
                <DashboardProvider>
                    <div className="min-h-screen bg-[#0B0C10] text-white flex relative overflow-hidden">
                        <StarBackground />
                        <DashboardSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                        <DashboardContent
                            toggleSidebar={() => setIsSidebarOpen(true)}
                        >
                            {children}
                        </DashboardContent>
                    </div>
                </DashboardProvider>
            </RealtimeProvider>
        </AutopilotProvider>
    );
}
