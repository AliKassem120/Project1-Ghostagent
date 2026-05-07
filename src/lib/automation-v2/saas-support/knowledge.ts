import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '../logger';

export interface SaasKnowledgeRecord {
    id: string;
    title: string;
    content: string;
    sourceType: string;
    visibility: string;
}

/**
 * Search the SaaS knowledge base for the official GhostAgent workspace.
 * 
 * Strategy:
 * 1. If a query is provided, search by keyword match in title/content
 * 2. If keyword search returns 0 results, fall back to fetching ALL public docs
 *    for the workspace (the knowledge base is small enough for this)
 * 3. Always log search parameters and results for debugging
 */
export async function searchSaasKnowledge(
    supabase: SupabaseClient,
    workspaceId: string,
    query?: string
): Promise<SaasKnowledgeRecord[]> {
    v2log.info('SAAS_KNOWLEDGE', 'Search started', {
        workspaceId,
        query: query || '(none)',
    });

    try {
        // ── Step 1: Try keyword search if query is provided ──
        if (query) {
            const terms = query.toLowerCase().split(' ').filter(t => t.length > 2);
            
            if (terms.length > 0) {
                const ilikeConditions = terms.map(t => `content.ilike.%${t}%,title.ilike.%${t}%`).join(',');

                const { data, error } = await supabase
                    .from('business_knowledge')
                    .select('id, title, content, source_type, visibility')
                    .eq('workspace_id', workspaceId)
                    .eq('visibility', 'public')
                    .or(ilikeConditions)
                    .limit(5);

                if (error) {
                    v2log.error('SAAS_KNOWLEDGE', 'Keyword search failed', { error, workspaceId, query });
                } else if (data && data.length > 0) {
                    v2log.info('SAAS_KNOWLEDGE', `Keyword search: ${data.length} results`, {
                        workspaceId,
                        query,
                        matchedTitles: data.map(r => r.title),
                    });
                    return mapResults(data);
                }

                v2log.info('SAAS_KNOWLEDGE', 'Keyword search returned 0 results, falling back to full docs', {
                    workspaceId,
                    query,
                    terms,
                });
            }
        }

        // ── Step 2: Fallback — fetch ALL public docs for this workspace ──
        const { data: allDocs, error: allDocsError } = await supabase
            .from('business_knowledge')
            .select('id, title, content, source_type, visibility')
            .eq('workspace_id', workspaceId)
            .eq('visibility', 'public')
            .order('created_at', { ascending: false })
            .limit(5);

        if (allDocsError) {
            v2log.error('SAAS_KNOWLEDGE', 'Fallback fetch failed', { error: allDocsError, workspaceId });
            return [];
        }

        v2log.info('SAAS_KNOWLEDGE', `Fallback fetch: ${(allDocs || []).length} docs`, {
            workspaceId,
            matchedTitles: (allDocs || []).map(r => r.title),
        });

        return mapResults(allDocs || []);

    } catch (err) {
        v2log.error('SAAS_KNOWLEDGE', 'Exception in search', { err, workspaceId, query });
        return [];
    }
}

function mapResults(data: any[]): SaasKnowledgeRecord[] {
    return data.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        sourceType: row.source_type,
        visibility: row.visibility,
    }));
}
