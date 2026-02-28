"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Page() {
    return (
        <div className="min-h-[80vh] flex flex-col relative w-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Delivery Zones</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your delivery zones settings and operations.</p>
            </div>
            
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-surface-1 border border-border shadow-sm rounded-2xl  flex flex-col items-center justify-center p-12 text-center relative overflow-hidden "
            >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
                
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 relative">
                    <Sparkles className="w-8 h-8 text-purple-400 relative z-10" />
                </div>
                
                <h2 className="text-xl font-bold text-foreground mb-2 tracking-tight">Delivery Zones features coming soon.</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    We're actively working on bringing powerful delivery zones capabilities directly to your dashboard. Stay tuned!
                </p>
                
                <div className="mt-8 flex gap-3">
                    <div className="px-4 py-2 rounded-xl bg-surface-2 border border-border text-xs font-mono text-purple-400">
                        In Development
                    </div>
                </div>
            </motion.div>
        </div>
    );
}