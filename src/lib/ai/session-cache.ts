/**
 * GhostAgent - Session Cache Layer
 * Redis cache for hot sessions with Supabase durable fallback.
 * When REDIS_URL is set, sessions are cached for 5 min to reduce DB reads.
 * When not set, falls back silently to Supabase-only mode.
 */

import Redis from 'ioredis';
import type { SessionContext } from '@/lib/automation-v3/types';

// Redis client (lazy singleton)
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) return null;
  try {
    redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    console.log('[SessionCache] Redis connected');
    return redis;
  } catch {
    console.warn('[SessionCache] Redis connection failed, falling back to Supabase-only');
    return null;
  }
}

function sessionKey(workspaceId: string, chatId: string): string {
  return 'session:' + workspaceId + ':' + chatId;
}

const CACHE_TTL_SECONDS = 300;

export async function cacheGetSession(
  workspaceId: string,
  chatId: string
): Promise<SessionContext | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(sessionKey(workspaceId, chatId));
    if (!raw) return null;
    return JSON.parse(raw) as SessionContext;
  } catch {
    return null;
  }
}

export async function cacheSetSession(
  workspaceId: string,
  chatId: string,
  session: SessionContext
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.setex(sessionKey(workspaceId, chatId), CACHE_TTL_SECONDS, JSON.stringify(session));
  } catch {
    // Cache write failure is non-critical
  }
}

export async function cacheDelSession(workspaceId: string, chatId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(sessionKey(workspaceId, chatId));
  } catch {
    // Non-critical
  }
}

export function isRedisAvailable(): boolean {
  return getRedis() !== null;
}
