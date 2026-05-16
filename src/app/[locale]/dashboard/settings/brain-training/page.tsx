'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function BrainTrainingPage() {
    const { activeWorkspace } = useWorkspace();
    const [file, setFile] = useState<File | null>(null);
    const [ownerName, setOwnerName] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !ownerName || !activeWorkspace) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('ownerName', ownerName);
        formData.append('workspaceId', activeWorkspace.id);

        try {
            const res = await fetch('/api/brain-training/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess(data.count);
                setFile(null);
                setOwnerName('');
            } else {
                setError(data.error || 'Upload failed');
            }
        } catch (err) {
            setError('An error occurred during upload.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold">Brain Training (Personality Clone)</h1>
                <p className="text-muted-foreground mt-2">
                    Upload your exported WhatsApp chat logs to teach GhostAgent exactly how you speak. The AI will learn your dialect, slang, and phrasing instantly.
                </p>
            </div>

            <div className="bg-surface border border-border/50 rounded-xl p-6">
                <form onSubmit={handleUpload} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Your Name in WhatsApp</label>
                        <p className="text-xs text-muted-foreground mb-3">
                            Type your name EXACTLY as it appears as the sender in the exported chat file (e.g., "Ali", "GhostAgent Support").
                        </p>
                        <input 
                            type="text" 
                            required
                            value={ownerName}
                            onChange={(e) => setOwnerName(e.target.value)}
                            placeholder="Your exact WhatsApp name"
                            className="w-full bg-background border border-border rounded-lg px-4 py-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">WhatsApp Export File (.txt)</label>
                        <p className="text-xs text-muted-foreground mb-3">
                            Open a chat on WhatsApp {'>'} Settings {'>'} Export Chat {'>'} Without Media.
                        </p>
                        <div className="relative border-2 border-dashed border-border/60 hover:border-primary/50 transition-colors rounded-xl p-8 flex flex-col items-center justify-center bg-background/50 cursor-pointer">
                            <input 
                                type="file" 
                                accept=".txt"
                                required
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {file ? (
                                <div className="flex items-center text-primary">
                                    <FileText className="w-8 h-8 mr-3" />
                                    <span className="font-medium">{file.name}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-muted-foreground">
                                    <Upload className="w-8 h-8 mb-3" />
                                    <span>Click or drag your .txt file here</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-start">
                            <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {success !== null && (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg flex items-start">
                            <CheckCircle2 className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-sm">Training Complete!</p>
                                <p className="text-xs mt-1">Successfully extracted {success} conversation pairs. The AI will start using this style immediately.</p>
                            </div>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading || !file || !ownerName}
                        className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Upload className="w-5 h-5 mr-2" />}
                        {loading ? 'Processing...' : 'Upload & Train Brain'}
                    </button>
                </form>
            </div>
        </div>
    );
}
