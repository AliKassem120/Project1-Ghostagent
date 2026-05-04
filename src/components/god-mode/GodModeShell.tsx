'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LayoutDashboard, Briefcase, Activity, Database, 
    ShoppingCart, Calendar, ShieldAlert, LogOut, Loader2, Menu, X
} from 'lucide-react';
import GhostLogo from '@/components/GhostLogo';

interface GodModeShellProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const GOD_MODE_TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'workspaces', label: 'Workspaces', icon: Briefcase },
    { id: 'states', label: 'State Manager', icon: Database },
    { id: 'logs', label: 'Activity Logs', icon: Activity },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'controls', label: 'System Controls', icon: ShieldAlert },
];

export default function GodModeShell({ children, activeTab, onTabChange }: GodModeShellProps) {
    const router = useRouter();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const handleLogout = () => {
        sessionStorage.removeItem('god_mode_auth');
        window.location.reload();
    };

    return (
        <div className="min-h-[100dvh] bg-background text-foreground flex relative overflow-x-clip selection:bg-red-500/30">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-red-500/20 blur-[120px] rounded-full translate-y-[-50%]" />
            </div>

            {/* Mobile Backdrop */}
            <AnimatePresence>
                {isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside className={`w-[260px] border-r border-red-500/10 bg-surface-0/80 backdrop-blur-xl flex flex-col fixed h-[100dvh] z-50 transition-transform duration-300 lg:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex-none">
                    <div className="flex items-center justify-between px-5 h-16 border-b border-red-500/10">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-red-500/10 rounded-lg">
                                <GhostLogo iconOnly className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-foreground tracking-tight leading-none bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">GOD MODE</div>
                            </div>
                        </div>
                        <button onClick={() => setIsMobileOpen(false)} className="lg:hidden p-2 text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 mt-4 space-y-1 pb-2">
                    {GOD_MODE_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => { onTabChange(tab.id); setIsMobileOpen(false); }}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium ${
                                activeTab === tab.id
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "text-muted-foreground hover:text-foreground hover:bg-surface-1"
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-red-500/10">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Exit God Mode
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="lg:hidden h-14 border-b border-red-500/10 bg-surface-0/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4">
                    <button onClick={() => setIsMobileOpen(true)} className="p-2 text-muted-foreground">
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">GOD MODE</div>
                    <div className="w-9" />
                </header>

                <div className="flex-1 lg:ml-[260px] relative z-10">
                    <main className="p-4 lg:p-8 pt-[72px] lg:pt-8 min-h-[100dvh]">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
