"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Page() {
    return (
        <div className="min-h-[80vh] flex flex-col relative w-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-white">Lead CRM</h1>
                <p className="text-sm text-slate-400 mt-1">Manage your lead crm settings and operations.</p>
            </div>
            
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 glass-card rounded-2xl border border-white/[0.04] flex flex-col items-center justify-center p-12 text-center relative overflow-hidden bg-slate-900/50"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
                
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 relative">
                    <Sparkles className="w-8 h-8 text-purple-400 relative z-10" />
                </div>
                
                <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Lead CRM features coming soon.</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                    We're actively working on bringing powerful lead crm capabilities directly to your dashboard. Stay tuned!
                </p>
                
                <div className="mt-8 flex gap-3">
                    <div className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs font-mono text-purple-400">
                        In Development
                    </div>
                </div>
            </motion.div>
        </div>
    );
}