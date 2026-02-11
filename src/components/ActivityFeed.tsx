'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, MessageSquare, Package, AlertCircle, DollarSign, X } from 'lucide-react';
import { clsx } from 'clsx';

type ActivityType = 'comment' | 'inventory' | 'sale' | 'alert';

interface ActivityLog {
    id: string;
    type: ActivityType;
    message: string;
    timestamp: Date;
}

import { createClient } from '@/utils/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { useRealtime } from '@/hooks/useRealtime';

export default function ActivityFeed({ autopilot, isOpen, onClose }: { autopilot: boolean; isOpen: boolean; onClose: () => void }) {
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [mounted, setMounted] = useState(false);
    const { version } = useDashboard();
    const supabase = createClient();

    // Map raw DB record to ActivityLog
    const mapActivity = useCallback((d: any): ActivityLog => ({
        id: d.id,
        type: (d.event_type?.includes('INVENTORY') || d.event_type === 'RESTOCK' || d.event_type === 'NEW_ITEM') ? 'inventory' :
            d.event_type?.includes('SALE') ? 'sale' :
                d.event_type?.includes('ALERT') ? 'alert' : 'comment',
        message: d.description,
        timestamp: new Date(d.timestamp)
    }), []);

    // 🔥 Use the polling-enabled hook for live updates
    const { data: rawActivities } = useRealtime<any>(
        'activity_log',
        '*',
        {
            orderBy: 'timestamp',
            orderDirection: 'desc',
            limit: 30,
            pollingInterval: 3000 // 3-second polling as requested
        }
    );

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (rawActivities) {
            setActivities(rawActivities.map(mapActivity));
        }
    }, [rawActivities, mapActivity]);

    const getIcon = (type: ActivityType) => {
        switch (type) {
            case 'comment': return MessageSquare;
            case 'inventory': return Package;
            case 'sale': return DollarSign;
            case 'alert': return AlertCircle;
            default: return Activity;
        }
    };

    const getColor = (type: ActivityType) => {
        switch (type) {
            case 'comment': return 'text-blue-400';
            case 'inventory': return 'text-yellow-400';
            case 'sale': return 'text-green-400';
            case 'alert': return 'text-red-400';
            default: return 'text-white';
        }
    };

    const formatTime = (date: Date) => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
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
                "w-80 border-l border-white/10 bg-black/95 lg:bg-black/50 fixed right-0 h-full glass-dark p-6 overflow-y-auto z-50 transition-transform duration-300 lg:translate-x-0",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}>
                <div className="flex items-center gap-2 mb-6">
                    <Activity className="w-5 h-5 text-primary" />
                    <h2 className="font-bold text-lg">Live Activity</h2>
                    <div className="flex-1" />
                    <button onClick={onClose} className="lg:hidden p-2 text-white/60 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse lg:block hidden" />
                </div>

                {!autopilot && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <div className="text-xs font-bold text-yellow-400 mb-1">MANUAL MODE</div>
                        <div className="text-xs text-white/60">Review pending replies below</div>
                    </div>
                )}

                <div className="space-y-3">
                    <AnimatePresence initial={false}>
                        {mounted && activities.map((activity, index) => {
                            const Icon = getIcon(activity.type);
                            return (
                                <motion.div
                                    key={activity.id}
                                    initial={{ opacity: 0, x: 20, height: 0 }}
                                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                                    exit={{ opacity: 0, x: -20, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="glass p-3 rounded-xl border border-white/5 hover:border-white/20 transition-colors"
                                >
                                    <div className="flex gap-3">
                                        <div className={clsx("p-2 rounded-lg bg-white/5", getColor(activity.type))}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white/80 leading-snug mb-1">
                                                {activity.message}
                                            </p>
                                            <p className="text-xs text-white/40">{formatTime(activity.timestamp)}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </aside>
        </>
    );
}
