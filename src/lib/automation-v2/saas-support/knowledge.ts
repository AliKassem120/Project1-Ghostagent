import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '../logger';

export interface SaasKnowledgeRecord {
    id: string;
    title: string;
    content: string;
    sourceType: string;
    visibility: string;
}

export async function searchSaasKnowledge(
    supabase: SupabaseClient,
    workspaceId: string,
    query?: string
): Promise<SaasKnowledgeRecord[]> {
    try {
        let dbQuery = supabase
            .from('business_knowledge')
            .select('id, title, content, source_type, visibility')
            .in('visibility', ['public']);
        
        // Scope to workspace if specified, or global if not
        if (workspaceId) {
            dbQuery = dbQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
        } else {
            dbQuery = dbQuery.is('workspace_id', null);
        }

        // Extremely simple keyword filtering for now
        // A real system would use pgvector/embeddings
        if (query) {
            const terms = query.toLowerCase().split(' ').filter(t => t.length > 2);
            if (terms.length > 0) {
                const ilikeConditions = terms.map(t => `content.ilike.%${t}%,title.ilike.%${t}%`).join(',');
                dbQuery = dbQuery.or(ilikeConditions);
            }
        }

        const { data, error } = await dbQuery.limit(5);

        if (error) {
            v2log.error('SAAS_KNOWLEDGE', 'Search failed', { error });
            return [];
        }

        return (data || []).map(row => ({
            id: row.id,
            title: row.title,
            content: row.content,
            sourceType: row.source_type,
            visibility: row.visibility
        }));
    } catch (err) {
        v2log.error('SAAS_KNOWLEDGE', 'Exception in search', { err });
        return [];
    }
}
