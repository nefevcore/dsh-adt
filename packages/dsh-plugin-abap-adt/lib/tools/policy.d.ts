import { type ToolDeps } from './common.js';
/**
 * Read-only introspection tool for the ADT permission policy. Lets the agent
 * learn its own guard rails before attempting mutating work, instead of
 * discovering them one denial at a time. Reports the global defaults AND the
 * effective policy per destination (a destination-level `policy:` block
 * overrides the global keys for that system only).
 */
export declare function policyTools(deps: ToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition[];
//# sourceMappingURL=policy.d.ts.map