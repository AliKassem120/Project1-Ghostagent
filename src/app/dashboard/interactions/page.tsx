'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Edit2, Share, Loader2, MessageCircle } from 'lucide-react';
import { approveInteraction } from '@/app/actions/agent';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/utils/supabase/client';

type Interaction = {
    id: number | string;
    user: string;
    avatar: string;
    comment: string;
    product_interest?: string;
    status: 'pending' | 'approved' | 'replied' | 'info';
    timestamp: string;
    response?: string;
    type?: string;
};

export default function InteractionsPage() {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [processingId, setProcessingId] = useState<number | string | null>(null);
    const toast = useToast();
    const supabase = createClient();

    useEffect(() => {
        const fetchInteractions = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch activity logs
            const { data: logs } = await supabase
                .from('activity_log')
                .select('*')
                .eq('user_id', user.id)
                .order('timestamp', { ascending: false })
                .limit(50); // Show last 50

            if (logs) {
                const mappedInteractions: Interaction[] = logs.map(log => {
                    const isDM = log.event_type === 'INCOMING_DM';
                    const isReply = log.event_type === 'AI_REPLY';

                    // Parse description for display
                    let content = log.description;
                    let userName = 'User';

                    if (isDM && log.description.includes('from')) {
                        const parts = log.description.split('from');
                        userName = parts[parts.length - 1].trim();
                        content = parts.slice(0, parts.length - 1).join('from').replace('Received:', '').replace(/"/g, '').trim();
                    }

                    return {
                        id: log.id,
                        user: userName,
                        avatar: '', // Placeholder
                        comment: content,
                        status: isReply ? 'replied' : 'info',
                        timestamp: new Date(log.timestamp).toLocaleString(),
                        type: log.event_type
                    };
                });
                setInteractions(mappedInteractions);
            }

            // Realtime Subscription
            const channel = supabase
                .channel('interactions-page')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `user_id=eq.${user.id}` },
                    (payload) => {
                        fetchInteractions(); // Refetch or prepend manually
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        fetchInteractions();
    }, []);

    const handleApprove = async (id: number | string, comment: string) => {
        // ... kept for future generic approval logic
        toast.info("This interaction is already processed.");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Interactions</h1>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">Auto-Listening</span>
                </div>
            </div>

            <div className="grid gap-4">
                {interactions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="flex items-center gap-2 h-16 mb-8">
                            {[...Array(5)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    animate={{ height: ["20%", "100%", "20%"] }}
                                    transition={{
                                        duration: 0.8 + Math.random() * 0.5,
                                        repeat: Infinity,
                                        delay: i * 0.1,
                                        ease: "easeInOut"
                                    }}
                                    className="w-2 bg-purple-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                                />
                            ))}
                        </div>
                        <div className="text-purple-400 font-mono text-sm uppercase tracking-widest animate-pulse">
                            Channel Open<br />Awaiting transmission...
                        </div>
                    </div>
                )}
                {interactions.map((interaction) => (
                    <div key={interaction.id} className="glass-dark p-6 rounded-2xl flex items-start gap-4 hover:border-white/20 transition-colors group">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex-shrink-0 flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-white" />
                        </div>

                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-lg">{interaction.user}</h3>
                                    <p className="text-white/60 text-sm">{interaction.timestamp}</p>
                                </div>
                                <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${interaction.type === 'AI_REPLY' ? 'text-green-400 bg-green-500/10' : 'text-blue-400 bg-blue-500/10'
                                    }`}>
                                    {interaction.type === 'AI_REPLY' ? 'Sent' : 'Received'}
                                </span>
                            </div>

                            <p className="bg-white/5 p-3 rounded-lg text-white/90 mb-3 border border-white/5">
                                "{interaction.comment}"
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
