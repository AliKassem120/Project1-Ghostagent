'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Ghost, Lock, Loader2 } from 'lucide-react';
import GodModeShell, { GOD_MODE_TABS } from '@/components/god-mode/GodModeShell';
import OverviewSection from '@/components/god-mode/OverviewSection';
import WorkspacesSection from '@/components/god-mode/WorkspacesSection';
import StatesSection from '@/components/god-mode/StatesSection';
import LogsSection from '@/components/god-mode/LogsSection';
import OrdersSection from '@/components/god-mode/OrdersSection';
import AppointmentsSection from '@/components/god-mode/AppointmentsSection';
import ControlsSection from '@/components/god-mode/ControlsSection';
import BrainDebuggerSection from '@/components/god-mode/BrainDebuggerSection';
import ConversationInspectorSection from '@/components/god-mode/ConversationInspectorSection';
import CommentsDebuggerSection from '@/components/god-mode/CommentsDebuggerSection';
import SafetyValidatorSection from '@/components/god-mode/SafetyValidatorSection';
import KnowledgeManagerSection from '@/components/god-mode/KnowledgeManagerSection';
import OfficialSaasBotSection from '@/components/god-mode/OfficialSaasBotSection';

export default function GodModePage() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(GOD_MODE_TABS[0].id);

    useEffect(() => {
        // Check session storage first
        const auth = sessionStorage.getItem('god_mode_auth');
        if (auth === 'true') {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                sessionStorage.setItem('god_mode_auth', 'true');
                setIsAuthenticated(true);
            } else {
                setError('Invalid credentials');
            }
        } catch (err) {
            setError('Login failed');
        } finally {
            setLoading(false);
        }
    };

    if (isAuthenticated === null) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
                {/* Background glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/20 blur-[120px] rounded-full pointer-events-none" />
                
                <div className="w-full max-w-md bg-[#0a0a0a] border border-red-900/50 p-8 rounded-2xl shadow-2xl relative z-10 backdrop-blur-xl">
                    <div className="flex justify-center mb-8">
                        <div className="p-4 bg-red-950/30 rounded-2xl border border-red-900/50 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
                            <Lock className="w-10 h-10 text-red-500" />
                        </div>
                    </div>
                    
                    <h1 className="text-3xl font-black text-center mb-2 tracking-tight bg-gradient-to-br from-white to-red-200 bg-clip-text text-transparent">
                        GOD MODE
                    </h1>
                    <p className="text-center text-red-500/80 text-sm mb-8 font-medium tracking-wide">RESTRICTED ACCESS</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="text"
                                placeholder="Admin ID"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-black/50 border border-red-900/50 rounded-xl px-4 py-3 text-white placeholder-red-900/50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono text-sm"
                                required
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="Passcode"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/50 border border-red-900/50 rounded-xl px-4 py-3 text-white placeholder-red-900/50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono text-sm"
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm text-center bg-red-950/50 py-2 rounded-lg border border-red-900/50">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'AUTHORIZE'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <GodModeShell activeTab={activeTab} onTabChange={setActiveTab}>
            <div className="max-w-[1400px] mx-auto">
                {activeTab === 'overview' && <OverviewSection />}
                {activeTab === 'workspaces' && <WorkspacesSection />}
                {activeTab === 'states' && <StatesSection />}
                {activeTab === 'logs' && <LogsSection />}
                {activeTab === 'orders' && <OrdersSection />}
                {activeTab === 'appointments' && <AppointmentsSection />}
                {activeTab === 'brain_debugger' && <BrainDebuggerSection />}
                {activeTab === 'conv_inspector' && <ConversationInspectorSection />}
                {activeTab === 'comments_debugger' && <CommentsDebuggerSection />}
                {activeTab === 'safety_validator' && <SafetyValidatorSection />}
                {activeTab === 'knowledge_manager' && <KnowledgeManagerSection />}
                {activeTab === 'official_saas_bot' && <OfficialSaasBotSection />}
                {activeTab === 'controls' && <ControlsSection />}
            </div>
        </GodModeShell>
    );
}
