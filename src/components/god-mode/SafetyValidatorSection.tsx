'use client';

import React, { useState } from 'react';
import { ShieldCheck, Loader2, BugPlay, CheckCircle, XCircle } from 'lucide-react';

type ValidatorMode = 'classify' | 'validate';

export default function SafetyValidatorSection() {
    const [mode, setMode] = useState<ValidatorMode>('classify');

    // ── Classify state ──
    const [message, setMessage] = useState('');
    const [workspaceType, setWorkspaceType] = useState('ecommerce');
    const [currentState, setCurrentState] = useState('idle');

    // ── Validate state ──
    const [reply, setReply] = useState('');
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [validationLanguage, setValidationLanguage] = useState('english');

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const runTest = async () => {
        setLoading(true);
        setResult(null);

        const payload: any = { action: mode };

        if (mode === 'classify') {
            if (!message.trim()) { setLoading(false); return; }
            payload.message = message;
            payload.workspaceType = workspaceType;
            payload.currentState = currentState;
        } else {
            if (!reply.trim()) { setLoading(false); return; }
            payload.reply = reply;
            payload.isConfirmed = isConfirmed;
            payload.language = validationLanguage;
        }

        try {
            const res = await fetch('/api/god-mode/safety-validator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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
                    <p className="text-sm text-muted-foreground mt-1">Test classifiers and reply validation rules.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── INPUT ───────────────────────────────────────── */}
                <div className="bg-surface-1 border border-border rounded-xl p-6 space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setMode('classify'); setResult(null); }}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'classify' ? 'bg-orange-500 text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}
                        >
                            Intent Classifier
                        </button>
                        <button
                            onClick={() => { setMode('validate'); setResult(null); }}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'validate' ? 'bg-red-500 text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}
                        >
                            Reply Validator
                        </button>
                    </div>

                    {mode === 'classify' ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Workspace Type</label>
                                <select
                                    value={workspaceType}
                                    onChange={(e) => setWorkspaceType(e.target.value)}
                                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                                >
                                    <option value="ecommerce">E-commerce</option>
                                    <option value="appointments">Appointments</option>
                                    <option value="saas_support">SaaS Support</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Conversation State</label>
                                <select
                                    value={currentState}
                                    onChange={(e) => setCurrentState(e.target.value)}
                                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                                >
                                    <option value="idle">idle (Intent Classifier)</option>
                                    <option value="awaiting_order_confirmation">awaiting_order_confirmation</option>
                                    <option value="awaiting_appointment_confirmation">awaiting_appointment_confirmation</option>
                                    <option value="awaiting_booking_confirmation">awaiting_booking_confirmation</option>
                                    <option value="collecting_info">collecting_info</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Test Message / Injection Payload</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type a message to classify..."
                                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-orange-500 resize-y"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Reply Language</label>
                                <select
                                    value={validationLanguage}
                                    onChange={(e) => setValidationLanguage(e.target.value)}
                                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500"
                                >
                                    <option value="english">English</option>
                                    <option value="arabizi">Arabizi</option>
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center gap-3 text-sm font-medium text-muted-foreground cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isConfirmed}
                                        onChange={(e) => setIsConfirmed(e.target.checked)}
                                        className="w-4 h-4 accent-red-500"
                                    />
                                    DB Write Success (isConfirmed = true)
                                </label>
                                <p className="text-xs text-muted-foreground mt-1 ml-7">
                                    When unchecked, replies containing "confirmed", "booked", etc. will be BLOCKED.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Reply Text to Validate</label>
                                <textarea
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    placeholder='e.g. "Your order has been confirmed! ✅"'
                                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-red-500 resize-y"
                                />
                            </div>
                        </>
                    )}

                    <button
                        onClick={runTest}
                        disabled={loading || (mode === 'classify' ? !message.trim() : !reply.trim())}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-bold transition-all disabled:opacity-50 ${mode === 'validate' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BugPlay className="w-5 h-5" />}
                        {mode === 'classify' ? 'Classify Payload' : 'Validate Reply'}
                    </button>
                </div>

                {/* ── OUTPUT ──────────────────────────────────────── */}
                <div className="bg-surface-1 border border-border rounded-xl overflow-hidden flex flex-col h-[560px]">
                    <div className="p-4 border-b border-border bg-surface-2 font-bold flex justify-between items-center flex-shrink-0">
                        <span>{mode === 'classify' ? 'Classifier Output' : 'Validator Output'}</span>
                        {result?.success && result.action === 'validate' && (
                            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${result.result?.isValid ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                {result.result?.isValid ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {result.result?.isValid ? 'PASSED' : 'BLOCKED'}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-black/50 font-mono text-xs text-orange-400">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-orange-500">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Testing...
                            </div>
                        ) : result ? (
                            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(result, null, 2)}</pre>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <ShieldCheck className="w-8 h-8 mb-2 opacity-50" />
                                <p>Ready for testing</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
