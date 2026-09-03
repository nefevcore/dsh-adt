import { type ToolDeps } from './common.js';
/** What one capability did when it was called. */
export type SweepVerdict = 'answered' | 'empty' | 'dead' | 'absent' | 'refused' | 'broken' | 'skipped';
/**
 * Every registered adt_* tool the sweep does NOT probe, so the report's
 * coverage statement is a list, never a gap. Mutating/executing tools are
 * out by principle (rule 2); the rest need inputs the sweep cannot invent.
 */
export declare const UNPROBED_TOOLS: readonly string[];
export declare function selfcheckTools(deps: ToolDeps): import("../tooldef.js").DefinedTool[];
//# sourceMappingURL=selfcheck.d.ts.map