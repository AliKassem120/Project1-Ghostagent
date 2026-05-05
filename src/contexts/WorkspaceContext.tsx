'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BusinessCategory } from '@/components/BusinessTypeSelector';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlanTier = 'free_trial' | 'starter' | 'pro' | 'empire';
export type WorkspaceStatus = 'loading' | 'needs_setup' | 'connected' | 'live';

export interface Workspace {
    id: string;
    user_id: string;
    name: string;
    business_type: BusinessCategory;
    instagram_account_id?: string | null;
    instagram_username?: string | null;
    created_at?: string;
}

interface WorkspaceContextType {
    workspaces: Workspace[];
    activeWorkspaceId: string | null;
    activeWorkspace: Workspace | null;
    planTier: PlanTier | null;
    workspaceLimit: number;
    canAddWorkspace: boolean;
    upgradeMessage: string | null;
    workspaceStatus: WorkspaceStatus;
    isLoading: boolean;
    setActiveWorkspace: (id: string) => void;
    addWorkspace: (workspace: Workspace) => void;
    removeWorkspace: (id: string) => void;
    refreshWorkspaces: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise the messy plan_tier strings from the DB */
function normalisePlan(raw: string | null | undefined): PlanTier {
    if (!raw) return 'free_trial';
    const v = raw.toLowerCase().trim();
    if (v === 'empire') return 'empire';
    if (v === 'pro' || v === 'pro agent') return 'pro';
    if (v === 'starter') return 'starter';
    return 'free_trial';
}

const WORKSPACE_LIMITS: Record<PlanTier, number> = {
    free_trial: 1,
    starter: 1,
    pro: 1, // Only Empire gets multi-account
    empire: 5,
};

function getUpgradeMessage(plan: PlanTier, count: number): string | null {
    const limit = WORKSPACE_LIMITS[plan];
    if (count < limit) return null;
    
    if (plan === 'starter' || plan === 'free_trial') return 'Upgrade to Pro to unlock features';
    if (plan === 'pro') return 'Multi-account is an Empire-level move. Time to conquer 👑';
    if (plan === 'empire') return '5 Brands Max. You already own the world 🌍';
    
    return null;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const LS_KEY = 'ghost_active_workspace';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [planTier, setPlanTier] = useState<PlanTier | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const fetchWorkspaces = useCallback(async (isSilent = false) => {
        if (!user?.id) return;
        if (!isSilent) setIsLoading(true);

        // Fetch plan tier + workspaces in parallel
        const [userRes, wsRes, igRes] = await Promise.all([
            supabase.from('users').select('plan_tier, business_type').eq('id', user.id).single(),
            supabase
                .from('ai_settings')
                .select('id, user_id, name, business_type, created_at')
                .eq('user_id', user.id)
                .is('is_internal', false)
                .order('created_at', { ascending: true }),
            supabase
                .from('instagram_integrations')
                .select('workspace_id, instagram_account_id, account_username')
        ]);

        const plan = normalisePlan(userRes.data?.plan_tier);
        setPlanTier(plan);

        // Redirect new signups to onboarding before rendering dashboard
        if ((!wsRes.data || wsRes.data.length === 0) && !userRes.data?.business_type) {
            router.push('/onboarding');
            return;
        }

        // Filter connections by their specific workspace_id
        const igConnections: Array<{ workspace_id: string; instagram_account_id: string; account_username: string }> = igRes.data || [];

        const rows: Workspace[] = (wsRes.data || []).map((r: any) => {
            const igMatch = igConnections.find(ig => ig.workspace_id === r.id);
            return {
                id: r.id,
                user_id: r.user_id,
                name: r.name || 'My Store',
                business_type: (r.business_type || 'ecommerce') as BusinessCategory,
                instagram_account_id: igMatch?.instagram_account_id || null,
                instagram_username: igMatch?.account_username || null,
                created_at: r.created_at,
            }
        });

        setWorkspaces(rows);

        // Restore persisted active workspace or default to first
        const persisted = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
        const validId = rows.find(w => w.id === persisted)?.id ?? rows[0]?.id ?? null;
        setActiveWorkspaceId(validId);
        if (validId && typeof window !== 'undefined') localStorage.setItem(LS_KEY, validId);

        setIsLoading(false);
        setIsInitialLoad(false);
    }, [user?.id, router]);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    // Background sync on window focus (to catch checkout/plan updates)
    useEffect(() => {
        const handleFocus = () => fetchWorkspaces(true);
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchWorkspaces]);

    const setActiveWorkspace = useCallback((id: string) => {
        setActiveWorkspaceId(id);
        if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, id);
    }, []);

    const addWorkspace = useCallback((ws: Workspace) => {
        setWorkspaces(prev => [...prev, ws]);
        setActiveWorkspace(ws.id);
    }, [setActiveWorkspace]);

    const removeWorkspace = useCallback((id: string) => {
        setWorkspaces(prev => {
            const next = prev.filter(w => w.id !== id);
            if (activeWorkspaceId === id) {
                const nextId = next[0]?.id ?? null;
                setActiveWorkspaceId(nextId);
                if (nextId && typeof window !== 'undefined') {
                    localStorage.setItem(LS_KEY, nextId);
                } else if (typeof window !== 'undefined') {
                    localStorage.removeItem(LS_KEY);
                }
            }
            return next;
        });
    }, [activeWorkspaceId]);

    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) ?? null;
    const workspaceLimit = planTier ? WORKSPACE_LIMITS[planTier] : 1;
    const canAddWorkspace = planTier ? workspaces.length < workspaceLimit : false;
    const upgradeMessage = planTier ? getUpgradeMessage(planTier, workspaces.length) : null;

    // Compute workspace connection status
    const workspaceStatus: WorkspaceStatus = (() => {
        if (isLoading || planTier === null) return 'loading';
        if (!activeWorkspace) return 'needs_setup';
        const hasInstagram = !!(activeWorkspace.instagram_username && activeWorkspace.instagram_account_id);
        if (!hasInstagram) return 'needs_setup';
        return 'connected'; // Dashboard combines with autopilot for 'live' display
    })();

    return (
        <WorkspaceContext.Provider value={{
            workspaces,
            activeWorkspaceId,
            activeWorkspace,
            planTier,
            workspaceLimit,
            canAddWorkspace,
            upgradeMessage,
            workspaceStatus,
            isLoading,
            setActiveWorkspace,
            addWorkspace,
            removeWorkspace,
            refreshWorkspaces: () => fetchWorkspaces(true),
        }}>
            {isLoading && isInitialLoad ? (
                <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                    <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                </div>
            ) : children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
    return ctx;
}
