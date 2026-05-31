import type { AutomationInput, AutomationResult, WorkspaceConfig } from '@/lib/ai/types';
import { orchestrate } from '@/lib/automation-v3/orchestrator';

/**
 * runV3Agent wraps orchestrate() from the decoupled automation-v3 pipeline
 * to provide a clean, simplified entry point for execution.
 */
export async function runV3Agent(
    input: AutomationInput,
    config: WorkspaceConfig
): Promise<AutomationResult> {
    return orchestrate(input, config);
}
