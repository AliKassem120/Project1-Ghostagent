'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Edit2, Share, Loader2 } from 'lucide-react';
import { approveInteraction } from '@/app/actions/agent';

type Interaction = {
    id: number;
    user: string;
    avatar: string;
    comment: string;
    product_interest?: string;
    status: 'pending' | 'approved' | 'replied';
    timestamp: string;
    response?: string;
};

const MOCK_INTERACTIONS: Interaction[] = [];

export default function InteractionsPage() {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const handleApprove = async (id: number, comment: string) => {
        setProcessingId(id);
        try {
            const result = await approveInteraction(id, comment);

            setInteractions(prev => prev.map(item =>
                item.id === id ? { ...item, status: 'approved', response: result.response } : item
            ));
        } catch (error) {
            console.error("Failed to approve:", error);
            alert("Failed to process interaction");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Live Feed</h1>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">Listening to Comments</span>
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
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex-shrink-0" />

                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-lg">{interaction.user}</h3>
                                    <p className="text-white/60 text-sm">{interaction.timestamp}</p>
                                </div>
                                {interaction.status === 'approved' && (
                                    <span className="text-green-400 flex items-center gap-1 text-xs bg-green-500/10 px-2 py-1 rounded">
                                        <Check className="w-3 h-3" /> Replied
                                    </span>
                                )}
                            </div>

                            <p className="bg-white/5 p-3 rounded-lg text-white/90 mb-3 border border-white/5">
                                "{interaction.comment}"
                            </p>

                            {interaction.response && (
                                <div className="mb-3 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary">
                                    <span className="font-bold">Agent:</span> {interaction.response}
                                </div>
                            )}

                            {interaction.product_interest && (
                                <div className="text-xs text-primary mb-4 flex items-center gap-2">
                                    <Share className="w-3 h-3" /> Detected Interest: <span className="font-bold underline">{interaction.product_interest}</span>
                                </div>
                            )}

                            {interaction.status === 'pending' && (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleApprove(interaction.id, interaction.comment)}
                                        disabled={processingId === interaction.id}
                                        className="flex-1 bg-primary text-black font-bold py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {processingId === interaction.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" /> Approve Reply
                                            </>
                                        )}
                                    </button>
                                    <button className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
