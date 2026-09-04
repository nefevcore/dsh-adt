import { type ToolDeps } from './common.js';
/** One line-diff operation. */
export interface DiffOp {
    kind: '=' | '-' | '+';
    line: string;
}
/**
 * Line diff. Uses common prefix/suffix trimming with the middle emitted as a
 * remove block then an add block — no DP table, so it is O(n) memory and time.
 * (A full LCS backtrack was dropped: on this Node build a table-based diff
 * inside a plugin module triggered pathological V8 GC under the test runner.)
 */
export declare function diffLines(from: string, to: string): DiffOp[];
/** Render a line diff as unified diff with hunk headers and context. */
export declare function unifiedDiff(from: string, to: string, context?: number): string;
export declare function versionTools(deps: ToolDeps): import("../tooldef.js").DefinedTool[];
//# sourceMappingURL=versions.d.ts.map