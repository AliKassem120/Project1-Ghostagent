'use client';

import Link from 'next/link';
import { LayoutDashboard, MessageSquareText, Package, Settings, LogOut, CreditCard, Zap, ChevronRight, BookOpen, Calendar, Clock, UtensilsCrossed, Map, Home, Users, PartyPopper, Ticket, Download, HeadphonesIcon, Loader2, Briefcase } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { BusinessCategory } from '@/components/BusinessTypeSelector';

function DashboardSidebar({ isOpen, onClose, businessType }: { isOpen: boolean; onClose: () => void; businessType: BusinessCategory | null }) {
    const pathname = usePathname();
    const router = useRouter();
    const { autopilot, setAutopilot, isLoading } = useAutopilot();
    const { user } = useAuth();
    const userEmail = user?.email || null;
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || userEmail?.split('@')[0] || 'User';
    const userInitial = userName.charAt(0).toUpperCase();
    const isGoogleUser = user?.app_metadata?.provider === 'google';

    // Base menu items that all users see
    const baseItems = [
        { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
        { icon: Settings, label: 'AI Settings', href: '/dashboard/settings' },
        { icon: MessageSquareText, label: 'Chat Logs', href: '/dashboard/interactions' },
        { icon: CreditCard, label: 'Billing', href: '/dashboard/billing' },
    ];

    // Dynamic items based on business type
    let dynamicItems: { icon: any, label: string, href: string }[] = [];

    switch (businessType) {
        case 'ecommerce':
            dynamicItems = [
                { icon: Package, label: 'Inventory', href: '/dashboard/inventory' },
                { icon: BookOpen, label: 'Orders', href: '/dashboard/orders' },
                { icon: Zap, label: 'Shipping', href: '/dashboard/shipping' },
            ];
            break;
        case 'appointments':
            dynamicItems = [
                { icon: Calendar, label: 'Calendar', href: '/dashboard/calendar' },
                { icon: Briefcase, label: 'Services', href: '/dashboard/services' },
                { icon: Clock, label: 'Working Hours', href: '/dashboard/hours' },
            ];
            break;
        case 'food_and_beverage':
            dynamicItems = [
                { icon: UtensilsCrossed, label: 'Menu Items', href: '/dashboard/menu' },
                { icon: Map, label: 'Delivery Zones', href: '/dashboard/delivery' },
            ];
            break;
        case 'real_estate':
            dynamicItems = [
                { icon: Home, label: 'Listings', href: '/dashboard/listings' },
                { icon: Users, label: 'Lead CRM', href: '/dashboard/crm' },
            ];
            break;
        case 'events_ticketing':
            dynamicItems = [
                { icon: PartyPopper, label: 'Manage Events', href: '/dashboard/events' },
                { icon: Ticket, label: 'Guestlists', href: '/dashboard/guestlists' },
            ];
            break;
        case 'digital_services':
            dynamicItems = [
                { icon: Download, label: 'Digital Downloads', href: '/dashboard/downloads' },
                { icon: HeadphonesIcon, label: 'Support Tickets', href: '/dashboard/support' },
            ];
            break;
    }

    const navItems = [...baseItems, ...dynamicItems];

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error.message);
        }
        router.push('/');
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
                "w-[260px] border-r border-white/[0.06] bg-surface-0 flex flex-col fixed h-full z-50 transition-transform duration-300 lg:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Logo Section */}
                <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.04]">
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <div className="bg-primary/10 p-2 rounded-xl group-hover:bg-primary/15 transition-colors">
                            <GhostLogo />
                        </div>
                        <span className="font-semibold text-lg tracking-tight text-white/90">
                            GhostAgent
                        </span>
                    </Link>
                    <button onClick={onClose} className="lg:hidden p-2 text-white/40 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Autopilot Toggle */}
                <div className="mx-4 mt-5 mb-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold flex items-center gap-2 text-white/50">
                            <Zap className="w-3.5 h-3.5 text-primary" />
                            Autopilot
                        </span>
                        <button
                            onClick={() => setAutopilot(!autopilot)}
                            disabled={isLoading}
                            className={clsx(
                                "relative w-11 rounded-full transition-all duration-300 press",
                                autopilot ? "bg-primary" : "bg-white/10",
                                isLoading && "opacity-50 cursor-not-allowed"
                            )}
                            style={{ height: '24px' }}
                        >
                            <div className={clsx(
                                "absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-transform duration-300 shadow-sm",
                                autopilot ? "translate-x-[22px]" : "translate-x-[2px]"
                            )} />
                        </button>
                    </div>
                    <p className="text-[10px] text-white/25 leading-relaxed">
                        {isLoading ? "Syncing status..." : (autopilot ? "AI replies are sent automatically." : "Manual approval required for replies.")}
                    </p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 mt-2 space-y-0.5">
                    <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider px-3 pt-3 pb-2">
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
                                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
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

                {/* User Profile */}
                <div className="mt-auto border-t border-white/[0.04] p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-violet-600/30 flex items-center justify-center text-white font-semibold text-sm border border-white/[0.06]">
                            {userInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white/70 truncate">{userName}</p>
                            {userEmail && (
                                <p className="text-[10px] text-white/25 truncate">{userEmail}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-white/25 hover:text-red-400 hover:bg-red-500/[0.05] transition-colors press"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>
        </>
    );
}

function DashboardContent({ children, toggleSidebar }: { children: React.ReactNode; toggleSidebar: () => void }) {
    return (
        <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile Header */}
            <header className="lg:hidden h-14 border-b border-white/[0.06] bg-surface-0 fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4">
                <button onClick={toggleSidebar} className="p-3 text-white/40 hover:text-white transition-colors">
                    <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                    <GhostLogo className="w-5 h-5" />
                    <span className="font-semibold text-base tracking-tight text-white">GhostAgent</span>
                </div>
                <div className="w-9" />
            </header>

            {/* Main Content Area */}
            <div className="flex-1 lg:ml-[260px] relative z-10">
                <main className="p-4 lg:p-8 pt-[72px] lg:pt-8 overflow-y-auto min-h-screen">
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

    const [businessType, setBusinessType] = useState<BusinessCategory | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        if (!user?.id) {
            setIsLoadingData(false);
            return;
        }

        const fetchUserType = async () => {
            const { data, error } = await supabase
                .from('users')
                .select('business_type')
                .eq('id', user.id)
                .single();

            if (data?.business_type) {
                setBusinessType(data.business_type as BusinessCategory);
                setIsLoadingData(false);
            } else {
                if (error && error.code !== 'PGRST116') {
                    console.error('Error fetching user type:', error);
                }
                // If enrolled but no type, row missing, or other error, redirect to onboarding
                router.replace('/onboarding');
            }
        };

        fetchUserType();
    }, [user?.id, router]);

    if (isLoadingData) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
                <StarBackground />
                <Loader2 className="w-8 h-8 text-primary animate-spin relative z-10" />
            </div>
        );
    }

    return (
        <AutopilotProvider>
            <RealtimeProvider userId={userId}>
                <DashboardProvider>
                    <div className="min-h-screen bg-background text-foreground flex relative overflow-hidden">
                        <StarBackground />
                        <DashboardSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} businessType={businessType} />
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
