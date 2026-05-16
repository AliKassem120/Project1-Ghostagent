'use client';

import Link from 'next/link';
import { LayoutDashboard, Inbox, Package, Settings, LogOut, CreditCard, Zap, ChevronRight, BookOpen, Calendar, Clock, Briefcase, Building2, Check, Plus, Loader2, BarChart2, Megaphone, Phone } from 'lucide-react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import GhostLogo from '@/components/GhostLogo';
import StarBackground from '@/components/StarBackground';
import { AutopilotProvider, useAutopilot } from '@/context/AutopilotContext';
import { RealtimeProvider } from '@/contexts/RealtimeContext';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { BusinessCategory } from '@/components/BusinessTypeSelector';
import AccountPanel from '@/components/AccountPanel';
import AddWorkspaceModal from '@/components/AddWorkspaceModal';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';

function DashboardSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const { autopilot, setAutopilot, isLoading } = useAutopilot();
    const { user, loading: authLoading } = useAuth();
    const { workspaces, activeWorkspace, activeWorkspaceId, setActiveWorkspace, canAddWorkspace, upgradeMessage, planTier, isLoading: wsLoading } = useWorkspace();
    const userEmail = user?.email ?? null;
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || userEmail?.split('@')[0] || null;
    const userInitial = userName ? userName.charAt(0).toUpperCase() : '?';
    const isGoogleUser = user?.app_metadata?.provider === 'google';
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [isWorkspaceSwitcherOpen, setIsWorkspaceSwitcherOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Base menu items that all users see
    const topItems = [
        { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
        { icon: Inbox, label: 'Inbox', href: '/dashboard/inbox' },
    ];

    const bottomItems = [
        { icon: BarChart2, label: 'Analytics', href: '/dashboard/analytics' },
        { icon: Settings, label: 'AI Settings', href: '/dashboard/settings' },
        { icon: CreditCard, label: 'Billing', href: '/dashboard/billing' },
    ];

    // Dynamic items based on ACTIVE WORKSPACE business type (not the users table)
    const businessType = activeWorkspace?.business_type ?? null;
    let dynamicItems: { icon: any, label: string, href: string }[] = [];

    switch (businessType) {
        case 'ecommerce':
            dynamicItems = [
                { icon: Package, label: 'Inventory', href: '/dashboard/inventory' },
                { icon: BookOpen, label: 'Orders', href: '/dashboard/orders' },
                { icon: Megaphone, label: 'Marketing', href: '/dashboard/marketing' },
                { icon: Phone, label: 'Simulator', href: '/dashboard/simulator' },
                { icon: Clock, label: 'Working Hours', href: '/dashboard/hours' },
            ];
            break;
        case 'appointments':
            dynamicItems = [
                { icon: Calendar, label: 'Calendar', href: '/dashboard/calendar' },
                { icon: Briefcase, label: 'Services', href: '/dashboard/services' },
                { icon: Megaphone, label: 'Marketing', href: '/dashboard/marketing' },
                { icon: Phone, label: 'Simulator', href: '/dashboard/simulator' },
                { icon: Clock, label: 'Working Hours', href: '/dashboard/hours' },
            ];
            break;

    }

    const navItems = [...topItems, ...dynamicItems, ...bottomItems];

    const handleLogout = async () => {
        const { createClient } = await import('@/utils/supabase/client');
        const client = createClient();
        await client.auth.signOut();
        // AuthContext's onAuthStateChange will handle redirect to '/'
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
                "w-[260px] border-r border-border bg-surface-0 flex flex-col fixed h-[100dvh] z-50 transition-transform duration-300 lg:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex-none">
                    {/* Logo Section */}
                    <div className="flex items-center justify-between px-5 h-16 border-b border-border">
                        <Link href="/" className="flex items-center">
                            <GhostLogo size="md" />
                        </Link>
                        <button onClick={onClose} className="lg:hidden p-2 text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Workspace Switcher */}
                    <div className="mx-4 mt-5 mb-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-2">Active Agent</p>
                        <div className="relative">
                            <button
                                onClick={() => setIsWorkspaceSwitcherOpen(v => !v)}
                                className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-surface-1 border border-border hover:bg-surface-2 transition-colors text-left group"
                            >
                                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                                    <Building2 className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    {wsLoading ? (
                                        <>
                                            <div className="h-3 w-20 bg-surface-2 rounded-md animate-pulse mb-1" />
                                            <div className="h-2 w-28 bg-surface-2 rounded-md animate-pulse" />
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-xs font-semibold text-muted-foreground truncate">{activeWorkspace?.name || 'My Store'}</p>
                                            <p className="text-[9px] text-muted-foreground truncate">{activeWorkspace?.instagram_username ? `@${activeWorkspace.instagram_username}` : 'No Instagram connected'}</p>
                                        </>
                                    )}
                                </div>
                                <ChevronRight className={clsx('w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0', isWorkspaceSwitcherOpen && 'rotate-90')} />
                            </button>

                            <AnimatePresence>
                                {isWorkspaceSwitcherOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface-1 border border-border rounded-xl shadow-2xl overflow-hidden"
                                    >
                                        {workspaces.map(ws => (
                                            <button
                                                key={ws.id}
                                                onClick={() => {
                                                    setActiveWorkspace(ws.id);
                                                    setIsWorkspaceSwitcherOpen(false);
                                                    if (window.innerWidth < 1024) onClose();
                                                    router.push('/dashboard'); // Reset view to root dashboard on switch
                                                }}
                                                className={clsx(
                                                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                                                    ws.id === activeWorkspaceId
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                                                )}
                                            >
                                                <div className={clsx('w-2 h-2 rounded-full shrink-0', ws.id === activeWorkspaceId ? 'bg-primary' : 'bg-surface-2')} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-semibold truncate">{ws.name}</p>
                                                    <p className="text-[9px] text-muted-foreground truncate">{ws.instagram_username ? `@${ws.instagram_username}` : ws.business_type}</p>
                                                </div>
                                                {ws.id === activeWorkspaceId && <Check className="w-3 h-3 shrink-0" />}
                                            </button>
                                        ))}

                                        <div className="border-t border-border p-2">
                                            {canAddWorkspace ? (
                                                <button
                                                    onClick={() => { setIsWorkspaceSwitcherOpen(false); setIsAddModalOpen(true); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Add Account
                                                </button>
                                            ) : (
                                                <div className="px-3 py-2">
                                                    <p className="text-[9px] text-muted-foreground mb-1">{upgradeMessage}</p>
                                                    {planTier && planTier !== 'empire' && (
                                                        <Link href="/dashboard/billing" onClick={() => setIsWorkspaceSwitcherOpen(false)} className="text-[10px] text-primary font-bold hover:underline">
                                                            Upgrade plan →
                                                        </Link>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    <div className="mx-4 mt-5 mb-2 p-4 rounded-xl bg-surface-1 border border-border">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
                                <Zap className="w-3.5 h-3.5 text-primary" />
                                Autopilot
                            </span>
                                <button
                                    onClick={() => autopilot !== null && setAutopilot(!autopilot)}
                                    disabled={isLoading || autopilot === null}
                                    className={clsx(
                                        "relative w-11 rounded-full transition-all duration-300 press",
                                        autopilot === true ? "bg-primary" : "bg-surface-2",
                                        (isLoading || autopilot === null) && "opacity-50 cursor-not-allowed"
                                    )}
                                    style={{ height: '24px' }}
                                >
                                    <div className={clsx(
                                        "absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-transform duration-300 shadow-sm",
                                        autopilot === true ? "translate-x-[22px]" : "translate-x-[2px]"
                                    )} />
                                </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            {isLoading || autopilot === null ? "Syncing status..." : (autopilot ? "AI replies are sent automatically." : "Manual approval required for replies.")}
                        </p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 mt-2 space-y-0.5 pb-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-3 pb-2">
                        Menu
                    </p>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                                className={clsx(
                                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium relative group",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-surface-1"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <item.icon className="w-[18px] h-[18px]" />
                                {item.label}
                                {isActive && (
                                    <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile — click to open Account Security */}
                <div className="flex-none bg-inherit p-4 pb-6 mt-auto border-t border-border">
                    <button
                        onClick={() => setIsAccountOpen(true)}
                        className="flex items-center gap-3 mb-3 w-full rounded-xl p-2 -mx-2 hover:bg-surface-2 transition-colors group text-left"
                    >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-violet-600/30 flex items-center justify-center text-foreground font-semibold text-sm border border-border shrink-0">
                            {authLoading || !userName ? (
                                <div className="w-4 h-4 rounded-full bg-muted-foreground/20 animate-pulse" />
                            ) : userInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                            {authLoading || !userName ? (
                                <>
                                    <div className="h-2.5 w-24 rounded-full bg-muted-foreground/20 animate-pulse mb-1.5" />
                                    <div className="h-2 w-32 rounded-full bg-muted-foreground/10 animate-pulse" />
                                </>
                            ) : (
                                <>
                                    <p className="text-xs font-medium text-muted-foreground truncate">{userName}</p>
                                    {userEmail && (
                                        <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                                    )}
                                </>
                            )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-colors shrink-0" />
                    </button>
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors press mb-1"
                    >
                        <div className="flex items-center gap-2.5">
                            {mounted && theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                            Theme
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider">{mounted ? theme : ''}</span>
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/[0.05] transition-colors press"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Account Security Panel */}
            <AccountPanel
                isOpen={isAccountOpen}
                onClose={() => setIsAccountOpen(false)}
                userEmail={userEmail}
                userName={userName}
                userInitial={userInitial}
                isGoogleUser={isGoogleUser}
                userAvatarUrl={user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null}
                userCreatedAt={user?.created_at || null}
            />

            {/* Add Workspace Modal */}
            <AddWorkspaceModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
        </>
    );
}

function DashboardContent({ children, toggleSidebar }: { children: React.ReactNode; toggleSidebar: () => void }) {
    return (
        <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile Header */}
            <header className="lg:hidden h-14 border-b border-border bg-surface-0 fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4">
                <button onClick={toggleSidebar} className="p-3 text-muted-foreground hover:text-foreground transition-colors">
                    <Menu className="w-5 h-5" />
                </button>
                <GhostLogo size="sm" />
                <div className="w-9" />
            </header>

            {/* Main Content Area */}
            <div className="flex-1 lg:ml-[260px] relative z-10">
                <main className="p-4 lg:p-8 pt-[72px] lg:pt-8 overflow-y-auto min-h-[100dvh]">
                    <div className="max-w-[1400px] mx-auto">
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
    const { user } = useAuth();
    const userId = user?.id;
    const router = useRouter();

    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        if (!user?.id) {
            setIsLoadingData(false);
            return;
        }

        const checkUserExists = async () => {
            const { data, error } = await supabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .single();

            if (data) {
                setIsLoadingData(false);
            } else {
                if (error && error.code !== 'PGRST116') {
                    console.error('Error checking user:', error);
                }
                router.replace('/onboarding');
            }
        };

        checkUserExists();
    }, [user?.id, router]);

    if (isLoadingData) {
        return (
            <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center relative overflow-x-clip">
                <StarBackground />
                <Loader2 className="w-8 h-8 text-primary animate-spin relative z-10" />
            </div>
        );
    }

    return (
        <WorkspaceProvider>
            <AutopilotProvider>
                <RealtimeProvider userId={userId}>
                    <DashboardProvider>
                        <div className="min-h-[100dvh] bg-background text-foreground flex relative overflow-x-clip">
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
        </WorkspaceProvider>
    );
}
