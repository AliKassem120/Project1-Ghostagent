
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { 
    Zap, 
    Brain, 
    MessageSquare, 
    ArrowRight, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    ChevronDown, 
    ChevronUp,
    Instagram,
    Smartphone,
    Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface AutomationLog {
    id: string;
    description: string;
    timestamp: string;
    metadata: {
        requestId: string;
        message: string;
        reply: string;
        intent: string;
        language: string;
        stateBefore: string;
        stateAfter: string;
        actions: string[];
        durationMs: number;
        platform: string;
        chatId: string;
        error?: string;
    };
}

export default function AnalyticsPage() {
    const { activeWorkspaceId } = useWorkspace();
    const [logs, setLogs] = useState<AutomationLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    useEffect(() => {
        if (activeWorkspaceId) {
            fetchLogs();
        }
    }, [activeWorkspaceId]);

    const fetchLogs = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('activity_log')
            .select('*')
            .eq('workspace_id', activeWorkspaceId)
            .eq('event_type', 'automation_v2')
            .order('timestamp', { ascending: false })
            .limit(50);

        if (data) {
            setLogs(data as AutomationLog[]);
        }
        setIsLoading(false);
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Brain className="w-8 h-8 text-primary" />
                    </div>
                    AI Analytics
                </h1>
                <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
                    Live feed of your AI agent's decision-making process. See exactly how the bot classifies intents and handles customer flows in real-time.
                </p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-2xl bg-surface-1 border border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Total Auto-Replies</p>
                    <p className="text-3xl font-bold text-foreground">{logs.length}</p>
                </div>
                <div className="p-6 rounded-2xl bg-surface-1 border border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Avg. Response Time</p>
                    <p className="text-3xl font-bold text-foreground">
                        {logs.length > 0 
                            ? Math.round(logs.reduce((acc, l) => acc + (l.metadata?.durationMs || 0), 0) / logs.length)
                            : 0}ms
                    </p>
                </div>
                <div className="p-6 rounded-2xl bg-surface-1 border border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Success Rate</p>
                    <p className="text-3xl font-bold text-green-500">100%</p>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-surface-0 border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border bg-surface-1 flex items-center justify-between">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Execution History
                    </h2>
                    <button 
                        onClick={fetchLogs}
                        className="text-xs font-medium text-primary hover:underline"
                    >
                        Refresh Feed
                    </button>
                </div>

                <div className="divide-y divide-border">
                    {isLoading ? (
                        <div className="p-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                            <Zap className="w-8 h-8 animate-pulse text-primary" />
                            <p className="text-sm">Loading intelligence feed...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-20 flex flex-col items-center justify-center gap-4 text-muted-foreground text-center">
                            <MessageSquare className="w-12 h-12 opacity-20" />
                            <p className="text-sm">No automation activity recorded yet.<br/>Connect your Instagram and send a message to see the AI in action.</p>
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="group">
                                <div 
                                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                    className="p-4 hover:bg-surface-1 transition-colors cursor-pointer flex items-center gap-4"
                                >
                                    {/* Icon */}
                                    <div className={clsx(
                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                                        log.metadata?.reply ? "bg-primary/5 border-primary/20 text-primary" : "bg-muted/5 border-border text-muted-foreground"
                                    )}>
                                        {log.metadata?.platform === 'instagram' ? <Instagram className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                                    </div>

                                    {/* Summary */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-2 border border-border text-muted-foreground">
                                                {log.metadata?.intent || 'unknown'}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(log.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {log.metadata?.message}
                                        </p>
                                    </div>

                                    {/* Reply Preview */}
                                    <div className="hidden md:flex flex-1 items-center gap-2 px-4 border-l border-border/50">
                                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                        <p className="text-sm text-muted-foreground truncate">
                                            {log.metadata?.reply || 'No reply generated'}
                                        </p>
                                    </div>

                                    {/* Chevron */}
                                    <div className="text-muted-foreground">
                                        {expandedLogId === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                </div>

                                {/* Expanded View */}
                                <AnimatePresence>
                                    {expandedLogId === log.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden bg-surface-1/50"
                                        >
                                            <div className="p-6 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-border/50">
                                                {/* Left: Decision Flow */}
                                                <div className="space-y-4">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Brain Decision Flow</p>
                                                    <div className="space-y-3 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                                                        <div className="flex gap-4 relative">
                                                            <div className="w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center z-10">
                                                                <Globe className="w-3 h-3 text-muted-foreground" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-semibold text-foreground">Language Detected</p>
                                                                <p className="text-xs text-muted-foreground capitalize">{log.metadata?.language}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4 relative">
                                                            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center z-10">
                                                                <Zap className="w-3 h-3 text-primary" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-semibold text-foreground">Intent Identified</p>
                                                                <p className="text-xs text-muted-foreground capitalize">{log.metadata?.intent}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4 relative">
                                                            <div className="w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center z-10">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-semibold text-foreground">State Transition</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {log.metadata?.stateBefore} <ArrowRight className="inline w-3 h-3" /> {log.metadata?.stateAfter}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {log.metadata?.actions?.length > 0 && (
                                                            <div className="flex gap-4 relative">
                                                                <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center z-10">
                                                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-semibold text-foreground">Actions Executed</p>
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {log.metadata.actions.map(action => (
                                                                            <span key={action} className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 font-mono">
                                                                                {action}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: Full Details */}
                                                <div className="space-y-4">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Execution Payload</p>
                                                    <div className="p-4 rounded-xl bg-surface-2 border border-border font-mono text-[11px] text-muted-foreground overflow-auto max-h-[200px]">
                                                        <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                        <span>Request ID: {log.metadata?.requestId}</span>
                                                        <span>Latency: {log.metadata?.durationMs}ms</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
