import { type ToolDeps } from './common.js';
export type GateStage = 'syntax' | 'unit' | 'atc';
export interface GateStageResult {
    stage: GateStage;
    pass: boolean;
    summary: string;
    skipped?: boolean;
}
/** Pure aggregation: all enabled stages must pass for a "go"; a stage the
 * backend does not deploy (skipped, e.g. no ATC service) does not veto. */
export declare function aggregateGate(stages: GateStageResult[]): {
    verdict: 'go' | 'no-go';
};
export declare function gateTools(deps: ToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition[];
//# sourceMappingURL=gate.d.ts.map