import type { Context } from '@deepseek-ai/cordis';
import { type ToolDeps } from './common.js';
/**
 * Batch & pipeline tools — capabilities that go beyond the interactive VS Code
 * ADT workflow:
 *
 *  - `adt_batch_checks`   — run ATC + ABAP Unit across every object of a
 *    package in one shot and produce an aggregated report.
 *  - `adt_export_objects` — pull an object set's sources into a local folder
 *    (git-style versioning, offline review, backups).
 */
export declare function batchTools(deps: ToolDeps, ctx: Context): import("@deepseek-ai/dsh-tools").ToolDefinition[];
//# sourceMappingURL=batch.d.ts.map