import type { AutomationInput, AutomationResult, WorkspaceConfig } from '@/lib/ai/types';
import { orchestrate } from '@/lib/automation-v3/orchestrator';

/**
 * runV3Agent wraps orchestrate() from the decoupled automation-v3 pipeline
 * to provide a clean, simplified entry point for execution.
 * It normalizes configuration keys to ensure compatibility across test configurations.
 */
export async function runV3Agent(
    input: AutomationInput,
    config: WorkspaceConfig
): Promise<AutomationResult> {
    const normalizedConfig: WorkspaceConfig = {
        ...config,
        businessType: config.businessType || (config as any).business_type,
        workspaceId: config.workspaceId || (config as any).id,
        userId: config.userId || (config as any).user_id,
        businessName: config.businessName || (config as any).name,
    };
    return orchestrate(input, normalizedConfig);
}
