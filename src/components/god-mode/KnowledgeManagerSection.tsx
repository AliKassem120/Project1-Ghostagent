'use client';

import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Edit, Loader2, Save, X, Globe, Lock } from 'lucide-react';
import { fetchGodMode } from '@/lib/god-mode/api-client';

export default function KnowledgeManagerSection() {
    const [knowledge, setKnowledge] = useState<any[]>([]);
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({
        id: '',
        workspace_id: '',
        title: '',
        content: '',
        source_type: 'docs',
        visibility: 'public'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load SAAS Support / internal workspaces
            const wsRes = await fetchGodMode('workspaces');
            if (wsRes.success) {
                const internalWs = wsRes.workspaces.filter((w: any) => 
                    w.isInternal === true || 
                    w.workspaceRole === 'official_support' || 
                    w.businessType === 'saas_support'
                );
                setWorkspaces(internalWs);
                
                if (internalWs.length > 0) {
                    const officialWorkspaceId = internalWs[0].id;
                    const kRes = await fetch(`/api/god-mode/knowledge?workspaceId=${officialWorkspaceId}`);
                    const kData = await kRes.json();
                    if (kData.success) {
                        setKnowledge(kData.knowledge);
                    }
                } else {
                    setKnowledge([]);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editForm.title || !editForm.content) return;
        setLoading(true);
        try {
            const res = await fetch('/api/god-mode/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: editForm.id ? 'update' : 'create',
                    ...editForm
                })
            });
            const data = await res.json();
            if (data.success) {
                setIsEditing(false);
                loadData();
            } else {
                alert('Failed to save: ' + data.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this knowledge entry?')) return;
        setLoading(true);
        try {
            const res = await fetch('/api/god-mode/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id })
            });
            if ((await res.json()).success) {
                loadData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditForm({
            id: '',
            workspace_id: workspaces.length > 0 ? workspaces[0].id : '',
            title: '',
            content: '',
            source_type: 'docs',
            visibility: 'public'
        });
        setIsEditing(true);
    };

    const openEdit = (item: any) => {
        setEditForm({ ...item });
        setIsEditing(true);
    };

    if (loading && !isEditing && knowledge.length === 0) {
        return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Database className="w-6 h-6 text-indigo-500" />
                        Knowledge Manager (SaaS Support)
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage FAQs, pricing, and capabilities for the official GhostAgent SaaS bot.</p>
                </div>
                <button 
                    onClick={openCreate}
                    disabled={workspaces.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold transition-all text-sm disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" /> Add Document
                </button>
            </div>

            {isEditing ? (
                <div className="bg-surface-1 border border-border rounded-xl p-6 space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold">{editForm.id ? 'Edit Document' : 'New Document'}</h3>
                        <button onClick={() => setIsEditing(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Title</label>
                            <input 
                                type="text"
                                value={editForm.title}
                                onChange={e => setEditForm({...editForm, title: e.target.value})}
                                className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2"
                                placeholder="e.g. Platform Pricing"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Workspace</label>
                            <select 
                                value={editForm.workspace_id || ''}
                                onChange={e => setEditForm({...editForm, workspace_id: e.target.value})}
                                className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2"
                            >
                                {workspaces.map(w => (
                                    <option key={w.id} value={w.id}>{w.name || 'Official Support Workspace'}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Type</label>
                            <select 
                                value={editForm.source_type}
                                onChange={e => setEditForm({...editForm, source_type: e.target.value})}
                                className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2"
                            >
                                <option value="docs">Docs</option>
                                <option value="pricing">Pricing</option>
                                <option value="faq">FAQ</option>
                                <option value="manual">Manual Entry</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Visibility</label>
                            <select 
                                value={editForm.visibility}
                                onChange={e => setEditForm({...editForm, visibility: e.target.value})}
                                className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2"
                            >
                                <option value="public">Public (AI can tell anyone)</option>
                                <option value="internal_support">Internal Support (Staff Only)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Content (Markdown supported)</label>
                        <textarea 
                            value={editForm.content}
                            onChange={e => setEditForm({...editForm, content: e.target.value})}
                            className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 min-h-[300px] font-mono text-sm"
                            placeholder="GhostAgent costs $50/mo and supports Instagram and WhatsApp..."
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button 
                            onClick={handleSave}
                            disabled={loading || !editForm.title || !editForm.content}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Document
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {knowledge.map((k) => (
                        <div key={k.id} className="bg-surface-1 border border-border rounded-xl p-5 relative group hover:border-indigo-500/50 transition-all flex flex-col">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="font-bold text-foreground pr-8 line-clamp-1">{k.title}</h3>
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={() => openEdit(k)} className="p-1.5 bg-surface-2 rounded-lg text-muted-foreground hover:text-white"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(k.id)} className="p-1.5 bg-surface-2 rounded-lg text-muted-foreground hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="flex gap-2 mb-4">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-2 text-muted-foreground uppercase">{k.source_type}</span>
                                {k.visibility === 'public' 
                                    ? <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/10 text-green-400 uppercase"><Globe className="w-3 h-3" /> Public</span>
                                    : <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 uppercase"><Lock className="w-3 h-3" /> Internal</span>
                                }
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-4 font-mono leading-relaxed flex-1">
                                {k.content}
                            </p>
                        </div>
                    ))}
                    {knowledge.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                            <Database className="w-8 h-8 mx-auto mb-3 opacity-50" />
                            {workspaces.length === 0 ? (
                                <p>Create Official SaaS Bot workspace first.</p>
                            ) : (
                                <>
                                    <p>No knowledge documents found.</p>
                                    <button onClick={openCreate} className="mt-4 text-indigo-400 hover:underline">Create your first document</button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
