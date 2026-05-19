import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Searches public SaaS knowledge entries for a workspace.
 */
export async function searchSaasKnowledge(
    supabase: SupabaseClient,
    workspaceId: string,
    query: string
) {
    const { data, error } = await supabase
        .from('business_knowledge')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('visibility', 'public')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        throw error;
    }
    return data || [];
}
