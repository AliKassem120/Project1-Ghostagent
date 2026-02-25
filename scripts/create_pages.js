const fs = require('fs');
const path = require('path');

const pages = [
    { dir: 'orders', title: 'Orders Management', feature: 'Orders' },
    { dir: 'shipping', title: 'Shipping & Fulfillment', feature: 'Shipping' },
    { dir: 'calendar', title: 'Calendar', feature: 'Calendar' },
    { dir: 'services', title: 'Services', feature: 'Services' },
    { dir: 'hours', title: 'Working Hours', feature: 'Working Hours' },
    { dir: 'menu', title: 'Menu Items', feature: 'Menu Items' },
    { dir: 'delivery', title: 'Delivery Zones', feature: 'Delivery Zones' },
    { dir: 'listings', title: 'Property Listings', feature: 'Listings' },
    { dir: 'crm', title: 'Lead CRM', feature: 'Lead CRM' },
    { dir: 'events', title: 'Manage Events', feature: 'Events' },
    { dir: 'guestlists', title: 'Guestlists', feature: 'Guestlists' },
    { dir: 'downloads', title: 'Digital Downloads', feature: 'Digital Downloads' },
    { dir: 'support', title: 'Support Tickets', feature: 'Support Tickets' }
];

const template = (title, feature) => `"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Page() {
    return (
        <div className="min-h-[80vh] flex flex-col relative w-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-white">${title}</h1>
                <p className="text-sm text-slate-400 mt-1">Manage your ${feature.toLowerCase()} settings and operations.</p>
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
                
                <h2 className="text-xl font-bold text-white mb-2 tracking-tight">${feature} features coming soon.</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                    We're actively working on bringing powerful ${feature.toLowerCase()} capabilities directly to your dashboard. Stay tuned!
                </p>
                
                <div className="mt-8 flex gap-3">
                    <div className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs font-mono text-purple-400">
                        In Development
                    </div>
                </div>
            </motion.div>
        </div>
    );
}`;

pages.forEach(p => {
    const dirPath = path.join('c:/Users/ali/Project1/src/app/dashboard', p.dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(path.join(dirPath, 'page.tsx'), template(p.title, p.feature), 'utf8');
});

console.log('Created all boilerplate pages.');
