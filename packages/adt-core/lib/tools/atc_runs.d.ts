import { type ToolDeps } from './common.js';
/**
 * adt_atc_runs — ATC run introspection, D-group consolidation
 * (docs/tool-consolidation-plan.md §5): the former adt_list_atc_runs /
 * adt_get_atc_result pair became ONE tool — no `displayId` = the stored-run
 * feed, `displayId` = one run's findings. Complements `adt_run_atc` (which
 * starts new runs).
 */
export declare function atcRunTools(deps: ToolDeps): import("../tooldef.js").DefinedTool[];
//# sourceMappingURL=atc_runs.d.ts.map