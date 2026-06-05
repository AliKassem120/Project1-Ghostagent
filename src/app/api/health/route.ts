import { NextResponse } from 'next/server';
import { deepseekCircuit } from '@/lib/ai/circuit-breaker';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const checks = await Promise.all([
    checkSupabase(),
    checkDeepseek(),
    checkMemoryUsage(),
  ]);
  
  const allHealthy = checks.every(c => c.healthy);
  
  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      version: '3.0.0',
      checks: Object.fromEntries(checks.map(c => [c.name, c])),
    },
    { status: allHealthy ? 200 : 503 }
  );
}

async function checkSupabase() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    // Simple query to verify connection
    const { error } = await supabase.from('ai_settings').select('count', { count: 'exact', head: true }).limit(1);
    if (error) throw error;
    return { name: 'supabase', healthy: true };
  } catch (error: any) {
    return { name: 'supabase', healthy: false, error: error.message || String(error) };
  }
}

async function checkDeepseek() {
  const isCircuitOpen = !deepseekCircuit.canExecute();
  return {
    name: 'deepseek',
    healthy: !isCircuitOpen,
    circuitState: isCircuitOpen ? 'open' : 'closed',
  };
}

async function checkMemoryUsage() {
  const memory = process.memoryUsage();
  const healthy = memory.heapUsed < 500 * 1024 * 1024;
  return {
    name: 'memory',
    healthy,
    heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(memory.rss / 1024 / 1024) + 'MB'
  };
}
