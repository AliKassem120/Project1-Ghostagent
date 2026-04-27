/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Appointments Services
 * ═══════════════════════════════════════════════════════════════
 * Loads and matches services from the database.
 * Supports fuzzy matching by name and aliases.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceRecord } from '../types';
import { v2log } from '../logger';

export async function loadActiveServices(
    supabase: SupabaseClient,
    workspaceId: string
): Promise<ServiceRecord[]> {
    const { data, error } = await supabase
        .from('services')
        .select('id, name, description, price, duration_minutes, is_active, aliases, category, buffer_before, buffer_after')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true);

    if (error) {
        v2log.error('V2_APPOINTMENTS_SERVICES', 'Failed to load services', { error, workspaceId });
        return [];
    }

    return (data || []).map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        price: Number(s.price),
        durationMinutes: Number(s.duration_minutes),
        isActive: s.is_active,
        aliases: s.aliases || [],
        category: s.category,
        bufferBefore: s.buffer_before || 0,
        bufferAfter: s.buffer_after || 0,
    }));
}

export function findBestServiceMatch(
    services: ServiceRecord[],
    query: string
): ServiceRecord | null {
    if (!query || services.length === 0) return null;

    const normalizedQuery = query.toLowerCase().trim();

    // 1. Exact match
    const exactMatch = services.find(s => s.name.toLowerCase() === normalizedQuery);
    if (exactMatch) return exactMatch;

    // 2. Alias exact match
    const aliasMatch = services.find(s => 
        s.aliases.some(a => a.toLowerCase() === normalizedQuery)
    );
    if (aliasMatch) return aliasMatch;

    // 3. Partial name match
    const partialMatch = services.find(s => 
        s.name.toLowerCase().includes(normalizedQuery) || 
        normalizedQuery.includes(s.name.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    // 4. Partial alias match
    const partialAliasMatch = services.find(s => 
        s.aliases.some(a => a.toLowerCase().includes(normalizedQuery) || normalizedQuery.includes(a.toLowerCase()))
    );
    if (partialAliasMatch) return partialAliasMatch;

    return null;
}
