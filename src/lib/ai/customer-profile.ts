/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Customer Profile (Cross-Channel Identity)
 * ═══════════════════════════════════════════════════════════════
 * Persistent customer identity linking across Instagram + WhatsApp.
 *
 * When a customer provides their phone number during a conversation
 * on Instagram, this module searches for existing WhatsApp profiles
 * sharing the same phone → merges them into a unified identity.
 *
 * Uses the `customer_profiles` table created in Phase 2 migration.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '@/lib/ai/logger';

// ── Customer Profile Interface ───────────────────────────────

export interface CustomerProfile {
    id: string;
    workspaceId: string;
    phone?: string;
    instagramChatId?: string;
    whatsappChatId?: string;
    name?: string;
    email?: string;
    tags: string[];
    totalOrders: number;
    totalAppointments: number;
    firstInteractionAt: string;
    lastInteractionAt: string;
    metadata: Record<string, any>;
}

// ── Load Customer Profile ────────────────────────────────────

/**
 * Load the customer profile for a specific chat ID on a given platform.
 * Searches by (workspace_id, platform_chat_id) first.
 * If not found, returns null — the caller should create one via upsert.
 */
export async function loadCustomerProfile(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string,
    platform: 'instagram' | 'whatsapp'
): Promise<CustomerProfile | null> {
    try {
        const column = platform === 'instagram' ? 'instagram_chat_id' : 'whatsapp_chat_id';

        const { data, error } = await supabase
            .from('customer_profiles')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq(column, chatId)
            .maybeSingle();

        if (error) {
            v2log.warn('CUSTOMER_PROFILE', 'Load failed', { error, workspaceId, chatId, platform });
            return null;
        }

        if (!data) return null;

        return mapRowToProfile(data);
    } catch (err) {
        v2log.warn('CUSTOMER_PROFILE', 'Load exception', { err });
        return null;
    }
}

// ── Upsert Customer Profile ──────────────────────────────────

/**
 * Create or update a customer profile for a specific chat ID.
 * Only updates fields that are provided — never overwrites with null.
 */
export async function upsertCustomerProfile(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string,
    platform: 'instagram' | 'whatsapp',
    data: Partial<CustomerProfile>
): Promise<CustomerProfile | null> {
    try {
        const column = platform === 'instagram' ? 'instagram_chat_id' : 'whatsapp_chat_id';
        const nowISO = new Date().toISOString();

        // Build the upsert payload — only include non-null fields
        const payload: Record<string, any> = {
            workspace_id: workspaceId,
            [column]: chatId,
            last_seen: nowISO,
        };

        if (data.name) payload.name = data.name;
        if (data.phone) payload.phone = data.phone;
        if (data.email) payload.email = data.email;
        if (data.tags && data.tags.length > 0) payload.tags = JSON.stringify(data.tags);
        if (data.totalOrders !== undefined) payload.total_orders = data.totalOrders;
        if (data.totalAppointments !== undefined) payload.total_appointments = data.totalAppointments;
        if (data.metadata) payload.metadata = data.metadata;

        // Determine the correct unique constraint for upsert
        const onConflict = platform === 'instagram'
            ? 'workspace_id,instagram_chat_id'
            : 'workspace_id,whatsapp_chat_id';

        const { data: row, error } = await supabase
            .from('customer_profiles')
            .upsert(payload, { onConflict, ignoreDuplicates: false })
            .select('*')
            .maybeSingle();

        if (error) {
            v2log.warn('CUSTOMER_PROFILE', 'Upsert failed', { error, workspaceId, chatId, platform });
            return null;
        }

        if (!row) return null;

        v2log.info('CUSTOMER_PROFILE', 'Profile upserted', {
            profileId: row.id,
            chatId,
            platform,
            fields: Object.keys(payload),
        });

        // If a phone was provided, attempt cross-channel linking
        if (data.phone) {
            await linkProfilesByPhone(supabase, workspaceId, data.phone).catch(err => {
                v2log.warn('CUSTOMER_PROFILE', 'Auto-link by phone failed', { err });
            });
        }

        // If a name was provided, attempt cross-channel name linking
        if (data.name) {
            await linkProfilesByName(supabase, workspaceId, data.name).catch(err => {
                v2log.warn('CUSTOMER_PROFILE', 'Auto-link by name failed', { err });
            });
        }

        return mapRowToProfile(row);
    } catch (err) {
        v2log.warn('CUSTOMER_PROFILE', 'Upsert exception', { err });
        return null;
    }
}

// ── Cross-Channel Phone Linking ──────────────────────────────

/**
 * Link separate profiles that share the same phone number within
 * a workspace. Merges the newer profile into the older one,
 * combining instagram_chat_id and whatsapp_chat_id into a single row.
 *
 * This enables seamless cross-channel continuity:
 *   Customer on IG DM provides phone → we find their WA profile
 *   → merge into one → future WA messages load IG history too.
 */
export async function linkProfilesByPhone(
    supabase: SupabaseClient,
    workspaceId: string,
    phone: string
): Promise<void> {
    if (!phone) return;

    try {
        // Find all profiles with this phone in this workspace
        const { data: profiles, error } = await supabase
            .from('customer_profiles')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('phone', phone)
            .order('first_seen', { ascending: true });

        if (error || !profiles || profiles.length <= 1) return;

        // The oldest profile is the primary (has the most history)
        const primary = profiles[0];
        const duplicates = profiles.slice(1);

        for (const dupe of duplicates) {
            // Merge platform IDs into the primary
            const updates: Record<string, any> = {};

            if (dupe.instagram_chat_id && !primary.instagram_chat_id) {
                updates.instagram_chat_id = dupe.instagram_chat_id;
            }
            if (dupe.whatsapp_chat_id && !primary.whatsapp_chat_id) {
                updates.whatsapp_chat_id = dupe.whatsapp_chat_id;
            }
            if (dupe.name && !primary.name) {
                updates.name = dupe.name;
            }
            if (dupe.email && !primary.email) {
                updates.email = dupe.email;
            }

            // Sum counters
            updates.total_orders = (primary.total_orders || 0) + (dupe.total_orders || 0);
            updates.total_appointments = (primary.total_appointments || 0) + (dupe.total_appointments || 0);

            // Keep earliest first_seen
            if (dupe.first_seen && (!primary.first_seen || dupe.first_seen < primary.first_seen)) {
                updates.first_seen = dupe.first_seen;
            }

            // Keep latest last_seen
            if (dupe.last_seen && (!primary.last_seen || dupe.last_seen > primary.last_seen)) {
                updates.last_seen = dupe.last_seen;
            }

            // Merge tags
            const primaryTags: string[] = Array.isArray(primary.tags) ? primary.tags : [];
            const dupeTags: string[] = Array.isArray(dupe.tags) ? dupe.tags : [];
            const mergedTags = [...new Set([...primaryTags, ...dupeTags])];
            if (mergedTags.length > primaryTags.length) {
                updates.tags = JSON.stringify(mergedTags);
            }

            if (Object.keys(updates).length > 0) {
                await supabase
                    .from('customer_profiles')
                    .update(updates)
                    .eq('id', primary.id);
            }

            // Delete the duplicate profile
            await supabase
                .from('customer_profiles')
                .delete()
                .eq('id', dupe.id);

            v2log.info('CUSTOMER_PROFILE', 'Cross-channel merge completed', {
                primaryId: primary.id,
                mergedId: dupe.id,
                phone,
                workspaceId,
            });
        }
    } catch (err) {
        v2log.warn('CUSTOMER_PROFILE', 'linkProfilesByPhone exception', { err, workspaceId, phone });
    }
}

// ── Cross-Channel Name Linking ───────────────────────────────

/**
 * Normalize a name for fuzzy comparison:
 * lowercase, strip diacritics, collapse whitespace, trim.
 */
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics
        .replace(/[^a-z0-9\s]/g, '')     // strip non-alphanumeric
        .replace(/\s+/g, ' ')            // collapse whitespace
        .trim();
}

/**
 * Link separate profiles that share the same name within a workspace.
 * Uses normalized fuzzy matching so "Ali Kassem" on IG matches
 * "ali kassem" on WhatsApp.
 *
 * Only merges if profiles have different platform chat IDs
 * (one has IG, the other has WA) to avoid false positives.
 */
export async function linkProfilesByName(
    supabase: SupabaseClient,
    workspaceId: string,
    name: string
): Promise<void> {
    if (!name || name.trim().length < 2) return;

    const normalized = normalizeName(name);
    if (normalized.length < 2) return;

    try {
        // Fetch all profiles in this workspace that have a name
        const { data: profiles, error } = await supabase
            .from('customer_profiles')
            .select('*')
            .eq('workspace_id', workspaceId)
            .not('name', 'is', null)
            .order('first_seen', { ascending: true });

        if (error || !profiles || profiles.length <= 1) return;

        // Filter to profiles whose normalized name matches
        const matching = profiles.filter((p: any) =>
            p.name && normalizeName(p.name) === normalized
        );

        if (matching.length <= 1) return;

        // Only merge if they have *different* platform IDs
        // (i.e., one has instagram_chat_id and another has whatsapp_chat_id)
        const hasIG = matching.some((p: any) => p.instagram_chat_id && !p.whatsapp_chat_id);
        const hasWA = matching.some((p: any) => p.whatsapp_chat_id && !p.instagram_chat_id);

        if (!hasIG || !hasWA) return; // All on same platform — skip

        // Use the oldest profile as primary
        const primary = matching[0];
        const duplicates = matching.slice(1);

        for (const dupe of duplicates) {
            // Skip if both profiles already have both platform IDs
            if (primary.instagram_chat_id && primary.whatsapp_chat_id) break;

            const updates: Record<string, any> = {};

            if (dupe.instagram_chat_id && !primary.instagram_chat_id) {
                updates.instagram_chat_id = dupe.instagram_chat_id;
            }
            if (dupe.whatsapp_chat_id && !primary.whatsapp_chat_id) {
                updates.whatsapp_chat_id = dupe.whatsapp_chat_id;
            }
            if (dupe.phone && !primary.phone) {
                updates.phone = dupe.phone;
            }
            if (dupe.email && !primary.email) {
                updates.email = dupe.email;
            }

            // Sum counters
            updates.total_orders = (primary.total_orders || 0) + (dupe.total_orders || 0);
            updates.total_appointments = (primary.total_appointments || 0) + (dupe.total_appointments || 0);

            // Keep earliest first_seen
            if (dupe.first_seen && (!primary.first_seen || dupe.first_seen < primary.first_seen)) {
                updates.first_seen = dupe.first_seen;
            }
            // Keep latest last_seen
            if (dupe.last_seen && (!primary.last_seen || dupe.last_seen > primary.last_seen)) {
                updates.last_seen = dupe.last_seen;
            }

            // Merge tags
            const primaryTags: string[] = Array.isArray(primary.tags) ? primary.tags : [];
            const dupeTags: string[] = Array.isArray(dupe.tags) ? dupe.tags : [];
            const mergedTags = [...new Set([...primaryTags, ...dupeTags])];
            if (mergedTags.length > primaryTags.length) {
                updates.tags = JSON.stringify(mergedTags);
            }

            if (Object.keys(updates).length > 0) {
                await supabase
                    .from('customer_profiles')
                    .update(updates)
                    .eq('id', primary.id);

                // Update primary in-memory for subsequent merges
                Object.assign(primary, updates);
            }

            // Delete the duplicate profile
            await supabase
                .from('customer_profiles')
                .delete()
                .eq('id', dupe.id);

            v2log.info('CUSTOMER_PROFILE', 'Cross-channel name merge completed', {
                primaryId: primary.id,
                mergedId: dupe.id,
                name: normalized,
                workspaceId,
            });
        }
    } catch (err) {
        v2log.warn('CUSTOMER_PROFILE', 'linkProfilesByName exception', { err, workspaceId, name });
    }
}

// ── Row Mapper ───────────────────────────────────────────────

function mapRowToProfile(row: any): CustomerProfile {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        phone: row.phone || undefined,
        instagramChatId: row.instagram_chat_id || undefined,
        whatsappChatId: row.whatsapp_chat_id || undefined,
        name: row.name || undefined,
        email: row.email || undefined,
        tags: Array.isArray(row.tags) ? row.tags : [],
        totalOrders: row.total_orders || 0,
        totalAppointments: row.total_appointments || 0,
        firstInteractionAt: row.first_seen || new Date().toISOString(),
        lastInteractionAt: row.last_seen || new Date().toISOString(),
        metadata: row.metadata || {},
    };
}
