'use client';

import React, { useState } from 'react';
import { ShieldCheck, Loader2, BugPlay } from 'lucide-react';

export default function SafetyValidatorSection() {
    const [message, setMessage] = useState('');
    const [workspaceType, setWorkspaceType] = useState('ecommerce');
    const [currentState, setCurrentState] = useState('idle');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const runValidation = async () => {
        if (!message.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/god-mode/safety-validator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, workspaceType, currentState })
            });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setResult({ success: false, error: 'Network error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-orange-500" />
                        Safety Validator
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Test prompt injections and classification validations.</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface-1 border border-border rounded-xl p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Context / Workspace Type</label>
                        <select 
                            value={workspaceType}
                            onChange={(e) => setWorkspaceType(e.target.value)}
                            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                        >
                            <option value="ecommerce">E-commerce</option>
                            <option value="appointments">Appointments</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Simulated Conversation State</label>
                        <select 
                            value={currentState}
                            onChange={(e) => setCurrentState(e.target.value)}
                            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                        >
                            <option value="idle">idle (Runs Intent Classifier)</option>
                            <option value="awaiting_order_confirmation">awaiting_order_confirmation</option>
                            <option value="awaiting_appointment_confirmation">awaiting_appointment_confirmation</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Test Message / Injection Payload</label>
                        <textarea 
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type a message or potential prompt injection attack..."
                            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm min-h-[120px] focus:outline-none focus:border-orange-500 resize-y"
                        />
                    </div>

                    <button 
                        onClick={runValidation}
                        disabled={loading || !message.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BugPlay className="w-5 h-5" />}
                        Validate Payload
                    </button>
                </div>

                <div className="bg-surface-1 border border-border rounded-xl overflow-hidden flex flex-col h-[500px]">
                    <div className="p-4 border-b border-border bg-surface-2 font-bold">
                        Validator Output
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-black/50 font-mono text-xs text-orange-400">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-orange-500">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Validating...
                            </div>
                        ) : result ? (
                            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(result, null, 2)}</pre>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <ShieldCheck className="w-8 h-8 mb-2 opacity-50" />
                                <p>Ready for validation</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
