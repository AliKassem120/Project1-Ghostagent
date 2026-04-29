"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
    Users, ShieldAlert, DollarSign, Activity, 
    MessageSquare, AlertCircle, Loader2, ArrowLeft,
    TrendingUp, BadgeCheck, Zap, Server
} from "lucide-react";
import GhostLogo from "@/components/GhostLogo";
import StarBackground from "@/components/StarBackground";
import { getGodModeData } from "@/app/actions/admin";
import { toast } from "sonner";
import clsx from "clsx";

export default function GodModeDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await getGodModeData();
                if (!res.success) {
                    setError(res.error || "Failed to load admin data");
                    toast.error("Unauthorized: " + res.error);
                } else {
                    setData(res);
                }
            } catch (err: any) {
                setError(err.message);
                toast.error("Access Denied");
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
                <StarBackground />
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 relative">
                        <div className="absolute inset-0 bg-red-500/20 rounded-2xl blur-xl animate-pulse" />
                        <div className="relative bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                            <GhostLogo className="w-8 h-8 text-red-500" />
                        </div>
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                        <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                        <span className="text-sm font-mono text-red-400 tracking-widest">AUTHENTICATING_GOD_MODE...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data?.success) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
                <StarBackground />
                <div className="bg-surface-1 border border-red-500/20 shadow-2xl shadow-red-500/10 rounded-3xl p-8 max-w-md w-full text-center relative z-10">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
                    <p className="text-muted-foreground text-sm mb-8">
                        You do not have god mode privileges. Your IP has been logged.
                    </p>
                    <button 
                        onClick={() => router.push('/dashboard')}
                        className="w-full py-3 bg-surface-2 hover:bg-surface-3 transition-colors rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Return to Safety
                    </button>
                </div>
            </div>
        );
    }

    const { metrics, users } = data;

    return (
        <div className="min-h-screen bg-background relative selection:bg-red-500/30">
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-red-500/20 blur-[120px] rounded-full translate-y-[-50%]" />
            </div>
            
            {/* Navbar */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-red-500/10">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <GhostLogo className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <div className="font-bold text-foreground tracking-tight leading-none bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">GOD MODE</div>
                            <div className="text-[10px] text-red-400/60 font-mono tracking-widest mt-1">GHOST AGENT COMMAND CENTER</div>
                        </div>
                    </div>
                    <button onClick={() => router.push('/dashboard')} className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors py-2 px-4 rounded-lg hover:bg-surface-2 border border-transparent hover:border-border">
                        Exit God Mode
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8 relative z-10">
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard 
                        icon={DollarSign} title="Estimated MRR" value={`$${metrics.totalMRR}`} 
                        trend="+12%" color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20"
                    />
                    <MetricCard 
                        icon={Users} title="Total Users" value={metrics.totalUsers.toString()} 
                        trend="All Time" color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20"
                    />
                    <MetricCard 
                        icon={Zap} title="Active Integrations" value={metrics.activeBots.toString()} 
                        trend="Insta + WA" color="text-amber-400" bg="bg-amber-500/10" border="border-amber-500/20"
                    />
                    <MetricCard 
                        icon={MessageSquare} title="AI Messages Sent" value={metrics.totalReplies.toLocaleString()} 
                        trend="Platform Wide" color="text-purple-400" bg="bg-purple-500/10" border="border-purple-500/20"
                    />
                </div>

                {/* Users Table */}
                <div className="bg-surface-1 border border-red-500/10 shadow-2xl shadow-red-500/5 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-red-500/10 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Global User Registry</h2>
                            <p className="text-xs text-muted-foreground font-mono mt-1">System accounts and billing status</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold tracking-widest uppercase">
                                Live Data
                            </span>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-surface-2 border-b border-border">
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">User Info</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Plan</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Joined</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Bot Activity</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Orders</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.02]">
                                {users.map((u: any, i: number) => (
                                    <tr key={u.id} className="hover:bg-red-500/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center font-bold text-xs text-muted-foreground uppercase">
                                                    {u.name?.charAt(0) || u.email?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm text-foreground">{u.name}</div>
                                                    <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <PlanBadge plan={u.plan} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-foreground">{new Date(u.created_at).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{u.id.split('-')[0]}***</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                {u.ig_accounts > 0 && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                        <Activity className="w-3 h-3" /> {u.ig_accounts} Linked
                                                    </span>
                                                )}
                                                <span className="font-mono text-sm text-muted-foreground">{u.bot_replies}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-mono text-foreground font-semibold">
                                            {u.orders_processed}
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            No users found in database.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, value, trend, color, bg, border }: any) {
    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={clsx("p-6 rounded-2xl border bg-surface-1 shadow-sm relative overflow-hidden group", border)}>
            <div className={clsx("absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-40", bg)} />
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={clsx("p-2 rounded-xl", bg)}>
                    <Icon className={clsx("w-5 h-5", color)} />
                </div>
                {trend && (
                    <span className="text-[10px] font-bold text-muted-foreground bg-surface-2 px-2 py-1 rounded-full border border-border">
                        {trend}
                    </span>
                )}
            </div>
            <div className="relative z-10">
                <div className="text-2xl font-bold text-foreground tracking-tight font-mono">{value}</div>
                <div className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">{title}</div>
            </div>
        </motion.div>
    );
}

function PlanBadge({ plan }: { plan: string }) {
    const p = plan?.toLowerCase() || 'free_trial';
    if (p === 'empire') {
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]">Empire</span>;
    }
    if (p === 'pro' || p === 'pro agent') {
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Pro</span>;
    }
    if (p === 'starter') {
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">Starter</span>;
    }
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-surface-2 text-muted-foreground border border-border">Trial</span>;
}
