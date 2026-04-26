/**
 * resolveService — Generic service matcher for the appointments brain.
 *
 * Matching priority:
 * 1. Exact name match (case-insensitive)
 * 2. Alias match (any alias in service.aliases[])
 * 3. Fuzzy: service name or description contains query words
 * 4. If only one active service exists → weak confidence offer
 *
 * Never hardcodes any service name, alias, or price.
 */

export type ResolvedService = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  description: string | null;
  aliases: string[];
  category: string | null;
  buffer_before: number;
  buffer_after: number;
  is_active: boolean;
};

export type ServiceMatchResult = {
  service: ResolvedService | null;
  confidence: 'exact' | 'alias' | 'fuzzy' | 'only_one' | 'none';
  candidates: ResolvedService[]; // filled when multiple fuzzy matches found
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]+/g, ' ').trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean);
}

function scoreMatch(service: ResolvedService, query: string): number {
  const q = normalize(query);
  const name = normalize(service.name);
  const desc = normalize(service.description || '');
  const aliases = (service.aliases || []).map(normalize);

  // Exact name
  if (name === q) return 100;

  // Alias exact
  if (aliases.includes(q)) return 95;

  // Alias partial
  if (aliases.some(a => a.includes(q) || q.includes(a))) return 75;

  // Name contains query
  if (name.includes(q) || q.includes(name)) return 65;

  // Token overlap on name
  const queryTokens = tokenize(query);
  const nameTokens = tokenize(service.name);
  const overlap = queryTokens.filter(t => nameTokens.includes(t)).length;
  if (overlap > 0) return 40 + overlap * 10;

  // Description contains query word
  if (queryTokens.some(t => desc.includes(t))) return 20;

  return 0;
}

export async function resolveService(args: {
  supabase: any;
  workspaceId: string;
  query: string | null | undefined;
}): Promise<ServiceMatchResult> {
  const { supabase, workspaceId, query } = args;

  // Load all active services for this workspace
  const { data, error } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes, description, aliases, category, buffer_before, buffer_after, is_active')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error || !data) {
    console.error('[resolveService] DB error:', error);
    return { service: null, confidence: 'none', candidates: [] };
  }

  const services = data as ResolvedService[];

  console.log('[SERVICE_RESOLUTION]', {
    workspaceId,
    query,
    totalActiveServices: services.length,
  });

  if (services.length === 0) {
    return { service: null, confidence: 'none', candidates: [] };
  }

  if (!query?.trim()) {
    // No query — only match if exactly one service exists
    if (services.length === 1) {
      return { service: services[0], confidence: 'only_one', candidates: services };
    }
    return { service: null, confidence: 'none', candidates: services };
  }

  // Score all services
  const scored = services
    .map(s => ({ service: s, score: scoreMatch(s, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  console.log('[SERVICE_RESOLUTION_SCORES]', scored.map(x => ({ name: x.service.name, score: x.score })));

  if (scored.length === 0) {
    // No match — if only one service, offer it weakly
    if (services.length === 1) {
      return { service: services[0], confidence: 'only_one', candidates: services };
    }
    return { service: null, confidence: 'none', candidates: services };
  }

  const top = scored[0];

  if (top.score >= 95) {
    return { service: top.service, confidence: top.score === 100 ? 'exact' : 'alias', candidates: [] };
  }

  if (top.score >= 60) {
    // Check if second candidate is close
    const second = scored[1];
    if (second && top.score - second.score < 15) {
      // Ambiguous — return candidates for the bot to ask
      return {
        service: null,
        confidence: 'fuzzy',
        candidates: scored.slice(0, 3).map(x => x.service),
      };
    }
    return { service: top.service, confidence: 'fuzzy', candidates: [] };
  }

  // Low confidence
  if (services.length === 1) {
    return { service: services[0], confidence: 'only_one', candidates: services };
  }

  return { service: null, confidence: 'none', candidates: services };
}
